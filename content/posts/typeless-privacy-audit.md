# 我對 Typeless v1.0.0 進行了完整逆向分析——身為重度語音輸入使用者，這是我的發現

## 前言：為什麼這件事跟我切身相關

我是一個 31 歲的軟體工程師，天生身體限制讓我只有右手食指能正常活動，日常需要使用輪椅。打字對我來說成本極高——每個字都是一根手指敲出來的。語音輸入不是錦上添花的功能，而是我工作和生活的核心工具。

我從 2026 年 1 月開始使用 Typeless，付費訂閱了 Pro 年費方案（144 美元）。它的語音辨識準確率確實接近完美，尤其是中英混合的場景，幾乎不需要修改就能直接使用。作為一個靠語音輸入維持工作效率的人，Typeless 一度是我的首選工具。

但最近，日本工程師 @medmuspg 對 Typeless macOS 版 v0.9.3 進行了逆向分析，發現了嚴重的隱私問題。這些發現隨後被台灣科技媒體報導。

我讀完報導後，決定對我自己 Mac 上安裝的 **v1.0.0（build 79）** 進行獨立的完整審計。以下是我的發現。

---

## 審計環境

- **裝置**：MacBook Pro（Apple Silicon）
- **作業系統**：macOS 26.2
- **Typeless 版本**：v1.0.0（build 79），2026 年 2 月 10 日安裝
- **使用期間**：2026/1/17 至 2026/2/12（審計時間點），累積約 2,100 筆語音輸入記錄
- **訂閱方案**：Pro 年費（Stripe 付款）
- **審計工具**：Claude Code + SQLite3 + npx asar + strings + otool

---

## 技術架構概述

Typeless 是一個 **Electron 應用程式**（`Info.plist` 中 `NSPrincipalClass` 為 `AtomApplication`，含 `ElectronAsarIntegrity`）。它的核心架構是：

- **前端**：Electron 渲染程序（HTML/JS），包含浮動工具列、主介面、引導頁面
- **後端**：Electron 主程序（`dist/main/index.js`，254KB 壓縮後）
- **原生模組**：4 個自行編譯的 macOS 動態函式庫（`.dylib`），透過 **koffi**（Node.js FFI 函式庫）呼叫
- **資料庫**：SQLite（透過 `@libsql` 和 `drizzle` ORM），本地檔案 160MB
- **錯誤追蹤**：Sentry（100% 錯誤取樣率）

4 個原生 dylib 分別負責：

| 模組 | 功能 |
|------|------|
| `libContextHelper.dylib` | 取得聚焦應用資訊、讀取螢幕可見文字、讀取輸入框內容 |
| `libInputHelper.dylib` | 文字插入、刪除、取得選取文字、模擬 Cmd+C |
| `libKeyboardHelper.dylib` | 全域鍵盤事件監控 |
| `libUtilHelper.dylib` | 音訊裝置管理、靜音控制、權限檢查 |

這些 dylib 直接呼叫 macOS 的 Accessibility API 和 Core Graphics API，是整個隱私問題的核心。

---

## 發現一：螢幕可見文字擷取（風險等級：極高）

### 技術細節

`libContextHelper.dylib` 暴露了以下函式：

- `getFocusedVisibleText(maxChars, timeout)` — 透過 Accessibility API 遞迴讀取目前聚焦視窗的所有可見文字
- `getFocusedElementRelatedContent(beforeChars, afterChars, timeout)` — 讀取輸入框游標前後的文字內容

程式碼中的呼叫參數：
- 可見文字上限：**10,000 字元**
- 輸入框前後文字：各 **1,000 字元**

### 這意味著什麼

每次你按下語音輸入的快捷鍵，Typeless 不只錄下你的聲音——它同時會：

1. 讀取你螢幕上目前視窗最多 10,000 字元的可見文字
2. 讀取你輸入框游標前後各 1,000 字元的內容
3. 將這些資料打包成 `audio_context`，連同錄音一起上傳到伺服器

Typeless 聲稱這是為了「提高語音辨識準確率」——理解你正在做什麼，讓 AI 更準確地判斷你想輸入的內容。從技術角度，這確實有效。但代價是什麼？

如果你在寫程式時用語音輸入，你的原始碼被上傳了。
如果你在讀信時用語音回覆，信件內容被上傳了。
如果你在查看公司內部系統時用語音輸入筆記，系統畫面上的文字被上傳了。

### 黑白名單機制

程式碼中確實有 app 黑白名單機制，控制哪些應用會收集可見文字：

**硬編碼黑名單**（不收集螢幕文字的 app）：
- Sublime Text
- 微信（WeChat）
- Microsoft Excel
- WPS Office
- Zed 編輯器

**硬編碼白名單**（特別收集的 app）：
- Slack
- Apple Mail
- Figma
- ChatGPT（OpenAI）
- 以及一個 `com.todesktop.230313mzl4w4u92`（未知應用）

但關鍵問題是：**這些名單會從伺服器動態更新**（透過 `/app/get_blacklist_domain` 端點）。也就是說，Typeless 的伺服器可以隨時改變哪些 app 被監控、哪些不被監控。今天不在監控範圍的 app，明天可能就被加進去了，而你完全不會知道。

### 本地資料庫中的痕跡

資料庫 schema 中有 `ax_text` 和 `ax_html` 兩個欄位，設計用來儲存透過 Accessibility API 擷取的文字和 HTML 內容。在我的 v1.0.0 資料庫中，這兩個欄位全部為空（0 筆有資料）。

但 `audio_context` 欄位每筆記錄都有平均約 17KB 的**加密資料**（格式為 Base64 編碼的 IV + 密文，範圍從 1.5KB 到 57KB 不等）。螢幕文字很可能就包含在這個加密的 context 中，只是不再以明文儲存在本地。

---

## 發現二：完整瀏覽器 URL 追蹤（風險等級：高）

### 資料庫證據

在我的約 2,100 筆記錄中，**76 筆包含完整的瀏覽器 URL**。以下是部分被記錄的 URL（已移除涉及個人帳號的項目）：

```
https://adguard.com/zh_tw/adguard-browser-extension/edge/overview.html
https://docs.google.com/document/d/docs/edit
https://iterm2.com/
https://support.apple.com/zh-tw/102589
https://www.codeweavers.com/crossover/download
https://www.google.com/search
https://www.parallels.com/hk/products/desktop/trial/
https://www.reddit.com/r/macapps/comments/...
```

上面只是看起來無害的部分。實際上資料庫裡還記錄了更敏感的內容——包括 OAuth 授權頁面的完整 URL、線上客服系統的 API 端點（URL 路徑中可能包含身份識別資訊）、個人信箱的完整路徑，以及社群平台的瀏覽記錄。這些我選擇不在此公開，但它們確實都被 Typeless 記錄在本地資料庫中。

### 資料庫 schema 的欄位設計

URL 追蹤不是意外——它是刻意設計的。history 表有 5 個專門的瀏覽器追蹤欄位：

```sql
focused_app_window_title      -- 視窗標題
focused_app_window_web_title  -- 網頁標題
focused_app_window_web_domain -- 網域
focused_app_window_web_url    -- 完整 URL
focused_app_bundle_id         -- 應用程式 Bundle ID
```

而且資料庫建了多個複合索引，專門用來按「使用者 + app + 網域」的組合查詢：

```sql
CREATE INDEX idx_history_user_app_name_web_domain_status_created_at
ON history (user_id, focused_app_name, focused_app_window_web_domain, status, created_at);
```

這不是偶然的資料收集——這是結構化的使用者行為分析。

---

## 發現三：全域鍵盤事件監控（風險等級：高）

### 技術細節

`libKeyboardHelper.dylib` 暴露了以下函式：

```
startMonitor(callback)       // 開始監控全域鍵盤事件
stopMonitor()                // 停止監控
processEvents()              // 處理事件佇列
updateTargetShortcuts(json)  // 更新監控的快捷鍵
setWatcherInterval(ms)       // 設定監控間隔（程式碼中設為 5ms）
```

回調函式接收的資料包含：`keyCode`、`keyName`、`enKeyName`、`isKeydown`。

程式碼中的啟動條件：

```javascript
ct.isTrustedAccessibilityClient(!1) && this.startInputListener()
```

也就是說，只要 Typeless 有輔助功能權限（它運作所必需的），鍵盤監控就會自動啟動。

### 這是不是 Keylogger？

從技術基礎設施來說，它具備完整的鍵盤記錄能力。Typeless 可能只用它來偵測快捷鍵（如 Fn 鍵觸發語音輸入），但底層的 `CGEventTap` 是系統級的——它能看到所有按鍵事件，不只是 Typeless 的快捷鍵。

配合定期同步機制：

```javascript
startPeriodicSync() {
    this.syncIntervalId = setInterval(() => {
        this.broadcastKeyboardEvent(this.pendingPressingKeys)
    }, this.SYNC_INTERVAL)
}
```

鍵盤狀態會定期廣播到 Electron 的渲染程序中。即使目前的程式碼可能只篩選特定快捷鍵，這個基礎設施隨時可以擴展為完整的按鍵記錄器，而使用者不會收到任何通知。

---

## 發現四：完整應用程式使用行為記錄

### 資料庫統計

在 27 天的使用期間（2026/1/17–2026/2/12），Typeless 記錄了我在 **35 個不同應用程式**中的語音輸入行為：

| 應用程式 | 使用次數 | 佔比 |
|----------|---------|------|
| iTerm2 | 499 | 23.8% |
| Claude | 415 | 19.8% |
| Helium（瀏覽器） | 333 | 15.9% |
| Codex | 253 | 12.1% |
| LINE | 175 | 8.3% |
| 終端機 | 149 | 7.1% |
| Safari | 82 | 3.9% |
| 訊息 | 56 | 2.7% |
| QQ | 34 | 1.6% |
| VS Code | 24 | 1.1% |
| 其他 25 個 app | 79 | 3.8% |

這張表揭示了我完整的數位生活輪廓：
- 我大量使用終端機和 AI 工具（iTerm2 + Claude + Codex 佔 55%）→ 軟體工程師
- 社交通訊以 LINE 和訊息為主 → 台灣使用者
- 有使用 QQ → 可能與中國有聯繫
- 使用 Helium 瀏覽器 → 偏好浮動視窗瀏覽

光是這些 metadata，不需要看任何語音內容，就能建立出相當精確的使用者畫像。

---

## 發現五：100% 雲端處理，無本地模型

### 驗證方式

1. 搜尋整個 app bundle（186MB 的 app.asar + 原生模組），找不到任何 ASR 模型檔案（.bin、.onnx、whisper 相關檔案）
2. 所有語音辨識請求都發送到 `api.typeless.com`
3. 主要有兩種傳輸方式：
   - **HTTP POST**：音訊壓縮為 OGG/Opus 後上傳到 `/ai/voice_flow`
   - **WebSocket**：即時音訊串流到 `wss://` 端點

### 上傳的資料內容

每次語音輸入，以下資料會被打包傳送：

```
audio_file         → OGG/Opus 壓縮音訊
audio_context      → JSON，包含：
  ├── device_environment → OS版本、CPU、記憶體、語系
  ├── active_application → app名稱、Bundle ID、視窗標題、瀏覽器URL
  ├── visible_screen_content → 螢幕可見文字（最多 10,000 字元）
  ├── text_insertion_point → 游標位置、選取文字、輸入框前後文字
  └── context_metadata → 各項擷取時間戳和延遲
audio_metadata     → 裝置名稱、音訊參數
mode               → voice_transcript / voice_command / voice_translation
```

---

## 發現六：使用者編輯行為追蹤

Typeless 不只追蹤你的語音輸入，還追蹤你之後**怎麼修改 AI 的輸出**。

`/user/traits` API 端點會傳送：

| 欄位 | 內容 |
|------|------|
| `refined_inserted_text` | AI 原始插入的文字 |
| `original_input_box` | 插入時輸入框的狀態 |
| `edited_input_box` | 你修改後的輸入框狀態 |
| `active_application` | 當時使用的應用程式資訊 |

這意味著 Typeless 能夠學習到：你在什麼 app 裡、AI 給了你什麼文字、你改成了什麼。這是一個完整的使用者行為回饋迴圈。

---

## 發現七：加密方式與金鑰管理

### 加密演算法

API 請求簽名和本地資料加密使用了兩套體系：

- **SM2/SM3/SM4**：中國國家密碼管理局制定的密碼標準。其中 SM3 被用於每次 API 請求的簽名（`sm3_sign` 欄位），SM2 和 SM4 的加解密函式也已打包在程式碼中可供呼叫。
- **CryptoJS AES + HMAC-SHA1**：用於本地資料加密和簽名流程的第一步。

SM 系列本身是合法的密碼學標準，安全性沒有問題。但值得注意的是，這些算法主要用於**中國合規場景**（如金融系統、政府系統等需要符合中國國密標準的場合），國際軟體更常使用 SHA-256、AES-256、ECDSA 等標準。一個面向全球市場的語音輸入產品選用中國國密算法，是個不尋常的技術選擇，可能暗示開發團隊或後端基礎設施與中國有所關聯。

此外，這三個算法的實作是直接內嵌在 JavaScript 原始碼中（不是來自獨立的 npm 套件），意味著這是刻意整合的選擇，而非偶然引入的依賴。

### 金鑰硬編碼

加密金鑰直接寫在 JavaScript 原始碼中：

```
AES Key: "334bf19f92ebc362170cdceff72f7bddfae94cb8c84eb52a51131aa3"
HMAC Key: "a55c8ee8615b1469a02e8acd36fd40397fd6e5f1b66b852222cc9fcd"
```

這些金鑰可以被任何人從 app.asar 中提取。本地加密的 `audio_context` 和 `debug_info` 如果使用這些金鑰，那加密形同虛設——任何人拿到你的資料庫檔案都能解密。

### Sentry 錯誤追蹤

Sentry 的設定中，`sendDefaultPii` 設為 `false`（聲稱不傳送個人識別資訊），但 `sampleRate` 設為 `1`（100% 的錯誤都會上報）。錯誤報告中可能包含使用者環境資訊和部分程式執行上下文。

---

## 發現八：Info.plist 權限宣告

Typeless 在 Info.plist 中宣告了以下權限：

| 權限 | 描述 |
|------|------|
| 麥克風 | "Typeless requires access to your microphone for voice commands." |
| 螢幕錄製 | "Typeless requires screen recording permission to capture and share your screen." |
| 相機 | "This app needs access to the camera" |
| 藍牙 | "This app needs access to Bluetooth" |

麥克風權限是核心功能所必需的。但**螢幕錄製**和**相機**權限的用途就值得質疑了。程式碼中確實匯入了 Electron 的 `desktopCapturer` API，雖然在目前版本中沒有找到直接的截圖呼叫，但宣告了權限就代表隨時可以啟用。

此外，`NSAppTransportSecurity` 設定了 `NSAllowsArbitraryLoads: true`（允許任意網路連線），以及 localhost 的 HTTP 例外——後者用於 Electron 的本地開發伺服器。

---

## 與 v0.9.3 的比較

日本工程師 @medmuspg 分析的是 v0.9.3，我分析的是 v1.0.0。主要差異：

| 項目 | v0.9.3（報導） | v1.0.0（我的分析） |
|------|----------------|-------------------|
| `collectVisibleTexts` 函式 | 存在，明確命名 | 改名為 `getFocusedVisibleText`，功能相同 |
| `CGEventTap` 字串 | 在二進位檔中可見 | 移入原生 dylib，JS 層看不到 |
| `ax_text` 本地儲存 | 明文儲存 | 欄位存在但為空，可能改為只在加密的 `audio_context` 中 |
| URL 記錄 | 有 | 有，76 筆確認 |
| 鍵盤監控 | 有 | 有，透過 `libKeyboardHelper.dylib` |
| 本地 ASR 模型 | 無 | 無 |

**結論**：v1.0.0 並沒有根本性地改善隱私行為。主要改變是把一些敏感操作從 JavaScript 移入原生 dylib（更難被逆向分析），以及可能將螢幕文字從本地明文儲存改為加密儲存。核心的資料收集行為沒有改變。

---

## 對我個人的影響評估

考慮到我的使用情境：

1. **NDT 檢測報告系統**：我日常開發和維護的是非破壞性檢測報告查詢系統（Next.js 全端應用）。用語音輸入時，螢幕上可能顯示檢測報告數據、客戶資訊、系統內部 API 等公司機密資料。
2. **程式碼和 API 金鑰**：我在 iTerm2 和 Claude 中的語音輸入佔了 43.5%。終端機畫面上可能包含環境變數、API 金鑰、資料庫連線字串等敏感資訊。
3. **通訊內容**：LINE 和訊息 app 的使用佔 11%，語音輸入時聊天視窗的內容可能被擷取。
4. **登入和授權流程**：資料庫中記錄了 OAuth 授權頁面和客服系統的完整 URL，這些都是涉及身份驗證的敏感操作。

---

## 我的因應措施

### 立即行動

1. **停用 Typeless**：關閉應用程式
2. **撤銷權限**：系統設定 → 隱私與安全性 → 撤銷輔助功能和螢幕錄製權限
3. **保留資料庫**：`typeless.db`（160MB）暫時保留作為證據，之後會刪除
4. **檢查 Stripe 訂閱**：考慮是否要求退費

### 短期替代方案

**Superwhisper** 是目前最接近的替代品——支援完全本地推論模式（使用 Whisper 模型在本機運算），不需要將音訊上傳到雲端。這是最快能讓我恢復語音輸入工作流的方案。

### 長期方案

我之前開發了一個叫 **xvoice** 的跨平台語音輸入系統，架構是 Silero VAD（語音活動偵測） + faster-whisper（語音辨識） + LLM 語意校正。當時因為 Typeless 的準確率太好而暫停開發。

現在有了充分的理由重啟它。而且這次我知道 Typeless 的「秘密武器」是什麼了——不是更好的 ASR 模型，而是用螢幕上下文資訊來校正辨識結果。這個思路完全可以用更隱私的方式實現：

- 只讀取**當前輸入框**的文字（透過 Accessibility API 的 `AXValue`），不讀取整個螢幕
- 上下文資料只餵給**本地 LLM**（如 Llama / Qwen / Gemma），永遠不離開電腦
- 在 Apple Silicon 上用 **MLX Whisper** 做語音辨識，效能完全足夠

---

## 給其他 Typeless 使用者的建議

1. **如果你的工作涉及任何機密資料**（公司內部系統、客戶資料、原始碼、財務資訊），請立即停用 Typeless。螢幕文字擷取功能意味著你的機密資料可能已經被傳送到 Typeless 的伺服器。

2. **如果你只是一般日常使用**，也請認真考慮你是否願意讓一個透明度極低的公司擁有你的瀏覽記錄、應用程式使用習慣、以及螢幕上顯示的文字內容。

3. **檢查你的本地資料庫**：`~/Library/Application Support/Typeless/typeless.db`，用 SQLite 可以查看所有被記錄的資料。

4. **撤銷權限後再移除**：先到系統設定撤銷輔助功能和螢幕錄製權限，再解除安裝。

---

## 結語

Typeless 的語音辨識確實很好用——但我現在知道了原因不只是他們的 AI 模型好，更是因為他們把我螢幕上的一切都送上去了。

一個語音輸入工具，需要知道我在瀏覽什麼網頁嗎？需要讀取我螢幕上的 10,000 個字嗎？需要記錄我用了哪些 app 嗎？需要追蹤我怎麼修改它的輸出嗎？

如果你的答案也是「不需要」，那該是停用的時候了。

---

*本文的技術分析透過 Claude Code 輔助進行。所有資料均來自本地安裝的 Typeless v1.0.0 app bundle 和本地 SQLite 資料庫，未涉及任何網路攔截或伺服器端分析。*
