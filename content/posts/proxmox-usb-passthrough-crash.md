# 刷錯韌體，把整台 Proxmox 搞當機了

## 發生了什麼事

在 PVE 上把 T-Dongle S3 直通給 Windows VM，結果刷機時把整包韌體（含 bootloader）寫到錯的位址（0x10000），板子開機後開始瘋狂 reset，USB 不停重新枚舉。整台 PVE 直接被拖到像當機一樣。

拔掉板子就好了，後來用手機把它刷回來。

重點是：**USB passthrough 並沒有完全隔離**。VM 只拿到裝置控制權，底層的 xHCI 控制器還是宿主在管。裝置一亂，整條 USB bus 都會受影響。

---

## T-Dongle S3 的雙 USB 設計

這塊板子跟一般的 ESP32-S3 DevKit 不太一樣，它上面有兩組 USB：

**ESP32-S3 原生 USB (OTG)**
- 晶片內建的 USB 控制器
- 可以跑 CDC、HID、DFU
- 在 Linux 上通常是 `/dev/ttyACM0`

**CH340 晶片**
- USB 轉 UART bridge
- 傳統刷機用的
- 在 Linux 上是 `/dev/ttyUSB0`

所以插上電腦時，**會同時看到兩個 USB 裝置**。

這對實體機沒什麼問題，但在 PVE 這種虛擬化環境就麻煩了：
- QEMU 要同時處理兩個 endpoint
- 其中一個（特別是原生 USB）如果出問題，整個 USB port 都會受影響
- xHCI 控制器被拖下水

---

## 發生的事

1. 用 esptool 刷機，把整包韌體（含 bootloader）錯寫到 0x10000
2. 板子重開後開始亂跑，USB 頻繁斷開重連
3. PVE 的 xhci_hcd 被拖下水：
   - 核心 log 爆量
   - CPU 飆高
   - USB 控制器不停嘗試 reset
   - 鍵盤滑鼠都掛了
4. 看起來就像整台 PVE 當機
5. 拔掉板子 → 立刻好了
6. 改用手機刷回正常韌體
7. 回 PVE 用正確位址重刷

---

## 為什麼會這樣

### USB Passthrough 其實沒有完全隔離

很多人以為把 USB 裝置直通給 VM 就能完全隔離，但其實不是：

```
VM 控制裝置
Host 控制 USB bus
```

QEMU 只是把裝置的控制權交給 VM，但底層的 xHCI 控制器還是宿主在管。

### 韌體錯位造成的災難

正常的分區結構：
```
0x0000   → bootloader
0x8000   → partition table  
0x10000  → app
```

我做的蠢事：
```
0x0000   → (空的)
0x8000   → (空的)
0x10000  → bootloader + partition + app (整包塞這裡)
```

ESP32-S3 開機時：
- 在 0x0000 找不到 bootloader
- 開始亂跑
- USB OTG 開始發送錯亂的描述符
- 頻繁 reset

### xHCI 控制器被拖垮

當 ESP32-S3 開始「USB 風暴」：

```
ESP32-S3 (狂 reset)
    ↓
xHCI Controller (宿主)
    ↓ 嘗試處理
    ├─ Reset port
    ├─ Clear error ring  
    ├─ Retry enumeration
    └─ Timeout → 卡死
        ↓
所有 USB 裝置都掛
```

這時候鍵盤、滑鼠、USB 碟都會失靈，看起來就像當機。

---

## ESP32-S3 的分區位址

記住這個：

| 位址 | 內容 |
|------|------|
| 0x0000 | bootloader |
| 0x8000 | partition table |
| 0x10000 | app |

**口訣**：整包從 0x0000 開始，app-only 從 0x10000 開始。

官方提供的檔案通常有兩種：
- `factory.bin` / `merged.bin` → 整包，要從 0x0000 刷
- `app.bin` → 只有應用程式，從 0x10000 刷

---

## 怎麼救回來

### 1. 先讓 PVE 活過來

直接拔掉 T-Dongle S3。

如果還是卡住：
- 切到實體螢幕或 IPMI
- Ctrl+Alt+F2 進 TTY
- 必要時重開機

開機後檢查：
```bash
systemctl status
journalctl -k --no-pager | tail -100
lsusb -t
```

### 2. 用手機救板子

為什麼用手機？因為手機的 USB stack 比較簡單，不容易被拖垮。

1. 裝 ESP Flasher App（Play Store 有很多）
2. 把板子強制進下載模式：
   - 按住 BOOT (IO0)
   - 按一下 EN (RST)
   - 放開 BOOT
3. 在 App 裡清空 Flash，然後刷正確的韌體

### 3. 回 PVE 正確重刷

**重點：用 CH340（/dev/ttyUSB0），不要用原生 USB（/dev/ttyACM0）**

完整重刷：
```bash
# 清空
esptool.py --chip esp32s3 --port /dev/ttyUSB0 --baud 921600 erase_flash

# 分檔刷入
esptool.py --chip esp32s3 --port /dev/ttyUSB0 --baud 921600 write_flash -z \
  0x0000   bootloader.bin \
  0x8000   partition-table.bin \
  0x10000  app.bin
```

如果是整包：
```bash
esptool.py --chip esp32s3 --port /dev/ttyUSB0 --baud 921600 write_flash -z \
  0x0000   factory.bin
```

只更新 app（bootloader 確定是好的）：
```bash
esptool.py --chip esp32s3 --port /dev/ttyUSB0 --baud 921600 write_flash -z \
  0x10000  app.bin
```

---

## 怎麼避免再發生

### 硬體隔離

| 情況 | 做法 |
|------|------|
| 日常開發 | 用外接 PCIe USB 卡，整張卡直通給 VM |
| 燒錄操作 | 用有電源隔離的 USB Hub |
| 風險操作 | 在手機或實體機上做，別用 PVE |

### T-Dongle S3 專用：優先用 CH340

```bash
# ✅ 用這個（CH340，UART）
esptool.py --port /dev/ttyUSB0 ...

# ⚠️ 避免用這個（原生 USB，OTG）
esptool.py --port /dev/ttyACM0 ...
```

為什麼？因為 CH340 走傳統 UART，完全避開 ESP32-S3 的 USB OTG，即使 bootloader 壞掉也不會搞出 USB 風暴。

### 刷機前檢查清單

寫個腳本，強迫自己檢查：

```bash
#!/usr/bin/env bash
set -euo pipefail

CHIP=esp32s3
PORT=/dev/ttyUSB0  # 用 CH340
BAUD=921600

echo "檢查："
echo "  1. 這是整包還是 app-only？"
echo "  2. 位址對嗎？"
echo "  3. partition.csv 有改過嗎？"
read -p "Enter 繼續..."

esptool.py --chip "$CHIP" --port "$PORT" --baud "$BAUD" erase_flash
esptool.py --chip "$CHIP" --port "$PORT" --baud "$BAUD" write_flash -z \
  0x0000   bootloader.bin \
  0x8000   partition-table.bin \
  0x10000  app.bin

echo "Done"
```

### 監控 USB 狀態

```bash
# 即時看 USB 相關的核心訊息
journalctl -k -f | egrep -i 'usb|xhci'

# 目前的 USB 拓撲
lsusb -t

# 裝置節點
ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || true
```

---

## 刷機後檢查

### USB 枚舉

```bash
# 看裝置有沒有正常出現
lsusb | grep -i "esp\|10c4\|1a86"

# 序列埠
ls -l /dev/tty{ACM,USB}*

# 核心訊息（不應該有錯誤）
journalctl -k --since "5 minutes ago" | grep -i usb
```

應該看到穩定的 VID/PID，沒有一直斷開重連。

### Flash 內容校驗（選用）

```bash
# 讀出 bootloader 區塊算 MD5
esptool.py --chip esp32s3 --port /dev/ttyUSB0 read_flash 0x0000 0x8000 /tmp/verify.bin
md5sum /tmp/verify.bin
md5sum bootloader.bin
```

應該一樣。

### 功能測試

```bash
# 開序列監視器
esptool.py --chip esp32s3 --port /dev/ttyUSB0 monitor

# 或用 minicom
minicom -D /dev/ttyUSB0 -b 115200
```

看開機 log 正不正常，有沒有一直 reset。

---

## 會看到的錯誤訊息

當 USB 風暴發生時，`journalctl -k` 會看到：

```
usb 1-2: new high-speed USB device number 67 using xhci_hcd
usb 1-2: device descriptor read/64, error -71
<previous line repeated 1 additional times>
usb 1-2: new high-speed USB device number 68 using xhci_hcd
usb 1-2: device not accepting address 68, error -71
usb 1-2: reset high-speed USB device number 67 using xhci_hcd
cdc_acm 1-2:1.0: failed to set dtr/rts
xhci_hcd 0000:00:14.0: ERROR Transfer event TRB DMA ptr not part of current TD
xhci_hcd 0000:00:14.0: Timeout while waiting for setup device command
usb 1-2: USB disconnect, device number 67
```

如果 1 分鐘內看到：
- 10 次以上 `new device number`
- 連續的 `error -71` 或 `error -110`
- `xhci_hcd` 錯誤
- CPU 飆高

→ 立刻拔掉裝置。

---

## 總結

這次踩坑的重點：

1. **USB passthrough 沒有完全隔離**
   - VM 拿裝置控制權
   - Host 還是管 xHCI 控制器
   - 裝置出事會影響整個 USB bus

2. **T-Dongle S3 有雙 USB**
   - CH340（UART）+ ESP32-S3 原生 USB（OTG）
   - 燒錄用 `/dev/ttyUSB0`（CH340），不要用 `/dev/ttyACM0`

3. **韌體位址要對**
   - 整包 → `0x0000`
   - app-only → `0x10000`
   - 錯了會 bootloop → USB 風暴 → 宿主掛

以後刷機：
- 用 PCIe USB 卡獨立出來
- 或直接在手機/實體機上做
- 刷機前確認檔案類型和位址
- 用 CH340 通道，避開原生 USB