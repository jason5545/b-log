# 解決 WDS 橋接下區網設備無法互連的問題

## 問題描述

最近遇到一個很奇怪的網路問題：我的 Proxmox 容器（LXC 104，跑 Jellyfin）透過 Tailscale 可以正常連線，但從家裡的 WiFi 卻連不上，顯示 connection refused。

我的網路架構是這樣的：
- 主路由器：GL-MT6000（OpenWrt）
- 延伸器：Linksys MX4200（OpenWrt，WDS 模式連接主路由）
- Proxmox 伺服器：透過網路線連接 MX4200

## 排查過程

### 第一步：確認容器本身沒問題

先檢查容器的網路設定和防火牆：

```bash
lxc-attach -n 104 -- ss -tlnp
lxc-attach -n 104 -- iptables -L -n
```

結果顯示 Jellyfin 正確監聽在 `0.0.0.0:8096`，防火牆也是全開的狀態。

### 第二步：從不同位置測試連線

從 Proxmox 主機測試：
```bash
curl -sI http://10.0.0.105:8096
# HTTP/1.1 302 Found ✓ 成功
```

從主路由 GL-MT6000 測試：
```bash
curl -sI http://10.0.0.105:8096
# HTTP/1.1 302 Found ✓ 成功
```

從 MX4200 測試：
```bash
curl -sI http://10.0.0.105:8096
# HTTP/1.1 302 Found ✓ 成功
```

奇怪的是，從 MX4200 的 WiFi 連接的設備卻無法連線！

### 第三步：檢查 MAC 地址學習

在 GL-MT6000 上檢查橋接的 MAC 表：

```bash
brctl showmacs br-lan
```

發現一個關鍵資訊：**Proxmox 的 MAC 地址是從 port 8（WDS 介面）學習到的**，而不是從 LAN port。

這表示 Proxmox 伺服器是透過 MX4200 的 WDS 連接到主路由，而不是直接連接。

### 第四步：理解流量路徑

當 MX4200 WiFi 上的設備要連接容器時，流量路徑是：

```
WiFi 設備 → MX4200 WiFi AP → MX4200 橋接 → WDS → GL-MT6000
                                                    ↓
         容器 ← Proxmox ← MX4200 ← WDS ← GL-MT6000 (需要 hairpin)
```

流量從 WDS 介面進入 GL-MT6000 後，需要**從同一個介面送回去**，這就是所謂的 **hairpin（髮夾彎）**。

### 第五步：找到根本原因

檢查 GL-MT6000 的 WDS 介面設定：

```bash
cat /sys/class/net/phy1-ap0.sta1/brport/hairpin_mode
# 0  ← 問題在這裡！
```

**Hairpin mode 被關閉了！** 這導致從 WDS 進來的流量無法從同一個介面送出。

## 解決方案

### 立即修復

```bash
echo 1 > /sys/class/net/phy1-ap0.sta1/brport/hairpin_mode
```

### 永久生效

建立 hotplug 腳本，讓設定在重開機後自動套用：

```bash
cat > /etc/hotplug.d/iface/99-hairpin << 'EOF'
#!/bin/sh
[ "$ACTION" = "ifup" ] && [ "$INTERFACE" = "lan" ] && {
    sleep 2
    echo 1 > /sys/class/net/phy1-ap0.sta1/brport/hairpin_mode 2>/dev/null
}
EOF
chmod +x /etc/hotplug.d/iface/99-hairpin
```

## 結論

這個問題的關鍵在於理解網路拓撲：當 Proxmox 是透過 WDS 延伸器連接到主路由時，同一個延伸器上的 WiFi 設備要存取 Proxmox 上的服務，流量必須經過主路由的 hairpin 轉發。

如果你也有類似的 WDS 橋接架構，遇到區網設備之間無法互連的問題，記得檢查 hairpin mode 的設定！

## 學到的教訓

1. Tailscale 能通但區網不能通，通常是 L2 層的問題
2. WDS 橋接架構下，hairpin mode 是關鍵設定
3. 用 `brctl showmacs` 可以快速了解 MAC 地址是從哪個 port 學習到的
4. 網路問題排查要從不同位置測試，才能定位問題發生的位置
