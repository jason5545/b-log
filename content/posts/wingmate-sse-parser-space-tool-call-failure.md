# 一個空格讓 tool call 全部失效：Wingmate 的 SSE parser 事故

Wingmate 是我在做的 Android app。另一邊我還有個 CopilotChat，是 Apple 平台的原生 LLM chat client，SwiftUI 寫的。它的起點其實是 GitHub Copilot——當初我離開 claude.ai，走 Copilot 當中間層繼續用 Claude，然後發現 GitHub 沒有像樣的 iOS client，就自己做了一個。CopilotChat 從 Copilot device-flow OAuth 起家，再往外接 120 多家 provider，定位是 chat + coding mode 的桌面/手持 client：agent 能讀寫 workspace 檔案、跑 MCP tool、在 macOS 上跑 bash，但 build 這件事還是交給宿主機的 Android Studio / Xcode。

但這條路走下來，我對 Copilot 這個 provider 的信任是遞減的。同一個 Claude Opus，Anthropic 官方 API 給 1M context window，GitHub 砍到 192K，第三方 client 再砍到 144K。我想查原因，用 VS Code 的 client ID 做 OAuth 測試，GitHub 直接 403，錯誤訊息只丟一個 TOS 首頁叫我自己去翻。然後 4 月 20 號，GitHub 把 Opus 從 Pro 完全移除，Pro+ 只留 Opus 4.7，同時暫停三個方案的新使用者註冊。洩漏的內部文件寫得很直白：有些使用者單一請求的成本已經超過他們整個月的訂閱費，長期要轉向按 token 計費。

這不是 GitHub 特別惡意，是訂閱制的內建邏輯——你租的不是模型能力，是「今天這個版本的存取權」，條款隨時能改。我之前寫過一篇〈雲端 AI 的承諾有保存期限〉，結論是：出口只有降低對任何單一雲端服務的依賴深度。

Wingmate 就是這個結論的 Android 版。它刻意不走 CopilotChat 的起點。GitHub Copilot 的 device-flow OAuth、`api.githubcopilot.com`、Copilot model sync，在 Wingmate 的產品邊界裡是 explicitly out of scope。provider 先接 OpenAI-compatible、Anthropic-compatible、Gemini——這些是你帶自己的 API key、自己控制計費的管道，不經過一個會隨時改條款的中間層。

而且這一年下來，這條路已經不只是「理論上可以帶自己的 key」。有一批新的 coding plan 訂閱冒出來，正好填了「不想被單一平台綁，但又不想自己架推理」的中間地帶。OpenCode Go 一個月 $5 起跳，給你 GLM-5.2、MiniMax M3、DeepSeek V4、Kimi K2.7 這些開放原始碼 coding 模型的 quota 制存取。Z.AI 的 GLM Coding Plan 從 18 元人民幣起，走 OpenAI-compatible endpoint，base URL 是 `https://api.z.ai/api/coding/paas/v4`，直接塞進任何支援 custom base URL 的 client 就能用。MiniMax 也有自己的 Coding Plan，Starter / Plus / Max 三階，5 小時一個 prompt quota window，M2.1 為主力模型。

這些 plan 的共通點是：你是跟模型方直接訂閱，不是跟一個會偷偷砍你 context window 的中間層訂閱；計費是 prompt quota 或 token quota，條款寫在明面上；endpoint 全部是 OpenAI-compatible 或 Anthropic-compatible，不需要特殊 OAuth。Wingmate 的 `ProviderTransform` 現在對 `opencode/glm-5.2` 這種 model id 有專門處理——GLM-5.2 雖然在 models.dev 上標 `reasoning: false`，但實際上吃 reasoning effort 參數，所以 hardcode 成暴露 High / Max 兩個 variant；MiniMax 的 model id 則走 no-effort 路線，因為它不吃 reasoning effort 欄位。這些差異就是 OpenAI-compatible 在現實裡長什麼樣——協議相容，不代表每個 provider 的 model 行為一致。

這也是為什麼後面那個 SSE parser bug 對 Wingmate 特別痛。Wingmate 接的 provider 比 CopilotChat 雜得多：OpenAI 官方、Z.AI、MiniMax、OpenCode Go、OpenRouter、任何自架 OpenAI-compatible endpoint。每一家 stream 出來的 bytes 都可能有細微差異，而我的 parser 只認一種。

但 Wingmate 真正更大的目標不只是換 provider。它想在手機上把「編譯環境」也吃進來。repo 裡有一個獨立的 `:builder` module，targetSdk 28、sideload-only，本質是一個 Termux-like runtime：在手機的 app-private prefix 裡跑 OpenJDK 21、Gradle 9.6.1、AAPT2、D8、apksig。主 app 有一個 `build_gradle_project` tool，會把目前 workspace 打成 zip、透過 signature-protected broadcast 交給 builder companion，builder 跑完 `assembleDebug` 再把 APK/AAB/AAR 連 log 寫回來。目前已在 Android 16 實機離線跑通 Compose、Room+KSP、Hilt+KSP、Hilt+KAPT、multi-module、version catalog、product flavors、custom signing、Kotlin DSL，連 Room query verifier 都靠自編的 `sqlite-jdbc:3.41.2.2-wingmate1` Android/aarch64 bionic native 打穿了。

這個脈絡會直接影響後面怎麼讀這次事故。在 CopilotChat 那種純 chat client 上，tool call 掛掉大概就是少查一次網路、少讀一個檔案。在 Wingmate 上，tool call 是 build pipeline 的觸發器——agent 不呼叫 `build_gradle_project`，整個手機端編譯流程就不會啟動。所以「agent 看起來知道要用 tool 卻沒用」這個症狀，對 Wingmate 來說不是體驗問題，是核心功能斷線。

6 月 29 號晚上推了一版 Android build 上去，裝完之後 agent 還能思考、能 stream 文字出來，但 tool call 不執行了。

不是模型不決定呼叫 tool，也不是 executor 掛掉。Provider 那端 `finish_reason` 確實是 `tool_calls`，但我這邊重建不出一個完整可執行的 tool call——因為 SSE parser 把某些合法的 stream line 直接 skip 掉了。

## 症狀長什麼樣

最直觀的感受是：agent 看起來知道要用 tool，講了一堆「我來查一下」「我用某個 tool」，然後什麼都沒發生。對 Wingmate 來說，這代表 `build_gradle_project`、`git_commit`、`web_fetch` 這些動作全部發不出來，builder companion 再閒也沒事幹。

重現之後 logcat 裡看到的是這個：

```text
Provider finished with tool_calls but ToolCallLoop built no executable tool calls.
pending=index=0 idLen=0 nameLen=0 argumentsLen=17
```

`idLen=0`、`nameLen=0`，但 `argumentsLen=17`。意思是：arguments 有收到 17 個字元，但 tool 的 id 和 name 是空的。這種狀態下我不可能去執行一個不知道是誰的 tool，只能 abort 那一輪。

## 根因：parser 對 SSE 格式太嚴

原本的判斷是這樣寫的：

```kotlin
if (!line.startsWith("data: ")) continue
val payload = line.removePrefix("data: ")
```

只接受 `data: ` 開頭——`data` 後面要有冒號、還要有空白。問題是有些 OpenAI-compatible provider 回的是 `data:{...}`，冒號後面沒空白。

這兩種寫法在 SSE 規範裡都是合法的 data framing，空白不是強制。我的 parser 把它當成強制了。

而且 tool call 是分 chunk stream 進來的，漏掉一個 chunk 就可能整個 reconstruct 失敗。這次剛好漏掉的是帶 tool name 和 id 的那幾行，arguments 因為在別的 chunk 裡反而收到了。

## 為什麼以前沒事

因為以前那個 provider / gateway 剛好回的就是 `data: {...}`，帶空白。我的 parser 跟它的格式對得上，就沒人發現我其實只認一種寫法。

6 月 29 號 provider 那邊行為改了，stream 的 shape 變了，不是變成違規格式，只是變成我沒 cover 的那種合法格式。bug 一直在 Wingmate 這邊，是 provider 的改動把它暴露出來。

所以正確的 framing 不是「provider 改壞了相容性」，而是「我的相容性本來就寫窄了，只是沒人踩到」。

## 修法

`OpenAiSseParser` 現在用這個抽 payload：

```kotlin
private fun String.sseDataPayload(): String? {
    if (!startsWith("data:")) return null
    return removePrefix("data:").trimStart()
}
```

只認 `data:` 開頭，後面有沒有空白都 `trimStart()` 吃掉。`data: {...}` 和 `data:{...}` 都進得來。

另外 `ToolCallLoop` 也加了一層防禦：空的 tool id / name 不會再去覆蓋已經累積的 pending state，然後加了 diagnostic log，當 provider finish 在 `tool_calls` 但 reconstruct 不出可執行 tool call 時，會把 incomplete 狀態記下來。

這 log 早該加。第一次發生時我花了不少時間才確定問題是出在 parser 跟 tool-call 之間，而不是 executor 或 model decision。

## 測試

補了 unit test 覆蓋這次 trigger 的 stream 格式，用 `./gradlew testDebugUnitTest assembleDebug` 驗過，debug build 裝上 device 確認 tool call 回來了，才推上 `main`。

fix 本身很小，一個字串判斷的事。但暴露出來的問題是：我之前把 OpenAI-compatible API 當成 byte-for-byte 一樣在對，而不是 protocol-compatible 在對。協議相容不代表每個 provider 吐出來的 bytes 都長一樣。

## 還沒做的

- 更多 parser fixture：id、name、arguments 分別在不同 chunk 進來的 fragment 情況。
- 舊版 `function_call` streaming 如果要支援的話也要測。
- 開發 build 裡，當 `finish_reason=tool_calls` 但重建不出 tool call 時，直接 surface 一個內部 debug 訊息，不要像這次一樣安靜。

這次的教訓其實很老派：parse 別人的協議時，不要假設對方會用你預期的精確格式。spec 寫的是 `data:`，不是 `data: `。一個空格的差，夠你 debug 一個晚上。在 Wingmate 這種 tool call 等於 build pipeline、而且 provider 橫跨十幾家的專案上，這種安靜的失敗成本特別高——agent 不呼叫 tool，你不會看到 build error，只會看到一個看似在思考卻什麼都沒做的 app。
