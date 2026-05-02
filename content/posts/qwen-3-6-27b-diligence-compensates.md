# 勤能補拙：Qwen 3.6 27B 幫我修好了 TrackPal

TrackPal 突然打不開了。

不是 crash、不是 bug，是完全打不開。macOS 26 之後的某個版本，AppKit 的行為變得非常奇怪——menu bar app 用 `MenuBarExtra` 的 `.window` 樣式時，popup 一關掉，整個 app 就被終止。

平常我都是請 ChatGPT 來調查跟調整。但這時候剛好額度用完了。

所以我換了 Qwen 3.6 27B。本地模型。

這件事能跑得通，是因為 M5 Max 128GB 到了。以前的 M5 基本款 32GB 跑不了這個體量的模型。M5 Max 的 600 GB/s 記憶體頻寬讓 27B 參數的模型可以在本地流暢推論。這才是我能夠完全脫離雲端、用本地模型 debug 的前提條件。

## 第一輪：找問題

它確實找到了問題所在。`MenuBarExtra` 配 `.window`，popup 關閉時 AppKit 會發送終止訊號。

然後它給了我的第一個解法。用了舊的 API。

我丟進 Xcode，編譯不過。不意外——macOS 26 的 API 變動不少，本地模型的訓練資料沒有覆蓋到。

## 第二輪：自我修正

但接下來發生的事，讓我覺得很神奇。

它不知道 macOS 26 的正確 API 是什麼。但它開始寫 Swift 程式碼，去測。

不是說「你應該用這個 API」，而是用 Swift 寫出偵測邏輯、寫出可行性驗證，然後根據編譯回饋去調。不知道正確答案就寫程式去測，測出哪個 API 才是對的。

最後測出來的解法是這樣的：

```swift
// applicationDidFinishLaunching 裡
NSApp.setActivationPolicy(.accessory)

// 加上這個回呼
@MainActor func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    TrackpadZoneScroller.shared.saveAdaptiveState()
    return .terminateCancel
}
```

`setActivationPolicy(.accessory)` 讓 app 變成系統匣模式，popup 關掉時 AppKit 不會把它關掉。`applicationShouldTerminate` 攔截終止訊號，回傳 `.terminateCancel`，確保 app 一直活著。

10 行程式碼。編譯過。跑起來。問題解決。

## 勤能補拙

很多人說這一代的 Qwen 3.6 自我修正能力很強。我不確定它是不是真的比 Claude Opus 4.6 好——客觀來說，訓練資料的廣度和即時性肯定有差距。

但它做了一件很簡單的事：不知道答案就寫程式去測。

這不叫聰明，這叫勤。

我知道 Qwen 3.6 27B 的參數量不大。它的知識庫沒有雲端模型那樣更新。它可能連 `setActivationPolicy` 的正確列舉值是什麼都不確定。但它沒有停在「我找不到文件」然後幫你寫一段講稿。它繼續跑，繼續試，繼續修正。

## 這個模式可以復用

TrackPal 的 bug 是這樣修的。今天這篇文章也是這樣產出來的。

寫文章的時候，它先用了「智能」這個詞，是中國用語，我糾正成「聰明」。產封面圖片的時候，第一次請求 timeout 了，第二次重丟就過了。搞 Facebook 發文流程的時候，它不知道 `INCLUDE_ORIGINAL_DATE` 是什麼，就自己去讀 `publish-facebook-post.js` 的原始碼，讀完才明白預設是關掉的。

整個過程沒有任何一次是「一次就對」。全是試錯、回饋、修正。但因為是在本機跑，沒有 token 計費的壓力，沒有額度用盡的焦慮，就是慢慢試到對就對了。

這才是本地模型真正的優勢。不是能力多強，而是你終於可以不怕花錢地犯錯。

當然，相較商業模型，它要多花一點時間。參數比較小，知識庫比較舊，有些問題要試更多輪才對。但這點時間成本，跟省下的訂閱費相比，完全值得。

所有流程都在本機跑，有好也有壞。壞的是你沒有 Opus 那種即時更新的知識、那種一問就對的精準度。好的是，你不需要擔心哪一天模型行為被改了、temperature 被拿走了、或你的額度又用完了。你丟進去，它就給你答案，錯了就再丟一次，沒有誰能從上面切斷你。

很多時候，這兩者的差距，比你想像的小。

---

*TrackPal 是開放原始碼的，[GitHub](https://github.com/jason5545/TrackPal)，MIT 授權。這個修復在 commit `6154d09`。*
