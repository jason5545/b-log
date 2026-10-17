# Claude Code 開始分得出是分類器擋的還是規則擋的，我九月那句「ok」沒用也找到原因了

昨天凌晨三點多（臺灣時間），Claude Code 發了 [v2.1.301](https://github.com/anthropics/claude-code/releases/tag/v2.1.301)。更新說明裡有兩條跟 auto mode 的分類器有關。第一條是 OpenTelemetry 的 `tool_decision` 事件多了 `classifier_verdict` 和 `permission_mode` 兩個欄位，官方寫的用途是讓分類器做的決定可以跟權限規則分開來看。第二條是 `classifier_category`：開了 `OTEL_LOG_TOOL_DETAILS=1` 之後，分類器擋下一個動作時，會記下它對上的是哪一條內建規則。今天清晨的 [v2.1.302](https://github.com/anthropics/claude-code/releases/tag/v2.1.302) 又修了一個問題：大部分分類器擋下的事件，前一版其實都沒帶到 `classifier_category`。

`tool_decision` 本來就有一個 `source` 欄位，記這個決定是從哪裡來的。[監控文件](https://code.claude.com/docs/en/monitoring-usage)對 `config` 的解釋是「沒有問人，自動決定」，來源可能是專案設定、個人設定裡的 allow 或 deny 規則、企業政策、啟動參數，或當下的權限模式，而且文件明寫，這個事件不會告訴你是哪一個來源對上的。照這段說明，auto mode 下分類器做的決定，只能歸在「當下的權限模式」裡，跟 deny 規則一起叫 config。

放在模型外面的控制，其實不只一層。10 月 10 日我把一條規則從記憶搬進 `settings.json`，那種規則是照字面比對指令（〈[Nadella 說控制要放在模型外面，我昨天才把一條規則從記憶搬進設定檔](https://b-log.to/ai-analysis/nadella-controls-outside-the-model/)〉）。auto mode 的分類器是另一個模型，讀了對話再判斷。兩層都會擋東西，可是事後回頭查紀錄，被擋的那一下是哪一層做的，以前從欄位上看不出來。

## 九月那句「ok」

9 月 23 日，分類器把我的部署腳本判成 Production Deploy 擋下來。我在 session 裡回了「ok」，它還是擋，最後是我自己在終端機按 Run。10 月 8 日部署 oMLX，又被擋了一次。那時候我只覺得它不聽我的。

這次為了看懂 `classifier_category` 在記什麼，我去讀了 [auto mode 的設定文件](https://code.claude.com/docs/en/auto-mode-config)。分類器裡的規則分成四層，依序比對。`hard_deny` 無條件擋，使用者怎麼說都沒用。`soft_deny` 擋有破壞性的動作，正式環境的部署就在這一層，使用者的意圖可以解開。`allow` 是 `soft_deny` 的例外。最後才輪到使用者明確的意圖。文件對「明確」有寫條件：你的訊息要直接、具體地描述 Claude 接下來要做的那個動作。叫它「把 repo 整理一下」，不算授權強制推送；叫它「強制推送這個分支」才算。

照這個標準，「ok」什麼動作都沒講到。分類器沒有放行，是因為那句同意沒有指到任何一個動作。文件給的退路，也剛好是我那天做的事：分類器不肯放的步驟，就離開 auto mode，自己回答權限詢問。九月那時候的版本，跟現在的文件不一定完全一樣，這段是照現在的寫法回頭對的。

這一點，Claude Code 終於跟上 Codex 了。Codex 的 auto mode 本來就會照我的意圖走，我明確授權，它就放行。Claude Code 之前不會，我講了它還是擋。

## 我在對話裡講的界線，也只是一段文字

同一份文件裡還有一段，我比較在意。你在對話裡說「先不要推」或「等我看完再部署」，分類器會把它當成要擋的訊號。可是這些話不會存成規則，分類器每次檢查都是重新讀對話紀錄。如果壓縮把講這句話的那則訊息拿掉了，這條界線就跟著不見。文件自己的建議是：要有硬性的保證，就寫成 deny 規則。

v2.1.302 剛好又多了一個壓縮的時機。用伺服器端分類器的時候，對話如果長到安全檢查吃不下，現在會先壓縮對話，不再把每個要檢查的工具呼叫都拒絕掉。前天我才寫過閒置壓縮：長對話掛著、人走開快一小時，它會搶在 prompt cache 過期前先壓（〈[Claude Code 會在你離開時先壓縮長對話，搶在 prompt cache 過期前](https://b-log.to/ai-analysis/claude-code-idle-compaction-prompt-cache/)〉）。會觸發壓縮的情況越來越多，一場掛了一整天的長對話裡，早上講過的一句「先不要部署」到下午還在不在，我現在不太敢假設。

10 月 10 日那次學到的事，在這裡又遇到一次。寫在記憶裡的規則，跟講在對話裡的界線，都是給模型讀的字。我真的在意的，還是只能寫進設定檔。

## 新欄位我暫時用不到

講實際一點，這兩版加的欄位，要接了 OpenTelemetry 才看得到，資料只會送到自己設定的端點，不會送回 Anthropic。我沒有在收這些事件。畫面上被擋的時候，本來就會在提示裡寫出 `[Production Deploy]` 這種規則名稱，`/permissions` 的 Recently denied 分頁也查得到被擋的紀錄。新欄位比較像是給要統計整個團隊被擋了幾次、擋在哪一條的人用的。

所以這兩版對我最有用的地方，是我為了看懂新欄位，回頭讀了那段優先順序。下次分類器再擋部署，我會直接講「把這支腳本部署上去」，不會再只回一個「ok」。

