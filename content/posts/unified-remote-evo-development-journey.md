# Unified Remote Evo - 從遙控器到多功能輸入裝置的開發之旅

> **當你喜愛的軟體停止更新時，該怎麼辦？**
>
> 這是一個關於如何為已停止維護的遙控軟體注入新生命的故事。透過協定研究、技術探索與創新實作，我打造了一個現代化的多功能遙控解決方案。

---

## 專案起源：為什麼要做這個專案?

這個專案源於我自己的特殊需求：由於我僅右手食指可活動,需要一個能透過 Android 平板遠端控制 PC 的解決方案。原本的 Unified Remote 和 EmulStick 雖然都是不錯的工具,但**兩者都已停止維護和更新**,且缺乏針對像我這樣有身體限制使用者的最佳化。

### 為什麼這些軟體停止更新很重要?

- **Unified Remote**:官方已停止維護,Android 客戶端不再更新,協定規格凍結
- **EmulStick**:硬體接收器韌體已穩定,不再改版

這意味著:
- ✅ **協定穩定性高**:不用擔心協定變更導致相容性問題
- ✅ **長期可維護**:研究出來的協定格式可以長期使用
- ❌ **功能凍結**:無法針對新需求客製化
- ❌ **相容性問題**:新版 Android 可能出現相容性問題

**這正是我開發新客戶端的契機**：既然官方不再更新,我可以自由研究協定、客製化功能,為這些停更的工具注入新生命。

### 產品優勢整合

這兩個產品各有優勢:
- **Unified Remote**:功能豐富,可透過網路(Tailscale)遠端控制
- **EmulStick**:即插即用,無需伺服器軟體,但需要藍牙接收器

於是我決定打造一個整合方案,讓自己能根據情境選擇最適合的連線模式。

## 第一個挑戰:研究 BLE HID 協定

**背景**：由於 EmulStick 官方已停止更新,無法從官方文件取得協定規格。我必須透過研究原廠 APP 的實作來了解 BLE 通訊協定。

### 掃描裝置:從完全失敗到成功

專案初期最大的挫折是 **無法掃描到 EmulStick 裝置**。當時的情況是:
- ❌ nRF Connect 看不到裝置
- ❌ 平板藍牙設定看不到裝置
- ❌ 我開發的 APP 掃描不到裝置
- ✅ **但原廠 APP 可以正常連線**

這個矛盾讓我陷入困境。經過深入研究原廠 APP 的程式碼,我發現了問題所在:

**錯誤的兩段式掃描策略**

原本我實作了一個「聰明」的兩段式掃描:
1. **Phase 1 (1.5秒)**:使用 Service UUID 過濾 (`0xF800`)
2. **Phase 2 (2.5秒)**:無過濾器(與原廠一致)

但實際上 EmulStick 的廣播封包可能不包含 Service UUID,導致 Phase 1 完全無法命中,而 Phase 切換過程中又可能遺失裝置。

**解決方案:回歸簡單**

我建立了一個診斷 APP,完全模仿原廠的單段掃描:
```kotlin
// 單段 4 秒掃描,無過濾器
val scanSettings = ScanSettings.Builder()
    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
    .build()

bluetoothLeScanner.startScan(null, scanSettings, scanCallback)
```

結果立刻成功!這個經驗讓我學到:**不要過度最佳化,先求能動,再求最佳化**。

### 身份驗證:AES 加密挑戰

成功掃描到裝置後,下一個挑戰是身份驗證。EmulStick 使用 AES 加密來防止未授權存取:

**驗證流程**
1. 讀取裝置的 **System ID**(8 bytes)
2. 根據 **Software Version** 取得對應的明文密碼
3. 使用 System ID 作為 AES 密鑰加密明文
4. 發送「取得密文」指令(`0x91`)
5. 比對接收器回傳的密文與本地加密結果

**關鍵程式碼**
```kotlin
// 生成 AES 密鑰(System ID 轉 16 進位字串)
val key = systemId.joinToString("") { "%02X".format(it) }

// AES 加密
val encrypted = AesCryptUtil.encrypt(key, plainText)

// 取前 16 字元比對
val expectedCipher = encrypted.take(16).toByteArray(Charsets.UTF_8)
return expectedCipher.contentEquals(cipherFromDongle)
```

雖然這個機制看似複雜,但所有關鍵資訊(明文密碼、加密算法)都在原廠 APP 中,因此只要完全複製邏輯就能通過驗證。

### 突破時刻:找到正確的 HID Report 格式

身份驗證完成後,連線成功,但所有滑鼠/鍵盤操作都無反應!

經過深入研究,我發現 EmulStick 有兩個版本:

| 版本 | 滑鼠格式 | 通道 | Report ID | 大小 |
|------|----------|------|-----------|------|
| Ver 0/-1 (舊版) | Mouse | CH1 (0xF801) | 3 | 7 bytes |
| **Ver ≥1 (新版)** | **MouseV1** | **CH3 (0xF803)** | **0 (無)** | **6 bytes** |

關鍵發現:
- **滑鼠改用 CH3 通道**(從 CH1 改為 CH3)
- **移除 Report ID**(從獨立 byte 改為不加 ID)
- **報告大小減少 1 byte**

**修正後的滑鼠報告**
```kotlin
// 6 bytes,無 Report ID
fun buildMouseReport(
    buttons: Int,
    deltaX: Int,
    deltaY: Int,
    wheel: Int
): ByteArray {
    return byteArrayOf(
        buttons.toByte(),             // [0] 按鈕(無 Report ID)
        (clampedX and 0xFF).toByte(), // [1] X 低位元組
        ((clampedX shr 8) and 0xFF).toByte(),  // [2] X 高位元組
        (clampedY and 0xFF).toByte(), // [3] Y 低位元組
        ((clampedY shr 8) and 0xFF).toByte(),  // [4] Y 高位元組
        clampedWheel.toByte()         // [5] 滾輪
    )
}
```

修正後,滑鼠終於能動了!

## 第二個挑戰:中文輸入的困境

HID 鍵盤只能傳送 ASCII 字元,那中文怎麼辦?我研究了三種方案:

### 方案 1: Big5 Alt 碼(⚠️ 有限制)

**原理**:按住 Alt → 數字鍵台輸入十進制 → 釋放 Alt → Windows 轉換為字元

例如:`Alt + 43938` → 哈(Big5: 0xABA2)

**結果**:
- ⚠️ 某些程式即使收到 CP950 的 Alt 鍵加上數字鍵台序列，仍會強制轉換為 CP1252，導致中文字元無法正確顯示
- ❌ 在 RDP 環境中完全無效
- ⚠️ 只支援 Big5 字元(約 13,000 個字)
- ✅ 在某些傳統應用程式中仍可正常運作

**結論**:更改鍵盤的實作邏輯，優先使用方案二（Alt+X Unicode 模式），方案一（Big5 Alt 碼）作為備援，兩者互補以提升中文輸入的相容性和可靠性。雖然方案三（IME Direct）速度最快，但由於需要官方轉譯程式且非標準HID協定，在某些環境下可能不可用，因此不作為主要方案。

### 方案 2: Alt+X Unicode 模式(⚠️ 可行但效率較低)

**原理**:輸入十六進制 Unicode 碼 → 按 Alt+X → Windows 轉換為字元

例如:`54C8 + Alt+X` → 哈(Unicode: U+54C8)

**優點**:
- ✅ 在記事本中也能用
- ✅ 支援所有 Unicode 字元(U+0000 - U+FFFF)
- ✅ 在 RDP 環境中有效

**缺點**:
- ❌ 每個中文字需要 4-5 個字元 + Alt+X(較慢)
- ❌ 可能在某些應用程式中不支援

**效能分析**:
- 單字輸入時間:約 170ms / 字
- 相比 IME Direct 慢約 3.4 倍

### 方案 3: IME Direct(CustomIn 報告)(✅ 最佳方案!)

**原理**:透過 EmulStick CustomIn 報告直接發送 UTF-8 文字

**優點**:
- ✅ 輸入速度最快(約 50ms / 字)
- ✅ 支援所有 Unicode 字元(包括 Emoji、特殊符號等)
- ✅ 不依賴應用程式特性(通用性最高)
- ✅ 不需要複雜的編碼轉換(直接使用 UTF-8)

**限制**:
- ⚠️ 需要官方開發的轉譯程式在背景執行
- ⚠️ 不是標準的 HID 協定，有時可能被移除或不支援
- ⚠️ 依賴特定硬體接收器的韌體支援

**實作**:
```kotlin
fun buildCustomInReport(text: String): List<ByteArray> {
    val utf8Bytes = text.toByteArray(Charsets.UTF_8)
    val reports = mutableListOf<ByteArray>()

    var offset = 0
    while (offset < utf8Bytes.size) {
        val chunkSize = minOf(16, utf8Bytes.size - offset)
        val chunk = utf8Bytes.copyOfRange(offset, offset + chunkSize)

        val report = ByteArray(19).apply {
            this[0] = 40  // Report ID
            this[1] = 32  // UNICODE_TEXT
            this[2] = chunk.size.toByte()
            chunk.copyInto(this, 3)
        }

        reports.add(report)
        offset += chunkSize
    }

    return reports
}
```

**效能對比**

| 方法 | 單字時間 | 「哈囉」時間 | 相對速度 |
|------|---------|------------|---------|
| Big5 Alt 碼 | ~600ms | ~1200ms | ⚠️ 較慢(12x) |
| Alt+X Unicode | ~170ms | ~340ms | ⚠️ 中等(6.8x) |
| **IME Direct** | **~50ms** | **~50ms** | ✅ **最快(1x)** |

## 第三個挑戰:遊戲手把模擬

後來我想到一個有趣的想法:能否將平板變成遊戲手把來玩 PC 遊戲?

研究 EmulStick 協定後,我發現它支援切換為 Xbox 360 控制器模式!

### XInput 模式切換

**切換指令**:
```kotlin
val command = byteArrayOf(
    0x50.toByte(),              // CMD_SET_EMULDEVICE
    systemId[6],
    systemId[7],
    0x5E.toByte(),              // VID 低位(0x045E)
    0x04.toByte(),              // VID 高位
    0x8E.toByte(),              // PID 低位(0x028E)
    0x02.toByte()               // PID 高位
)
```

### 虛擬手把介面設計

我設計了一個符合真實 Xbox 360 控制器佈局的虛擬手把介面。

**橫向模式**(符合真實 Xbox 360 布局):
```
┌────────────────────────────────────────────────────────┐
│  [LB]   [LT滑桿]              [RT滑桿]   [RB]         │  ← 上緣
├────────────────┬───────────────────────────────────────┤
│                │                                       │
│   ┌─────┐     │                    [Y]                │
│   │  ●  │     │                 [X]   [B]             │  ← 中央
│   └─────┘     │                    [A]                │
│   左搖桿      │                                       │
│                │                                       │
│      ↑        │                   ┌─────┐             │
│    ←   →      │                   │  ●  │             │
│      ↓        │                   └─────┘             │
│    D-Pad      │                   右搖桿              │
├────────────────┴───────────────────────────────────────┤
│      [Back]   [Start]   [L3]   [R3]                   │  ← 底部
└────────────────────────────────────────────────────────┘
```

**關鍵技術點**:

1. **虛擬搖桿實作**
```kotlin
Box(modifier = Modifier
    .size(130.dp)
    .pointerInput(Unit) {
        detectDragGestures(
            onDrag = { change, dragAmount ->
                // 計算搖桿位置(-1.0 ~ 1.0)
                val newX = (currentX + dragAmount.x).coerceIn(-maxRadius, maxRadius)
                val newY = (currentY + dragAmount.y).coerceIn(-maxRadius, maxRadius)

                // 發送到控制器
                onMove(newX / maxRadius, newY / maxRadius)
            },
            onDragEnd = {
                // 自動回中心
                onRelease()
            }
        )
    }
)
```

2. **扳機狀態同步問題與解決**

初期遇到一個 bug:調整左扳機時,右扳機被重置為 0;調整右扳機時,左扳機被重置為 0。

**原因**:每個扳機組件內部都有獨立的狀態,互相覆蓋。

**解決方案**(State Hoisting):
```kotlin
// 父布局同時持有左右扳機狀態
var leftTrigger by remember { mutableStateOf(0f) }
var rightTrigger by remember { mutableStateOf(0f) }

// 左扳機
TriggerSlider(
    value = leftTrigger,
    onValueChange = { newValue ->
        leftTrigger = newValue
        xInputController.setTriggers(newValue, rightTrigger)
    }
)

// 右扳機
TriggerSlider(
    value = rightTrigger,
    onValueChange = { newValue ->
        rightTrigger = newValue
        xInputController.setTriggers(leftTrigger, newValue)
    }
)
```

## 技術亮點總結

### 1. 協定研究與實作

**BLE GATT 服務架構**:
```
EmulStick Service (0xF800)
├── CH1 (0xF801) - 鍵盤 HID 報告(SingleKeyboard, 8 bytes)
├── CH2 (0xF802) - CustomIn 報告(IME Direct, 19 bytes) + 遊戲手把
├── CH3 (0xF803) - 滑鼠 HID 報告(MouseV1, 6 bytes)
├── CH4 (0xF804) - 觸控筆/多媒體 HID 報告
└── COMMAND (0xF80F) - 控制指令(身份驗證、模式切換)
```

### 2. 創新解決方案

- **中文輸入**:CustomIn 報告直接發送 UTF-8,繞過 HID 限制
- **遊戲手把模式**:完整的 Xbox 360 控制器模擬
- **單指最佳化**:大按鈕、簡潔介面、手勢操作

### 3. 模式整合

最終實現了**雙系統三模式**架構:

**系統 1: Unified Remote(網路遙控器)**
- 模式 1-A: TCP/IP 連線(透過 Tailscale)
- 模式 1-B: 藍牙 RFCOMM 連線

**系統 2: EmulStick(接收器模式)**
- 模式 2: BLE HID 連線
  - 組合模式:鍵盤 + 滑鼠
  - XInput 模式:Xbox 360 控制器
  - IME Direct 模式:中英文即時輸入

### 4. 跨平台挑戰：為什麼 iOS 版難以實現？

在完成 Android 版本後,我曾研究是否能將此專案移植到 iOS 平台。然而,我遇到了 **iOS 平台的根本性限制**：

#### iOS 不支援傳統藍牙 RFCOMM

**問題核心**：
- ❌ **iOS 不開放 Bluetooth Classic (RFCOMM/SPP)**：第三方 APP 無法使用傳統藍牙
- ✅ **iOS 僅支援 BLE (GATT)**：必須完全重新設計協定

這意味著:
- Unified Remote 的藍牙模式（RFCOMM）**無法在 iOS 上運作**
- 即使 PC 有 Unified Remote Server,iOS 也無法透過藍牙連線

#### 可行的替代方案

| 方案 | 可行性 | 開發成本 | 限制 |
|------|--------|---------|------|
| **TCP/IP 模式** | ✅ 完全可行 | ⭐ 低 | 需要網路環境（Tailscale 或區域網路） |
| **EmulStick BLE 模式** | ✅ 完全可行 | ⭐⭐ 中低 | 需要購買硬體接收器 |
| **自訂 BLE 協定** | ⚠️ 理論可行 | ⭐⭐⭐⭐⭐ 極高 | 需開發 PC 橋接程式 + iOS 傳輸層 |

#### 為什麼自訂 BLE 協定困難？

若要在 iOS 上實作類似 Unified Remote 的藍牙功能,需要：

1. **PC 端扮演 BLE Peripheral**：
   - ❌ Windows 對 BLE Peripheral 支援極差
   - ⚠️ 可能需要外接 Raspberry Pi 作為藍牙橋接器

2. **重新設計完整協定**：
   - 實作 BLE GATT Profile（自訂 Service/Characteristic）
   - 處理 MTU 限制與封包分段
   - 實作可靠傳輸（ACK/重傳機制）
   - 設計安全驗證機制

3. **開發 PC 橋接程式**：
   - 接收 BLE 封包
   - 轉換為 Unified Remote 協定
   - 轉送至 Unified Remote Server

**預估開發時間**：4-6 週以上

#### 結論

基於開發成本與技術限制,我決定：
- ✅ **Android 平台**：完整支援三種模式（TCP/RFCOMM/BLE）
- ⚠️ **iOS 平台**：建議使用 **TCP 模式**（透過 Tailscale）或 **EmulStick BLE 模式**（需硬體）
- ❌ **iOS RFCOMM 模式**：技術上不可行

**這也是為什麼原廠 Unified Remote iOS 版僅支援 Wi-Fi 模式的原因**：Apple 的平台限制使得藍牙遙控變得極為複雜。

## 開發心得與反思

### 成功關鍵

1. **完全模仿原廠架構**:不要過度最佳化,先求能動
2. **詳細日誌記錄**:診斷 APP 的詳細日誌是成功關鍵
3. **隔離測試**:創建獨立的診斷 APP,避免複雜邏輯干擾

### 避免的陷阱

1. **過度設計**:兩段式掃描聽起來很聰明,但實際上增加複雜度
2. **假設問題所在**:一開始以為是 UUID 問題,實際是掃描流程問題
3. **忽略細節**:`device.name` vs `scanRecord.deviceName` 的差異很關鍵

### 經驗教訓

- ✅ 技術探索需要耐心和細心
- ✅ 原廠程式碼是最好的參考資料
- ✅ 問題解決過程中的思考比結果更重要
- ✅ 完整的文件記錄對後續維護至關重要

## 專案成果

**程式碼規模**:
- Kotlin 原始碼:約 50 個檔案
- Compose UI 元件:15+ 個畫面/元件
- 總程式碼行數:約 10,000+ 行

**功能完成度**:
- ✅ TCP 連線:100%
- ✅ BLE 掃描與連線:100%
- ✅ BLE 滑鼠控制:100%
- ✅ BLE 鍵盤控制:100%
- ✅ BLE IME Direct:100%
- ✅ BLE XInput 模式:100%
- ✅ 虛擬手把 UI:100%

## 結語

這個專案從我個人的簡單需求出發,逐步演化為一個功能完整的多模式遙控解決方案。開發過程中遇到的每個技術挑戰,都成為學習和成長的機會。

### 為停更軟體注入新生命

當 Unified Remote 和 EmulStick 官方停止維護後,許多使用者面臨著「好用的工具逐漸不相容新系統」的困境。這個專案證明了:

- ✅ **開源精神的價值**:即使官方停更,社群仍能延續產品生命
- ✅ **協定研究的可行性**:透過技術分析,可以實作完全相容的客戶端
- ✅ **客製化的自由**:不受原廠限制,可以針對特殊需求最佳化
- ✅ **現代化改造**:使用最新技術棧（Kotlin、Jetpack Compose）重新實作

最重要的是,這個專案實現了它的初衷:為我自己（以及其他有身體限制的使用者）提供一個靈活、高效的 PC 控制方案。

**專案特色**:
- 🎯 針對身體限制使用者最佳化
- 🔀 靈活的多模式切換
- ⚡ 高效的中文輸入方案
- 🎮 創新的遊戲手把模擬
- 📱 現代化的 Material 3 介面

---

**專案定位**:
> 「為已停止維護的遙控軟體注入新生命：現代化復刻 + 硬體接收器整合」

**核心理念**:
- 📦 **延續產品生命**:當官方停止更新,社群接手維護
- 🔓 **協定開放**:研究並實作相容協定,打破原廠限制
- ♿ **無障礙最佳化**:針對身體限制使用者進行深度最佳化
- 🆕 **現代化技術**:使用最新工具重新打造,確保長期可維護

**技術棧**:Kotlin、Jetpack Compose、BLE GATT、HID over GATT

**最後更新**:2025-10-16