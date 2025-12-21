# 在 KVM 虛擬機上修復 macOS Sequoia 的 Apple ID 登入問題

在 Linux 主機上用 KVM 跑 macOS 虛擬機，想登入 Xcode 開發 iOS App，結果 Apple ID 死活登不進去。

錯誤訊息不是「Unable to sign you in to your Apple ID. Try again later.」就是「There was an error connecting to the Apple ID server.」

查了一堆資料，踩了一堆坑，最後終於搞定了。

## 環境

- **Host OS**: KDE neon
- **虛擬化**: KVM/QEMU + libvirt
- **Guest OS**: macOS Sequoia (15.x)
- **Bootloader**: OpenCore
- **專案**: [OSX-KVM](https://github.com/kholia/OSX-KVM)

## 問題在哪

Apple ID 在 VM 上登不進去，主要是三個原因：

### 1. `kern.hv_vmm_present` 旗標

macOS 會檢查 `kern.hv_vmm_present` 這個核心參數。當系統偵測到自己運行在虛擬機中時，這個值會是 `1`。許多 Apple 服務（包括 iCloud、App Store、Xcode 登入）會檢查這個旗標，如果發現是在 VM 中運行，就會拒絕認證。

```bash
sysctl kern | grep 'kern.hv_vmm_present'
# 輸出: kern.hv_vmm_present: 1  ← 這就是問題所在
```

### 2. SMBIOS 序號問題

OSX-KVM 預設的 SMBIOS 資訊（序號、MLB、UUID 等）是公開的範例值，很可能已經被無數人使用過。Apple 的伺服器會標記這些被濫用的序號，導致認證失敗。

### 3. 網路介面卡類型

某些網路介面卡（如 `vmxnet3`）可能會觸發 Apple 的偵測機制，導致認證失敗。

## 解決方案

macOS Sequoia 對 VM 偵測特別嚴格，**三種方法要同時用**才會過：

1. ✅ 核心補丁：修改 `kern.hv_vmm_present` 返回值
2. ✅ VMHide kext：選擇性地對特定進程隱藏 VM 狀態
3. ✅ 正確的 SMBIOS 資訊：唯一的序號、MLB、UUID

少一個都不行。

### 步驟一：生成新的 SMBIOS 資訊

#### 1. 下載 GenSMBIOS 工具

```bash
cd ~/OSX-KVM
git clone https://github.com/corpnewt/GenSMBIOS
```

#### 2. 執行工具生成序號

```bash
cd GenSMBIOS
python3 GenSMBIOS.py
```

在互動式選單中：
1. 選擇 `1` - Install/Update MacSerial
2. 選擇 `3` - Generate SMBIOS
3. 輸入 `iMacPro1,1`（或你使用的機型）

工具會輸出類似這樣的資訊：

```
Type:         iMacPro1,1
Serial:       C02YG0KQHX87
Board Serial: C02912303QXJG36JA
SmUUID:       D1868CF8-4F9A-551A-9A6B-0D46B121971C
Apple ROM:    8863DFFD43B0
```

**重要提示**：你可以到 [Apple 查詢序號頁面](https://checkcoverage.apple.com/) 驗證生成的序號。如果顯示「We're sorry, but this serial number is not valid」，代表這個序號沒有被註冊過，可以安全使用。

#### 3. 更新 config.plist

編輯 `~/OSX-KVM/OpenCore/config.plist`，找到 `PlatformInfo > Generic` 區段，更新以下欄位：

```xml
<key>Generic</key>
<dict>
    <key>MLB</key>
    <string>C02912303QXJG36JA</string>
    <key>ROM</key>
    <string>8863DFFD43B0</string>
    <key>SystemProductName</key>
    <string>iMacPro1,1</string>
    <key>SystemSerialNumber</key>
    <string>C02YG0KQHX87</string>
    <key>SystemUUID</key>
    <string>D1868CF8-4F9A-551A-9A6B-0D46B121971C</string>
</dict>
```

### 步驟二：添加核心補丁隱藏 VM 偵測

這是最關鍵的一步。我們需要添加核心補丁，讓 `kern.hv_vmm_present` 返回 `0` 而不是 `1`。

原理是將 `kern.hv_vmm_present` 替換成 `kern.hibernatecount`（這個值在 VM 中通常是 0，因為休眠功能被禁用）。

#### 在 config.plist 中添加補丁

找到 `Kernel > Patch` 陣列，在結尾添加以下兩個補丁：

**補丁 1（適用於 Big Sur 11.3+）：**

```xml
<dict>
    <key>Arch</key>
    <string>x86_64</string>
    <key>Base</key>
    <string></string>
    <key>Comment</key>
    <string>VM Apple ID Fix - PART 1 of 2 - Patch kern.hv_vmm_present=0</string>
    <key>Count</key>
    <integer>1</integer>
    <key>Enabled</key>
    <true/>
    <key>Find</key>
    <data>aGliZXJuYXRlaGlkcmVhZHkAaGliZXJuYXRlY291bnQA</data>
    <key>Identifier</key>
    <string>kernel</string>
    <key>Limit</key>
    <integer>0</integer>
    <key>Mask</key>
    <data></data>
    <key>MaxKernel</key>
    <string></string>
    <key>MinKernel</key>
    <string>20.4.0</string>
    <key>Replace</key>
    <data>aGliZXJuYXRlaGlkcmVhZHkAaHZfdm1tX3ByZXNlbnQA</data>
    <key>ReplaceMask</key>
    <data></data>
    <key>Skip</key>
    <integer>0</integer>
</dict>
```

**補丁 2（適用於 Ventura/Sonoma/Sequoia，MinKernel 22.0.0+）：**

```xml
<dict>
    <key>Arch</key>
    <string>x86_64</string>
    <key>Base</key>
    <string></string>
    <key>Comment</key>
    <string>VM Apple ID Fix - PART 2 of 2 - Patch kern.hv_vmm_present=0</string>
    <key>Count</key>
    <integer>1</integer>
    <key>Enabled</key>
    <true/>
    <key>Find</key>
    <data>Ym9vdCBzZXNzaW9uIFVVSUQAaHZfdm1tX3ByZXNlbnQA</data>
    <key>Identifier</key>
    <string>kernel</string>
    <key>Limit</key>
    <integer>0</integer>
    <key>Mask</key>
    <data></data>
    <key>MaxKernel</key>
    <string></string>
    <key>MinKernel</key>
    <string>22.0.0</string>
    <key>Replace</key>
    <data>Ym9vdCBzZXNzaW9uIFVVSUQAaGliZXJuYXRlY291bnQA</data>
    <key>ReplaceMask</key>
    <data></data>
    <key>Skip</key>
    <integer>0</integer>
</dict>
```

### 步驟三：安裝 VMHide Kext

[VMHide](https://github.com/Carnations-Botanica/VMHide) 是一個 Lilu 插件，可以更智能地隱藏 VM 偵測。它會選擇性地對特定進程隱藏 VM 狀態。對於 macOS Sequoia，這個 kext 是必要的。

#### 方法一：安裝到系統目錄（我使用的方法）

這個方法更直接，不需要每次都更新 OpenCore 映像。

**前置條件**：確保 SIP 已停用（在 OpenCore 的 `config.plist` 中應該已經設定好 `csr-active-config`）。

```bash
# 進入 macOS 後，下載 VMHide.kext
# 從 https://github.com/Carnations-Botanica/VMHide/releases 下載

# 將 VMHide.kext 複製到系統擴展目錄
sudo cp -R ~/Downloads/VMHide.kext /Library/Extensions/

# 重建 kext 快取
sudo kextcache -i /

# 重新開機
sudo reboot
```

**優點**：
- 不需要每次更新 OpenCore 映像
- 設定更簡單

**缺點**：
- 需要停用 SIP
- 系統更新後可能需要重新安裝

#### 方法二：放入 OpenCore 的 Kexts 目錄

如果你想保持系統目錄乾淨，可以將 kext 放入 OpenCore：

```bash
# 確保 VM 已關閉
virsh shutdown macOS

# 掛載 OpenCore.qcow2
sudo modprobe nbd max_part=8
sudo qemu-nbd --connect=/dev/nbd0 ~/OSX-KVM/OpenCore/OpenCore.qcow2
mkdir -p /tmp/opencore_efi
sudo mount /dev/nbd0p1 /tmp/opencore_efi

# 複製 VMHide.kext（需要先下載到 Host）
sudo cp -R VMHide.kext /tmp/opencore_efi/EFI/OC/Kexts/

# 還需要更新 config.plist，在 Kernel > Add 陣列中添加：
# <dict>
#     <key>Arch</key>
#     <string>x86_64</string>
#     <key>BundlePath</key>
#     <string>VMHide.kext</string>
#     <key>Comment</key>
#     <string>Hide VM detection for Apple ID</string>
#     <key>Enabled</key>
#     <true/>
#     <key>ExecutablePath</key>
#     <string>Contents/MacOS/VMHide</string>
#     <key>MaxKernel</key>
#     <string></string>
#     <key>MinKernel</key>
#     <string>23.0.0</string>
#     <key>PlistPath</key>
#     <string>Contents/Info.plist</string>
# </dict>

# 卸載
sudo umount /tmp/opencore_efi
sudo qemu-nbd --disconnect /dev/nbd0
```

**優點**：
- 更乾淨，不影響系統目錄
- 每次開機自動載入

**缺點**：
- 需要更新 OpenCore 映像和 config.plist
- 設定較繁瑣

### 步驟四：將更新後的設定檔寫入 OpenCore 映像

由於 OpenCore 的設定檔是存放在 `OpenCore.qcow2` 映像檔內部，我們需要掛載這個映像來更新它。

#### 1. 確保 VM 已關閉

```bash
virsh shutdown macOS
# 或強制關閉
virsh destroy macOS
```

#### 2. 使用 qemu-nbd 掛載映像

```bash
# 載入 nbd 核心模組
sudo modprobe nbd max_part=8

# 連接 qcow2 映像
sudo qemu-nbd --connect=/dev/nbd0 ~/OSX-KVM/OpenCore/OpenCore.qcow2

# 建立掛載點並掛載 EFI 分區
mkdir -p /tmp/opencore_efi
sudo mount /dev/nbd0p1 /tmp/opencore_efi
```

#### 3. 複製更新後的設定檔

```bash
sudo cp ~/OSX-KVM/OpenCore/config.plist /tmp/opencore_efi/EFI/OC/config.plist
```

#### 4. 驗證更新

```bash
# 確認補丁已添加
grep -c "VM Apple ID Fix" /tmp/opencore_efi/EFI/OC/config.plist
# 應該輸出: 2
```

#### 5. 卸載映像

```bash
sudo umount /tmp/opencore_efi
sudo qemu-nbd --disconnect /dev/nbd0
```

### 步驟五：啟動 VM 並驗證

```bash
virsh start macOS
```

進入 macOS 後，打開終端機驗證補丁是否生效：

```bash
sysctl kern | grep 'kern.hv_vmm_present'
```

如果輸出是 `kern.hv_vmm_present: 0`，代表補丁成功了！

現在嘗試登入 Xcode 或 Apple ID，應該就能正常運作了。

## 其他可能有幫助的設定

### 更換網路介面卡類型

有些使用者反映將網路介面卡從 `vmxnet3` 改成 `e1000-82545em` 可以解決問題。

編輯 VM 的 XML 設定：

```bash
virsh edit macOS
```

找到 `<interface>` 區段，將：

```xml
<model type='vmxnet3'/>
```

改成：

```xml
<model type='e1000-82545em'/>
```

不過我測試過，對 Sequoia 沒用，核心補丁 + VMHide 才是真正的解法。

### 重置 NVRAM

在 OpenCore 開機選單中選擇「Reset NVRAM」，清除舊的 iCloud/Apple ID 快取資料，然後再嘗試登入。

### 清除 macOS 中的快取

進入 macOS 後，執行以下命令清除相關快取：

```bash
rm -rf ~/Library/Caches/com.apple.iCloudHelper*
rm -rf ~/Library/Caches/com.apple.Messages*
rm -rf ~/Library/Preferences/MobileMeAccounts.plist
```

## 注意事項

1. **qemu-guest-agent 可能失效**：核心補丁會讓 `kern.hv_vmm_present` 返回 0，這可能導致 qemu-guest-agent 無法正常運作，因為它也依賴這個旗標來判斷自己是否在 VM 中運行。

2. **不要使用公開的序號**：永遠不要使用網路上分享的序號，這些序號很可能已經被 Apple 標記。一定要自己生成唯一的序號。

3. **帳號歷史很重要**：如果你的 Apple ID 曾經在真實的 Apple 硬體上使用過，成功登入的機率會更高。全新的 Apple ID 可能會遇到更多障礙。

4. **Lilu 版本要求**：VMHide 需要 Lilu 1.7.0 或更新版本才能正常運作。

## 總結

| 步驟 | 說明 |
|------|------|
| 1. SMBIOS | 用 GenSMBIOS 生成唯一的序號、MLB、UUID |
| 2. 核心補丁 | 把 `kern.hv_vmm_present` 偽裝成 0 |
| 3. VMHide | 安裝 VMHide.kext 進一步隱藏 VM 偵測 |
| 4. 更新 OpenCore | 用 qemu-nbd 掛載並更新設定 |

Sequoia 比之前的版本嚴格很多，核心補丁和 VMHide kext 要同時用才會過。

## 參考資源

- [VMHide GitHub](https://github.com/Carnations-Botanica/VMHide)
- [Proxmox Forum - Sonoma Bluetooth Fix](https://forum.proxmox.com/threads/anyone-can-make-bluetooth-work-on-sonoma.153301/)
- [Proxmox Forum - Sequoia Apple ID](https://forum.proxmox.com/threads/macos-sequoia-cant-log-apple-id-and-its-services.154328/)
- [Dortania iServices Guide](https://dortania.github.io/OpenCore-Post-Install/universal/iservices.html)
- [OSX-KVM GitHub](https://github.com/kholia/OSX-KVM)
- [GenSMBIOS GitHub](https://github.com/corpnewt/GenSMBIOS)
- [OneClick macOS KVM - Apple ID Guide](https://oneclick-macos-simple-kvm.notaperson535.is-a.dev/docs/guide-Apple-ID/)
