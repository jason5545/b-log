# 在 Linux KVM 虛擬機中實現 iPhone USB 直通：一場與系統服務的戰鬥

折騰了好幾天，終於讓 iPhone 能夠穩定地直通到 macOS 虛擬機了。這篇文章記錄整個過程，希望能幫到有同樣需求的人。

## 問題背景

在 Linux 上跑 macOS KVM 虛擬機（透過 OSX-KVM），想把 iPhone 直通進去用 Xcode 開發。聽起來簡單，實際上踩了無數的坑。

用標準 USB passthrough 把 iPhone 傳給 VM 之後：

- `system_profiler SPUSBDataType` 可以看到 iPhone
- 但 Xcode 始終顯示裝置 **Offline**

沒辦法用 Xcode 真機調試或部署 App。

## 嘗試過的方法（都失敗了）

### 1. 標準 USB Passthrough

```xml
<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x05ac'/>
    <product id='0x12a8'/>
  </source>
</hostdev>
```

結果：裝置不斷重新列舉，libvirt 抓不到正確的 device number。

### 2. 用 QEMU Monitor 加 `guest-reset=off`

```
device_add usb-host,vendorid=0x05ac,productid=0x12a8,guest-reset=off
```

結果：裝置速度顯示 1.5 Mb/s（USB 1.0），完全錯誤。有幫助但不夠。

### 3. 停用 Host 端的 usbmuxd

罪魁禍首是 `usbmuxd`——這個 daemon 會自動抓取任何 Apple 設備。就算手動停掉它，udev 規則又會把它叫回來。

### 4. udev 規則 unbind 設備

時機問題，設備會重新列舉。

### 5. 空的 usbmuxd.rules 覆蓋系統規則

檔名搞錯了，是 `60-libgphoto2-6t64.rules` 不是 `60-libgphoto2-6.rules`。

### 6. libvirt qemu hook

hook 必須快速返回，不能等待；放背景執行又有時序問題。

## 第一個能用的解法：PCI Passthrough 整個 USB 控制器

試了一堆方法之後，發現一個可靠的做法是**把整個 USB 控制器 passthrough 給 VM**。

### 找出 USB 控制器

```bash
lspci | grep -i usb
# 00:14.0 USB controller: Intel Corporation Tiger Lake-H USB 3.2 Gen 2x1 xHCI Host Controller
```

### 確認 IOMMU Group

```bash
ls /sys/kernel/iommu_groups/8/devices/
# 0000:00:14.0
# 0000:00:14.2
```

### 建立 libvirt hook

在 `/etc/libvirt/hooks/qemu` 建立以下腳本：

```bash
#!/bin/bash
VM_NAME="$1"
ACTION="$2"
USB_PCI="0000:00:14.0"

if [[ "$VM_NAME" == "macOS" ]]; then
    case "$ACTION" in
        prepare)
            # VM 啟動前：將 USB 控制器綁定到 vfio-pci
            modprobe vfio-pci
            echo "$USB_PCI" > /sys/bus/pci/drivers/xhci_hcd/unbind 2>/dev/null || true
            echo "8086 43ed" > /sys/bus/pci/drivers/vfio-pci/new_id 2>/dev/null || true
            echo "$USB_PCI" > /sys/bus/pci/drivers/vfio-pci/bind 2>/dev/null || true
            ;;
        release)
            # VM 關閉後：歸還 USB 控制器給 Host
            echo "$USB_PCI" > /sys/bus/pci/drivers/vfio-pci/unbind 2>/dev/null || true
            echo "$USB_PCI" > /sys/bus/pci/drivers/xhci_hcd/bind 2>/dev/null || true
            sleep 2
            udevadm trigger --subsystem-match=usb
            systemctl restart usbmuxd &
            ;;
    esac
fi
```

### 將 USB 控制器加入 VM 設定

```bash
virsh attach-device macOS --config /dev/stdin <<'EOF'
<hostdev mode='subsystem' type='pci' managed='yes'>
  <source>
    <address domain='0x0000' bus='0x00' slot='0x14' function='0x0'/>
  </source>
</hostdev>
EOF
```

這樣確實能讓 Xcode 認得 iPhone 了。

但問題來了——**所有 USB 設備都進了虛擬機**。鍵盤、滑鼠、指紋辨識器、藍牙、Wacom 繪圖板全都不見了。

這顯然不是我要的。

## 最終解決方案：Daemon 持續監控

放棄各種一次性的 hook，改寫一個 systemd daemon 每 2 秒檢查一次：

```bash
#!/bin/bash
# /usr/local/bin/iphone-passthrough

IPHONE_XML="/tmp/iphone-hostdev.xml"

cat > "$IPHONE_XML" << 'XMLEOF'
<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x05ac'/>
    <product id='0x12a8'/>
  </source>
</hostdev>
XMLEOF

while true; do
    if virsh list --name --state-running 2>/dev/null | grep -q "^macOS$"; then
        # VM 運行中 - 停掉 usbmuxd，嘗試 attach
        systemctl stop usbmuxd.service 2>/dev/null
        pkill usbmuxd 2>/dev/null

        if lsusb | grep -q "05ac:12a8"; then
            virsh attach-device macOS "$IPHONE_XML" --live 2>/dev/null
        fi
    else
        # VM 停止 - 恢復 usbmuxd
        systemctl unmask usbmuxd.service usbmuxd.socket 2>/dev/null
        if ! pgrep -x usbmuxd >/dev/null; then
            systemctl start usbmuxd.service 2>/dev/null
        fi
    fi
    sleep 2
done
```

Systemd service 檔案：

```ini
# /etc/systemd/system/iphone-passthrough.service
[Unit]
Description=iPhone passthrough daemon for macOS VM
After=libvirtd.service

[Service]
Type=simple
ExecStart=/usr/local/bin/iphone-passthrough
Restart=always

[Install]
WantedBy=multi-user.target
```

啟用服務：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now iphone-passthrough.service
```

## 為什麼 Daemon 有效，Hook 沒用？

| 問題 | Hook | Daemon |
|------|------|--------|
| 時序 | 只執行一次 | 持續重試 |
| 設備重新列舉 | 抓到舊的設備號 | 每次都拿最新的 |
| usbmuxd 競爭 | 被 udev 重新啟動 | 持續壓制 |
| 錯誤恢復 | 沒有 | 自動重試 |

核心問題在於：當你執行 `virsh attach-device` 時，iPhone 會重新列舉並取得新的設備號。Hook 只跑一次，抓到的是「舊」設備。等 QEMU 要用時，設備已經不在那了。Daemon 不在乎這個——它會一直重試直到成功。

## 還需要的設定

### 1. 遮蔽 gphoto2 規則

防止 KDE Solid 偵測 iPhone 為相機：

```bash
sudo touch /etc/udev/rules.d/60-libgphoto2-6t64.rules
sudo udevadm control --reload-rules
```

### 2. Mask gvfs 服務

```bash
systemctl --user mask gvfs-gphoto2-volume-monitor.service
systemctl --user mask gvfs-mtp-volume-monitor.service
```

### 3. 設定 USB 設備權限

```bash
# /etc/udev/rules.d/90-iphone-qemu.rules
SUBSYSTEM=="usb", ATTR{idVendor}=="05ac", ATTR{idProduct}=="12a8", MODE="0666"
```

## 測試結果

- VM 啟動 → usbmuxd 停止 → iPhone 自動直通到 VM
- VM 關閉 → usbmuxd 恢復 → iPhone 可在 host 使用
- iPhone 重新插拔 → Daemon 自動重新 attach

## 注意事項

1. **需要 IOMMU 支援**：BIOS 要開 VT-d/IOMMU，kernel 參數要加 `intel_iommu=on`。

2. **PCI passthrough 備案**：如果 daemon 方案還是有問題，PCI passthrough 整個 USB 控制器是最可靠的。但要確保你有其他 USB 控制器可用，或願意接受失去所有 USB 設備的代價。

## 結論

USB 直通看似簡單，實際上 Linux 桌面有太多服務在搶設備。與其跟它們鬥智鬥勇搞一次性的 hook，不如寫個 daemon 持續監控。暴力但有效。

---

*測試環境：KDE Neon, libvirt, QEMU, macOS VM*
