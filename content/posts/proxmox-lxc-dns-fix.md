# Proxmox LXC 的 DNS 一直跑掉：dhclient 在搞鬼

最近遇到一個問題：Proxmox 上所有 LXC 容器的 DNS 設定會自己改掉。手動修好後過一陣子又壞掉，查了很久才找到原因是 `dhclient` 在搞鬼。這篇記錄完整的解決過程。

---

## 問題：DNS 設定會自己跑掉

某個容器（CT 106）突然無法解析網域：

```bash
ping google.com
# ping: google.com: Temporary failure in name resolution
```

看 `/etc/resolv.conf`，每次壞掉都變成內網 gateway：

```bash
nameserver 10.0.0.1
```

但我要的是：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

當下先用 `pct exec` 直接改：

```bash
pct exec 106 -- sh -lc \
  'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
```

DNS 會立刻恢復，但過一陣子（通常是 DHCP lease 更新）又壞掉。後來發現不只 CT 106，所有 LXC 都有這問題。

---

## 找出是誰在改 DNS

LXC 裡可能會動 `/etc/resolv.conf` 的有這幾個：

- Proxmox 自己（開機時寫 `# --- BEGIN PVE ---` 區塊）
- 容器裡的 `dhclient`（DHCP client）
- `systemd-resolved`
- VPN 工具（Tailscale、OpenVPN 等）

### 檢查 Proxmox 設定

在 host 上看每個容器的設定：

```bash
pct list
pct config 104
pct config 105
# ...
```

重點是 `nameserver:` 和 `net0:` 欄位。結果發現：

- 有些容器沒有 `nameserver:`（跟隨 host）
- 有些只有 `nameserver: 8.8.8.8`
- 有些已經設成 `nameserver: 1.1.1.1 8.8.8.8`

### 檢查容器裡的 resolv.conf

```bash
pct exec 106 -- cat /etc/resolv.conf
pct exec 108 -- cat /etc/resolv.conf
```

看到兩種情況：

**PVE 版本**（有標記）：

```bash
# --- BEGIN PVE ---
search lan
nameserver 8.8.8.8
# --- END PVE ---
```

**被 DHCP 改寫的版本**：

```bash
domain lan
search lan
nameserver 10.0.0.1
```

### 找出是哪個 process 在動

```bash
pct exec 106 -- ps aux | egrep 'dhclient|systemd-resolved'
```

結果分成兩派：

- 一派有跑 `systemd-resolved`
- 另一派有跑 `dhclient`，而且這一派的 `/etc/resolv.conf` 就是被改成 `10.0.0.1` 的那些

結論：真正在改 DNS 的是容器裡的 `dhclient`。每次 DHCP 續租，它就重寫 DNS，改成 gateway 提供的 `10.0.0.1`。

---

## 解決目標

1. 所有現有容器都用：Primary `8.8.8.8`、Secondary `1.1.1.1`
2. Host 本身也用同樣的 DNS，順序一致
3. DHCP 更新時不能再改寫 `/etc/resolv.conf`
4. 未來新建容器預設就繼承這個 DNS 設定

需要處理三個層次：

- Host 的 `/etc/resolv.conf`
- 每個 container 內的 `/etc/resolv.conf`
- Host 和容器裡 `dhclient` 的行為

---

## 步驟一：固定 Host 的 DNS

先改 host 的 `/etc/resolv.conf`：

```bash
cat >/etc/resolv.conf << 'EOF'
search lan
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
```

然後建立 `dhclient` hook，阻止它改 DNS：

```bash
mkdir -p /etc/dhcp/dhclient-enter-hooks.d
cat >/etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << 'EOF'
#!/bin/sh
make_resolv_conf() { :; }
EOF
chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

原理：`dhclient` 更新租約時會呼叫 `make_resolv_conf()`，用 hook 把這個 function 改成「啥也不做」，從此 host 的 `/etc/resolv.conf` 不會被 DHCP 改寫。

驗證：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

內容正確、解析正常，host 端穩定了。

---

## 步驟二：統一所有容器的 DNS

我有幾個 LXC：`104, 105, 106, 107, 108, 111`，要讓每個容器的 `/etc/resolv.conf` 都只有兩行：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

在 host 上直接跑 loop（不用重開容器）：

```bash
CT_LIST="104 105 106 107 108 111"
for CT in $CT_LIST; do
  pct exec "$CT" -- sh -lc \
    'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
done
```

驗證：

```bash
pct exec 106 -- cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 1.1.1.1
```

---

## 步驟三：讓容器裡的 dhclient 無法改 DNS

在每個容器裡放同樣的 hook：

```bash
pct exec "$CT" -- mkdir -p /etc/dhcp/dhclient-enter-hooks.d
pct exec "$CT" -- sh -lc 'cat > /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << "EOF"\n#!/bin/sh\nmake_resolv_conf() { :; }\nEOF'
pct exec "$CT" -- chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

在其中一台（例如 CT 106）測試 DHCP 更新：

```bash
pct exec 106 -- sh -lc '
  echo "Before:"; cat /etc/resolv.conf; echo;
  dhclient -v -r eth0 || echo "dhclient -r failed";
  dhclient -v eth0 || echo "dhclient renew failed";
  echo; echo "After:"; cat /etc/resolv.conf;
'
```

結果：Before 是 `8.8.8.8` / `1.1.1.1`，DHCP 跑完後 After 還是同一個內容。容器裡的 `dhclient` 也失去改 DNS 的能力了。

---

## 驗證：確認都穩定了

**1. Host 檢查**：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

**2. 所有容器檢查**：

```bash
for CT in 104 105 106 107 108 111; do
  pct exec "$CT" -- cat /etc/resolv.conf
done
```

全部都是：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

**3. 實測 DNS**：

```bash
pct exec 104 -- ping -c 2 google.com
pct exec 106 -- ping -c 2 google.com
pct exec 108 -- ping -c 2 google.com
```

所有容器都能正常解析，問題解決。

---

## 未來新容器會怎麼處理

現在的狀態：

1. **Host DNS 固定**：
   - `/etc/resolv.conf` 永遠是 `8.8.8.8` → `1.1.1.1`
   - Host 的 `dhclient` 被 `nodnsupdate` 禁止改 DNS

2. **新容器自動繼承**：
   - 建立 LXC 時如果沒指定 `-nameserver`，PVE 會用 host 的 `/etc/resolv.conf` 當模板
   - 新容器一開始的 DNS 就會繼承 `8.8.8.8` / `1.1.1.1`

3. **用 template 更徹底**：
   - 用乾淨容器設好 `nodnsupdate`，轉成 template
   - Clone 出來的容器就自帶「dhclient 不能改 DNS」的特性

這樣 host、現有容器、未來容器都用同一套 DNS，不會再出現「過一陣子就壞掉」的情況。

---

## 心得

1. **別只怪 Proxmox**：PVE 只是開機時寫一段 `/etc/resolv.conf`，真正會偷改的是容器裡的 DHCP client 或 systemd。

2. **Host DNS 是預設模板但不是全部**：沒設定 `nameserver:` 的容器會跟 host 走，但容器裡只要有 `dhclient` 或 `systemd-resolved` 在跑，還是可以把設定洗掉。

3. **`nodnsupdate` hook 很好用**：幾行 shell 就能把 `/etc/resolv.conf` 從 DHCP 手上救回來。

4. **一致性讓 debug 容易**：讓 host 和所有容器用同一組 DNS（順序也一致），之後查網路問題會輕鬆很多。

如果你在 Proxmox LXC 上也遇到類似的 DNS 問題，試試這三步：

- 先鎖住 host 的 `/etc/resolv.conf`
- 在 host 和所有容器裡加上 `nodnsupdate`
- 統一調整所有容器的 `/etc/resolv.conf`

做完這三件事，DNS 就穩定了。
