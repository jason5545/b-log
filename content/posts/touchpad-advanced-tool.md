# 觸控板進階工具：我如何用 C# 找回失去的單指捲動功能

## 從問題開始

前陣子寫了一篇文章[《當「現代化」成為無障礙的退步：精確式觸控板取消邊緣捲動功能》](https://b-log.to/business-insights/modernization-vs-accessibility/)抱怨 Microsoft 把精確式觸控板的邊緣捲動功能拔掉了，對我這種只能單指操作的使用者來說非常不便。當時我說「準備用 C# 寫一個小工具來解決」。

現在這個工具完成了。

> **感謝元新電腦的影片給我的啟發**
> 這個專案的靈感來自[元新電腦老闆的影片](https://www.youtube.com/watch?v=Fk6bacXyjEU)，他用 Claude 幫客戶寫小工具解決單指操作問題。那個故事讓我意識到：AI 時代，我們可以為自己的無障礙需求打造客製化解決方案。

這不只是「功能增強」工具，更是**無障礙輔助工具**。當大廠以「現代化」為名移除基本功能時，我決定自己把它找回來。

專案開源在 GitHub：[Touchpad Advanced Tool](https://github.com/jason5545/Touchpad-Advanced-Tool)

## 為什麼要自己寫？

很多人可能會問：「市面上沒有現成的方案嗎？」

有，但都不符合我的需求：
- **AutoHotkey 腳本**：延遲高、邏輯簡陋，容易誤觸
- **第三方驅動**：需要信任憑證，安裝複雜，相容性問題多
- **Synaptics 舊驅動**：新機器已經不支援，而且會和精確式觸控板衝突

我需要的是：
1. **精確的觸控追蹤**：能正確區分觸控板和滑鼠
2. **流暢的捲動體驗**：要有慣性滑動，不能卡卡的
3. **低延遲**：<10ms，不能有明顯的反應遲滯
4. **穩定可靠**：不會和系統衝突，也不會誤觸

所以我決定從零開始寫。

## 技術架構：如何從原始輸入到捲動動作

### MVVM + 依賴注入

我採用 **MVVM 架構搭配依賴注入**，讓每個功能都有清晰的職責分離。整個系統由六個核心元件組成：

1. **RawInputManager**：抓取觸控板的原始輸入
2. **MouseHookManager**：攔截系統滑鼠事件
3. **TouchpadTracker**：追蹤觸控狀態和手勢
4. **ScrollConverter**：將觸控移動轉換成捲動事件
5. **GestureRecognizer**：辨識手勢（捲動、角落點擊等）
6. **CornerActionExecutor**：執行角落自訂動作

每個元件都是獨立的，透過介面溝通，方便測試和維護。

```csharp
services.AddSingleton<IRawInputManager, RawInputManager>();
services.AddSingleton<IMouseHookManager, MouseHookManager>();
services.AddSingleton<ITouchpadTracker, TouchpadTracker>();
services.AddSingleton<IScrollConverter, ScrollConverter>();
```

這種設計讓我能夠輕鬆取代或測試個別元件，而不會影響整體系統。

## 關鍵技術難題

### 難題一：如何拿到觸控板的原始座標？

Windows 的問題是，當你用觸控板時，系統會自動把觸控事件轉換成滑鼠事件。你看到的只有游標移動，根本不知道手指是在觸控板的哪個位置。

但邊緣捲動需要知道「手指是否在觸控板右側邊緣」，所以我必須繞過這層抽象，直接讀取觸控板的原始輸入。

**解決方案：Windows Raw Input API**

我使用 Raw Input API 註冊 HID 數位板裝置（Digitizer），這樣就能收到觸控板的原始 HID 報告：

```csharp
RAWINPUTDEVICE[] rid = new RAWINPUTDEVICE[1];
rid[0].usUsagePage = 0x0D;  // HID_USAGE_PAGE_DIGITIZER
rid[0].usUsage = 0x05;      // HID_USAGE_DIGITIZER_TOUCH_PAD
rid[0].dwFlags = RIDEV_INPUTSINK | RIDEV_DEVNOTIFY;
rid[0].hwndTarget = windowHandle;

RegisterRawInputDevices(rid, 1, Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
```

註冊後，每當手指在觸控板上移動，系統就會發送 `WM_INPUT` 訊息，我解析這些訊息就能拿到：
- 聯絡點 ID（Contact ID）
- X/Y 座標（絕對座標）
- 觸控狀態（Tip Switch：手指是否接觸）

這些是系統抽象層之下的真實資料。

### 難題二：如何區分「真正的滑鼠」和「觸控板模擬的滑鼠」？

這是整個專案最棘手的問題。

當你用觸控板時，Windows 會同時發送兩種事件：
1. **Raw Input 事件**（原始觸控資料）
2. **滑鼠事件**（系統合成的游標移動）

但如果你真的接了一隻滑鼠，移動時只會有滑鼠事件，沒有 Raw Input。

問題是：**我要怎麼知道某個滑鼠事件是來自真實滑鼠，還是觸控板模擬的？**

如果判斷錯誤：
- ❌ 把真實滑鼠誤判成觸控板 → 用滑鼠會誤觸捲動
- ❌ 把觸控板誤判成滑鼠 → 邊緣捲動失效

**解決方案：30 毫秒時間視窗關聯**

我的策略是：**如果滑鼠事件的時間與 Raw Input 事件的時間差在 30ms 以內，而且當下有觸控活動，就判定這個滑鼠事件來自觸控板。**

```csharp
private bool IsMouseEventFromTouchpad(DateTime eventTime)
{
    var timeSinceLastRawInput = eventTime - _lastRawInputTime;
    return timeSinceLastRawInput.TotalMilliseconds < 30
        && _contactTracker.HasActiveContacts;
}
```

為什麼是 30ms？

- 觸控板輸入的輪詢頻率通常是 100-200Hz（5-10ms 間隔）
- 加上系統處理延遲，Raw Input 和滑鼠事件之間通常差 10-20ms
- 30ms 是一個安全的上限，既能容錯，又不會誤判

這個機制在實測中表現非常穩定，幾乎沒有誤判。

### 難題三：如何實現流暢的慣性捲動？

邊緣捲動不只是「手指動多少就捲多少」，還要有**慣性**。當你快速滑動後鬆手，頁面應該繼續滑一段距離再慢慢停下，就像 macOS 或手機的捲動體驗。

**物理模型：指數衰減**

我參考了 macOS 的實作，使用**指數衰減模型**：

```csharp
private void UpdateInertialScroll(double deltaTime)
{
    if (_inertialVelocity == 0) return;

    // 指數衰減：v(t) = v₀ × e^(-k×t)
    double decayFactor = Math.Exp(-DecayCoefficient * deltaTime);
    _inertialVelocity *= decayFactor;

    // 速度太小就停止
    if (Math.Abs(_inertialVelocity) < 0.1)
    {
        _inertialVelocity = 0;
        return;
    }

    // 產生捲動事件
    int scrollAmount = (int)(_inertialVelocity * deltaTime);
    SendScrollEvent(scrollAmount);
}
```

衰減係數（`DecayCoefficient`）設為 **0.20**，這是經過多次實測調整的結果：
- 太小（如 0.1）→ 滑太久，感覺失控
- 太大（如 0.5）→ 立刻停，沒有慣性感

0.20 剛好提供自然的減速曲線。

**速度追蹤**

為了計算鬆手瞬間的速度，我追蹤**最近 100ms 的移動歷史**：

```csharp
private void TrackVelocity(int deltaY, DateTime timestamp)
{
    _velocityHistory.Add((deltaY, timestamp));

    // 只保留最近 100ms 的記錄
    while (_velocityHistory.Count > 0
        && (timestamp - _velocityHistory[0].timestamp).TotalMilliseconds > 100)
    {
        _velocityHistory.RemoveAt(0);
    }
}
```

鬆手時，計算這 100ms 的平均速度作為初速度：

```csharp
private double CalculateInitialVelocity()
{
    if (_velocityHistory.Count < 2) return 0;

    int totalDelta = _velocityHistory.Sum(v => v.deltaY);
    double totalTime = (_velocityHistory.Last().timestamp
                     - _velocityHistory.First().timestamp).TotalSeconds;

    return totalDelta / totalTime;  // pixels per second
}
```

### 難題四：如何避免手勢衝突？

觸控板上有很多可能的操作：
- 單指邊緣捲動
- 單指角落點擊（自訂動作）
- 單指一般移動（游標）

如果不加控制，很容易發生衝突：比如你想點角落，結果觸發了捲動。

**解決方案：狀態機**

我用**狀態機**管理觸控狀態，確保同一時間只有一種手勢生效：

```
[None] ──手指在角落停留──> [CornerTap]
  │
  └──手指在邊緣移動──> [Scrolling]
  │
  └──其他情況──> [NormalCursor]
```

關鍵規則：
- 一旦進入 `Scrolling` 狀態，就不會再切換到 `CornerTap`
- 一旦進入 `CornerTap`，就會等待手指離開才執行動作
- 移動超過閾值（10 像素）才會進入 `Scrolling`，避免微小晃動觸發

```csharp
private void UpdateGestureState(Contact contact)
{
    switch (_currentState)
    {
        case GestureState.None:
            if (IsInCornerZone(contact) && !HasMoved(contact, 5))
                _currentState = GestureState.CornerTap;
            else if (IsInScrollZone(contact) && HasMoved(contact, 10))
                _currentState = GestureState.Scrolling;
            else
                _currentState = GestureState.NormalCursor;
            break;

        case GestureState.Scrolling:
            // 捲動中，不切換狀態
            break;

        case GestureState.CornerTap:
            if (HasMoved(contact, 10))
                _currentState = GestureState.NormalCursor;  // 移動取消點擊
            break;
    }
}
```

這個狀態機讓手勢辨識變得可預測，幾乎不會誤觸。

## 一些實作細節

### 智慧初始偏移

觸控板有個問題：**第一個座標事件的移動量永遠是 0**。

因為系統需要先確定手指的初始位置，才能計算移動量。但這會導致邊緣捲動的啟動有遲滯感。

我的解決方案是：**預測第一個 delta**。

根據後續移動的方向和速度，推測第一個 delta 應該是多少，然後補償進去：

```csharp
if (isFirstDelta)
{
    // 預測第一個 delta（根據第二個 delta）
    int predictedDelta = nextDeltaY / 2;  // 保守估計
    SendScrollEvent(predictedDelta);
}
```

這個小優化讓捲動啟動變得更即時。

### 結構化日誌

偵錯觸控板程式非常痛苦，因為事件發生得很快，而且涉及多個子系統。

我用 **Serilog** 做結構化日誌，每個事件都記錄完整的上下文：

```csharp
_logger.Information(
    "Raw Input: ContactID={ContactId} X={X} Y={Y} TipSwitch={TipSwitch} Time={Time:HH:mm:ss.fff}",
    contactId, x, y, tipSwitch, DateTime.Now
);
```

日誌每天自動輪替，保留 7 天：

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.File(
        "logs/touchpad-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7
    )
    .CreateLogger();
```

當使用者回報問題時，我可以直接要日誌檔案來重現問題。

### CI/CD 自動化

我用 **GitHub Actions** 實現自動化發布：

1. 推送 tag（如 `v1.0.0`）
2. 自動建置 Release 和 Debug 版本
3. 執行單元測試
4. 發布到 GitHub Releases

```yaml
- name: Build Release
  run: dotnet build --configuration Release

- name: Run Tests
  run: dotnet test --no-build --verbosity normal

- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    files: |
      bin/Release/net8.0-windows/TouchpadAdvancedTool.exe
```

這樣每次發布新版本，我只需要推 tag，其他都自動完成。

## 效能表現

最終的效能指標：
- **CPU 使用率**：0.5-1%（閒置時幾乎為 0）
- **記憶體佔用**：約 35MB
- **輸入延遲**：<10ms（從觸控到捲動）

對比 AutoHotkey 方案，CPU 使用率降低了 70%，延遲降低了 80%。

## 寫在最後

這個專案對我來說意義重大。

當大廠以「現代化」為名移除基本功能時，我們不是只能被動接受。AI 的普及讓客製化開發變得可行，即使是像我這樣身體有限制的開發者，也能為自己的需求打造解決方案。

如果你也是單指使用者，或者你也對這類技術感興趣，歡迎到 [GitHub](https://github.com/jason5545/Touchpad-Advanced-Tool) 看看。程式碼完全開源，也歡迎提出改進建議。

**技術統計**：
- 開發時間：約 3 天
- 程式碼行數：約 5,200 行
- 使用技術：C# / .NET 8.0 / WPF / ModernWpf
- 架構模式：MVVM + DI
- 授權：MIT

這證明了一件事：**科技應該為所有人服務，如果大廠做不到，我們就自己做。**
