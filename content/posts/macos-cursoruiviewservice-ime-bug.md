# macOS 輸入法突然卡死？CursorUIViewService 的 CPU 失控 bug


## 症狀

正在用 Mac 工作，突然發現輸入法切不了。點選選單列的輸入法圖示，選了鼠鬚管（Squirrel），畫面閃一下就跳回英文。快捷鍵切換也一樣，切過去 0.1 秒馬上彈回 ABC。不只是特定 app，連瀏覽器裡也無法切換——整個系統層級的輸入法都鎖死在英文。

## 排查過程

### 第一步：看程序狀態

```bash
ps aux | grep -i -E 'SCIM|IMK|TextInput|input.*method'
```

馬上看到異常：**CursorUIViewService 吃掉 130% CPU**，PressAndHold 也在吃 17%。

### 第二步：殺程序無效

嘗試 `kill` 和 `kill -9` 砍掉所有輸入法相關程序（TextInputMenuAgent、TextInputSwitcher、imklaunchagent、Squirrel、PressAndHold）。結果 CursorUIViewService 每次都會重生，而且重生後立刻又飆到 100% CPU。

### 第三步：確認 Squirrel 本身正常

查系統日誌，Squirrel 的 IMK XPC endpoint 成功註冊，啟動流程完全正常。Sparkle（自動更新框架）的 XPC 失敗是無關的。

### 第四步：用程式直接切換

寫了一段 Swift 呼叫 `TISSelectInputSource` API：

```swift
import Carbon
// ... 找到 Squirrel.Hant 的 TISInputSource
let err = TISSelectInputSource(source)
print("result: \(err)")  // 回傳 0（成功）
```

API 回傳成功，但 `AppleSelectedInputSources` **完全沒變**。系統層級有東西在攔截。

### 第五步：找到根因

在 `/Library/Logs/DiagnosticReports/` 找到三份 `cpu_resource.diag` 報告。關鍵資訊：

**view count 無限增長**：從系統日誌看到 `updateCursorAccessories` 被持續呼叫，view count 從 2 一路漲到 1857+。

**Call stack 卡在 Auto Layout**：

```
NSStackView updateConstraints
  → NSLayoutConstraint diff/sort
    → qsort（排序 1800+ 個約束）
```

每次 `updateCursorAccessories` 都新增 view，Auto Layout 約束數量無上限增長，排版計算量指數增加，最終 CPU 100% 卡死。

**觸發來源**（報告中的 On Behalf Of）：Claude 桌面版和 Helium 瀏覽器。這兩個 app 的文字輸入區域持續觸發游標附件更新。

## 根因

這是 **macOS Sonoma 引入的已知 bug**，延續至 Sequoia 和 Tahoe（macOS 26）。

macOS Sonoma 重新設計了文字游標，加入了語言指示器等視覺元素，由 CursorUIViewService 這個 XPC 服務負責渲染。但這個服務有記憶體洩漏的問題——cursor accessory 的 view 只增不減，Auto Layout 約束隨之無限累積，最終拖垮整個 TextInput 子系統。

CursorUIViewService 佔滿 CPU 後，輸入法切換的事件處理被阻塞，導致全系統無法切換語言。登出也無法解決，只有重啟才行。

## 永久修法

停用重新設計的游標，從根源避免這個 bug：

```bash
sudo defaults write /Library/Preferences/FeatureFlags/Domain/UIKit.plist \
  redesigned_text_cursor -dict-add Enabled -bool NO
```

執行後重啟即可。這會關掉 Sonoma 引入的新游標樣式（包括語言指示器小箭頭），回到傳統游標。CursorUIViewService 就不會再失控。

## 結論

這次除錯的收穫是：當輸入法切換失效時，不要只看輸入法本身，要往更底層的 TextInput 子系統查。`cpu_resource.diag` 報告裡的 call stack 和 On Behalf Of 資訊是找到根因的關鍵。

