# Proxmox LXC 的 DNS 一直跑掉：dhclient 在搞鬼

CT 106 突然 ping 不到 google.com。進去看 `/etc/resolv.conf`，DNS 又變成 `10.0.0.1` 了。

```bash
ping google.com
# ping: google.com: Temporary failure in name resolution
```

我想要的是：

```bash
nameserver 8.8.8.8
nameserver 1.1.1.1
```

結果每次都變成：

```bash
nameserver 10.0.0.1
```

用 `pct exec` 改回來：

```bash
pct exec 106 -- sh -lc \
  'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
```

DNS 會立刻恢復，但過一陣子又壞掉。而且不只 CT 106，檢查之後發現所有 LXC 都有這問題。

---

## 是誰在改 DNS

可能會動 `/etc/resolv.conf` 的有這幾個：

- Proxmox 自己（開機時寫 `# --- BEGIN PVE ---` 區塊）
- 容器裡的 `dhclient`
- `systemd-resolved`
- VPN 工具（Tailscale、OpenVPN）

先看 Proxmox 設定：

```bash
pct list
pct config 104
pct config 105
# ...
```

有些容器沒設 `nameserver:`，有些設了 `8.8.8.8`，有些是 `1.1.1.1 8.8.8.8`。

再看容器裡的 `/etc/resolv.conf`：

```bash
pct exec 106 -- cat /etc/resolv.conf
pct exec 108 -- cat /etc/resolv.conf
```

有兩種情況：

**PVE 版本**（有標記）：

```bash
# --- BEGIN PVE ---
search lan
nameserver 8.8.8.8
# --- END PVE ---
```

**被改掉的版本**：

```bash
domain lan
search lan
nameserver 10.0.0.1
```

看哪些 process 在跑：

```bash
pct exec 106 -- ps aux | egrep 'dhclient|systemd-resolved'
```

結果分成兩派：有些跑 `systemd-resolved`，有些跑 `dhclient`。而跑 `dhclient` 的那些容器，DNS 就是被改成 `10.0.0.1` 的那些。

找到了：是容器裡的 `dhclient` 在搞鬼。每次 DHCP 續租，它就把 DNS 改成 gateway 給的 `10.0.0.1`。

---

## 先固定 Host 的 DNS

改 host 的 `/etc/resolv.conf`：

```bash
cat >/etc/resolv.conf << 'EOF'
search lan
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
```

接著建立 `dhclient` hook：

```bash
mkdir -p /etc/dhcp/dhclient-enter-hooks.d
cat >/etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << 'EOF'
#!/bin/sh
make_resolv_conf() { :; }
EOF
chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

`dhclient` 更新租約時會呼叫 `make_resolv_conf()`，用 hook 把它改成空函式，就不會動 DNS 了。

驗證：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

Host 端穩定了。

---

## 統一所有容器的 DNS

我有幾個 LXC：`104, 105, 106, 107, 108, 111`。在 host 上跑個 loop：

```bash
CT_LIST="104 105 106 107 108 111"
for CT in $CT_LIST; do
  pct exec "$CT" -- sh -lc \
    'printf "%s\n" "nameserver 8.8.8.8" "nameserver 1.1.1.1" > /etc/resolv.conf'
done
```

確認：

```bash
pct exec 106 -- cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 1.1.1.1
```

---

## 鎖住容器裡的 dhclient

在每個容器裡放同樣的 hook：

```bash
pct exec "$CT" -- mkdir -p /etc/dhcp/dhclient-enter-hooks.d
pct exec "$CT" -- sh -lc 'cat > /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate << "EOF"\n#!/bin/sh\nmake_resolv_conf() { :; }\nEOF'
pct exec "$CT" -- chmod +x /etc/dhcp/dhclient-enter-hooks.d/nodnsupdate
```

測試看看（CT 106）：

```bash
pct exec 106 -- sh -lc '
  echo "Before:"; cat /etc/resolv.conf; echo;
  dhclient -v -r eth0 || echo "dhclient -r failed";
  dhclient -v eth0 || echo "dhclient renew failed";
  echo; echo "After:"; cat /etc/resolv.conf;
'
```

Before 是 `8.8.8.8` / `1.1.1.1`，DHCP 跑完後 After 還是一樣。搞定。

---

## 驗證

**Host**：

```bash
cat /etc/resolv.conf
ping -c 2 google.com
```

**所有容器**：

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

**實測**：

```bash
pct exec 104 -- ping -c 2 google.com
pct exec 106 -- ping -c 2 google.com
pct exec 108 -- ping -c 2 google.com
```

所有容器都能正常解析。

---

## 新容器會自動繼承

Host 的 DNS 固定後，建立新 LXC 時如果沒指定 `-nameserver`，PVE 會用 host 的 `/etc/resolv.conf` 當模板。新容器一開始就會是 `8.8.8.8` / `1.1.1.1`。

如果要更徹底，可以用 template：先在一個乾淨容器裡設好 `nodnsupdate`，轉成 template。之後 clone 出來的容器就自帶這個設定。

---

## 後記

別只怪 Proxmox。PVE 只是開機時寫一段 `/etc/resolv.conf`，會偷改的是容器裡的 DHCP client。

Host 的 DNS 雖然是預設模板，但容器裡只要有 `dhclient` 或 `systemd-resolved` 在跑，還是會把設定改掉。

`nodnsupdate` hook 很好用，幾行 shell 就能把 `/etc/resolv.conf` 從 DHCP 手上搶回來。

讓 host 和所有容器用同一組 DNS（順序也一致），之後 debug 網路問題會輕鬆很多。

做完這三件事，DNS 就穩定了。
