# Proxmox LXC 的 DNS 一直跑掉：dhclient 在搞鬼

最近我在 Proxmox 節點上被一個看似小事但超煩的問題搞了好一陣子：**所有 LXC 容器的 DNS 設定會自己跑掉**。這篇文章記錄我從「一直手動修」到「完全自動化、永久穩定」的過程，也順便整理在 Proxmox LXC 裡，DNS 到底怎麼被決定、又是誰在偷偷改它。

---

## 問題現象：DNS 好好的，過一陣子就壞掉

一開始，我只注意到某一個容器（例如 CT 106）會突然無法解析網域名稱：

```bash
ping google.com
# ping: google.com: Temporary failure in name resolution
```

進容器裡看 `/etc/resolv.conf`，每次壞掉時都變成指向內網 gateway，例如：

```bash
nameserver 10.0.0.1
```

但我「真正想要」的是：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

當下的土法煉鋼解法，就是在 Proxmox host 上用 `pct exec` 直接改：

```bash
pct exec 106 -- sh -lc \
  'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
```

DNS 會立刻恢復正常，但過一陣子（通常是 DHCP lease 更新）又壞掉。更慘的是，我後來發現 **不只 CT 106，所有 LXC 都有這個問題**。

---

## 誰在偷改 `/etc/resolv.conf`？

在 LXC 裡，可能會動 `/etc/resolv.conf` 的角色大概有幾個：

- Proxmox 自己（開機時寫一段 `# --- BEGIN PVE ---` 區塊）
- 容器裡的 `dhclient`（DHCP client）
- `systemd-resolved`
- VPN / overlay 工具（例如 Tailscale、OpenVPN）

所以我從幾個方向下手調查。

### 1. 看每個容器的 Proxmox 設定

在 host 上：

```bash
pct list
pct config 104
pct config 105
# ...
```

重點是 `nameserver:` 與 `net0:`。結果發現：

- 有些容器完全沒有 `nameserver:`（就跟隨 host）
- 有些容器只有 `nameserver: 8.8.8.8`
- 也有容器已經設成 `nameserver: 1.1.1.1 8.8.8.8`

### 2. 看容器裡的 `/etc/resolv.conf`

```bash
pct exec 106 -- cat /etc/resolv.conf
pct exec 108 -- cat /etc/resolv.conf
```

我看到兩種典型樣子：

**PVE 版本**（有標記）：

```bash
# --- BEGIN PVE ---
search lan
nameserver 8.8.8.8
# --- END PVE ---
```

**被 DHCP 改寫的版本：**

```bash
domain lan
search lan
nameserver 10.0.0.1
```

### 3. 查容器裡有哪些 DNS 相關 process

```bash
pct exec 106 -- ps aux | egrep 'dhclient|systemd-resolved'
```

結果也分成兩派：

- 一派有跑 `systemd-resolved`
- 另一派有跑 `dhclient`，而且就是這一派的 `/etc/resolv.conf` 會被改成 `10.0.0.1`

到這裡我大概可以下結論：

> 真正偷改 `/etc/resolv.conf` 的，是容器裡的 `dhclient` —— 每次 DHCP 續租，它就重寫 DNS，改成 gateway 提供的 `10.0.0.1`。

---

## 設計目標：不只修好，還要永遠不再壞

我給自己訂了幾個目標：

1. 所有 **現有容器** 都要統一用：Primary `8.8.8.8`、Secondary `1.1.1.1`。
2. Proxmox **host** 本身也要固定用這兩個 DNS，順序一致。
3. 任何 DHCP 更新（host 或容器裡）都不能再改寫 `/etc/resolv.conf`。
4. 未來新建立容器，預設就繼承這樣的 DNS，不需要每次手動修。

這牽涉三個層次：

- Host 的 `/etc/resolv.conf`
- 每個 container 內的 `/etc/resolv.conf`
- Host & 容器裡 `dhclient` 的行為（`nodnsupdate` hook）

---

## 第一步：把 Proxmox host 的 DNS「鎖」起來

先把 host 的 `/etc/resolv.conf` 改成我要的樣子：

```bash
cat >/etc/resolv.conf << 'EOF'
search lan
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
```

接著，在 host 上建立 `dhclient` 的 hook，阻止它再動 DNS：

```bash
mkdir -p /etc/dhcp/dhclient-enter-hooks.d
cat >/etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << 'EOF'
#!/bin/sh
make_resolv_conf() { :; }
EOF
chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

原理很簡單：`dhclient` 在更新租約時會呼叫 `make_resolv_conf()`，我用 hook 覆寫這個 function 讓它變成「啥也不做」，從此之後 host 的 `/etc/resolv.conf` 不會再被 DHCP 改寫。

驗證一下 host 的 DNS：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

內容正確、解析正常，代表 host 端已經穩定。

---

## 第二步：所有容器的 `/etc/resolv.conf` 統一成同一版

我有幾個 LXC：`104, 105, 106, 107, 108, 111`，希望每個容器的 `/etc/resolv.conf` 內容都只有兩行：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

在 host 上直接跑一個 loop（不用重開容器）：

```bash
CT_LIST="104 105 106 107 108 111"
for CT in $CT_LIST; do
  pct exec "$CT" -- sh -lc \
    'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
done
```

再逐一確認：

```bash
pct exec 106 -- cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 1.1.1.1
```

---

## 第三步：在容器裡也讓 `dhclient` 永久失去「改 DNS」的權限

接下來要處理的是容器內的 `dhclient`。做法跟 host 類似，在每一個容器裡放一個 `dhclient-enter-hooks.d/nodnsupdate`：

```bash
pct exec "$CT" -- mkdir -p /etc/dhcp/dhclient-enter-hooks.d
pct exec "$CT" -- sh -lc 'cat > /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << "EOF"\n#!/bin/sh\nmake_resolv_conf() { :; }\nEOF'
pct exec "$CT" -- chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

然後在其中一台（例如 CT 106）裡直接強制 DHCP 更新來驗證：

```bash
pct exec 106 -- sh -lc '
  echo "Before:"; cat /etc/resolv.conf; echo;
  dhclient -v -r eth0 || echo "dhclient -r failed";
  dhclient -v eth0 || echo "dhclient renew failed";
  echo; echo "After:"; cat /etc/resolv.conf;
'
```

結果：Before 是我設定好的 `8.8.8.8` / `1.1.1.1`，DHCP 過程跑完後，After 還是同一個內容，代表 container 裡的 `dhclient` 也失去修改 DNS 的能力了。

---

## 第四步：驗證所有東西真的「穩」了

我最後做了幾個簡單的檢查：

1. **Host 上檢查 DNS**：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

2. **每個容器檢查 `/etc/resolv.conf`**：

```bash
for CT in 104 105 106 107 108 111; do
  pct exec "$CT" -- cat /etc/resolv.conf
done
```

內容全部都是：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

3. **抽幾台實測 DNS（例如 104, 106, 108）**：

```bash
pct exec 104 -- ping -c 2 google.com
pct exec 106 -- ping -c 2 google.com
pct exec 108 -- ping -c 2 google.com
```

所有容器都能正常解析 `google.com`，DNS 問題正式解決。

---

## 未來新建立的容器會怎麼繼承這個設定？

整理一下現在的狀態：

1. **Host DNS 已固定**：
   - `/etc/resolv.conf` 永遠是 `8.8.8.8` → `1.1.1.1`，前面加一行 `search lan`。
   - Host 的 `dhclient` 透過 `nodnsupdate` 被禁止改寫 DNS。

2. **Proxmox 建立新容器時**：
   - 如果建立 LXC 時沒有手動指定 `-nameserver`，PVE 會用 host 的 `/etc/resolv.conf` 當模板。
   - 也就是說，新容器一開始的 DNS 就會自然繼承 `8.8.8.8` / `1.1.1.1` 的順序。

3. **如果配合模板把 `nodnsupdate` 也做進去**：
   - 可以先用一個乾淨容器設好 `nodnsupdate`，再把它轉成 template。
   - 之後 clone 出來的容器就自帶「不允許 `dhclient` 改 DNS」的特性。

這樣一來，host、現有容器、未來容器，就會自然收斂到同一套 DNS 設計，而且不太會再出現「過一陣子就壞掉」的情況。

---

## 後記：我從這次踩坑學到的幾件事

1. **不要只怪 Proxmox**：PVE 只是在開機時幫你寫一段 `/etc/resolv.conf`，真正會「偷偷改掉」的，往往是容器裡的 DHCP client 或 systemd。
2. **Host DNS 是預設模板，但不是全部**：沒設定 `nameserver:` 的容器會跟 host 走，但容器裡只要有 `dhclient` 或 `systemd-resolved` 在動，照樣可以把你的設定洗掉。
3. **`dhclient-enter-hooks.d/nodnsupdate` 非常好用**：幾行 shell 就能把 `/etc/resolv.conf` 從 DHCP 手上救回來，讓你真正掌控 DNS。
4. **一致性會讓生活簡單很多**：讓 host 和所有容器用同一組 DNS（而且順序一致），之後 debug 網路問題會輕鬆不少。

如果你在 Proxmox LXC 上也遇到類似「DNS 過一陣子就壞掉」的怪問題，不妨試試：

- 先鎖住 host 的 `/etc/resolv.conf`；
- 在 host 和所有容器裡加上 `nodnsupdate`；
- 最後一次性統一調整所有容器的 `/etc/resolv.conf`。

對我來說，做完這三件事之後，DNS 終於穩定了，再也不用每天手動修。
