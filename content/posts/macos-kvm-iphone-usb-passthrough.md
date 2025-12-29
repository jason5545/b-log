# 讓 macOS VM 認得 iPhone：USB Passthrough 踩坑全紀錄

在 Linux 上跑 macOS 虛擬機，一直有個困擾：怎麼讓 Xcode 正確識別 iPhone？今天總算找到解法了。

## 問題

用 libvirt/QEMU 跑 macOS VM（透過 OSX-KVM），把 iPhone 透過 USB passthrough 傳給 VM 之後：

- `system_profiler SPUSBDataType` 可以看到 iPhone
- 但 Xcode 始終顯示裝置 **Offline**

沒辦法用 Xcode 真機調試或部署 App。

## 試過的方法（都失敗）

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

結果：裝置速度顯示 1.5 Mb/s（USB 1.0），完全錯誤。

### 3. 停用 Host 端的 usbmuxd

結果：iPhone 還是 Offline。

### 4. 用 qemu hook 延遲附加裝置

結果：時機問題，有時成功有時失敗。

## 解法：PCI Passthrough 整個 USB 控制器

試了一堆方法之後，發現唯一可靠的做法是**把整個 USB 控制器 passthrough 給 VM**。

### 步驟一：找出 USB 控制器

```bash
lspci | grep -i usb
# 00:14.0 USB controller: Intel Corporation Tiger Lake-H USB 3.2 Gen 2x1 xHCI Host Controller
```

### 步驟二：確認 IOMMU Group

```bash
ls /sys/kernel/iommu_groups/8/devices/
# 0000:00:14.0
# 0000:00:14.2
```

### 步驟三：建立 libvirt hook

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

### 步驟四：將 USB 控制器加入 VM 設定

```bash
virsh attach-device macOS --config /dev/stdin <<'EOF'
<hostdev mode='subsystem' type='pci' managed='yes'>
  <source>
    <address domain='0x0000' bus='0x00' slot='0x14' function='0x0'/>
  </source>
</hostdev>
EOF
```

## 成果

```
== Devices ==
My-iMac-Pro (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)
My iPhone (26.2) (XXXXXXXXXXXXXXXXXXXX)   ← 終於 Online 了！
```

## 注意事項

1. **會失去該 USB 控制器上的所有裝置**：包括 webcam、藍牙等。確保你有其他 USB 控制器可用，或願意接受這個代價。

2. **需要 IOMMU 支援**：BIOS 要開 VT-d/IOMMU，kernel 參數要加 `intel_iommu=on`。

3. **VM 關閉後會自動歸還**：透過 hook 腳本，USB 控制器會在 VM 關閉後自動回到 Host。

## 結論

iPhone 跟 macOS 之間的 USB 溝通協定很敏感，只有完整的 USB 控制器 passthrough 才能確保正常運作。網路上各種繞路的方法都不太行。
