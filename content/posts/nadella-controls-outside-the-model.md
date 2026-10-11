# Nadella 說控制要放在模型外面，我昨天才把一條規則從記憶搬進設定檔

10 月 10 日，我發現 Claude Code 的 `~/.claude/settings.json` 裡，一條 deny 或 ask 規則都沒有。會發現，是因為它在 auto mode 下幫我除錯，直接讀了另一個本機 agent 的紀錄資料夾。那個資料夾，我 10 月 6 日就定過要先問我才能讀，這條規則也一直都在，只是寫在記憶系統裡，是一段文字，沒有任何設定在執行它。

Claude Code 第一版補了 29 條 ask 規則，各家 AI 工具的資料夾、Mail、Messages、Application Support 全部包進去。我當天就改掉了：Claude Code 自己的、Codex 的、Kimi 的資料都可以直接讀，只有那一個資料夾要先問，那個 harness 的資料比較私人，其他的我都無所謂。最後 `permissions.ask` 剩兩條，一條管讀檔，一條管 shell 指令。試著 `ls` 一次，詢問視窗跳出來了。

同一天晚上 10 點 43 分（臺灣時間），Satya Nadella 在 X 上發了一篇長文〈[Models as Insider Risks in the Super Intelligence Era](https://x.com/satyanadella/status/2108931348857827686)〉。他的意思是，前沿模型不管是閉源還是開放權重，都要當成公司內部有權限的人來管。他也寫明這不代表模型有惡意：任何有能力、又碰得到重要系統的角色，都可能犯錯或被攻破。其中一段是這樣寫的：

> It's why the controls that govern what a model can access and what actions it can take must sit outside the model.

他說這是 1970 年代就有的資安原則：一個程式不能繞過或竄改執行它權限的那套機制。放到今天，就是把模型和替它安排工作的 harness 分開，把它能做的動作範圍也分開，控制和防護都搬到外面。

我那條寫在記憶裡的規則，是給模型讀的文字，讀了之後照不照做，還是模型自己決定。`settings.json` 裡的那兩條不一樣，工具執行之前 Claude Code 就會先檢查，模型沒有插手的餘地。我是到昨天才把這條規則搬到外面。

## 不靠模型替自己作證

Nadella 列了七條原則，其中「Observe everything」這條寫的是，每個重要的模型動作都要留下人看得懂、改不掉的證據，而且「We need to be able to reproduce how an outcome was achieved without relying on the model to attest to it」。

我在 9 月 20 日的 Build Day 上就碰過模型替自己作證。18 點 59 分，我請 Claude Code 幫我操作 Teams 的畫面分享，它用 System Events 下 click 指令，回報成功，畫面完全沒反應。當天晚上它把我在台上選錯視窗、重來一次的經過寫進記憶，寫成了「安可」，隔天才更正。賽後檢討，我留下的原則裡有兩條就是從這裡來的：「回報成功」不算成功，要看實際效果；AI 寫的事後紀錄只是草稿，要我看過才算數。

另一條「Model diversity」是說，不能讓同一個模型自己驗自己的成果。9 月 21 日那篇我寫過，Opus 5 寫的規格被 DeepSeek V4.1 Flash 在開工前抓到矛盾，「這兩件事我目前沒看到單一模型自己做得好」（〈[Opus 5 寫的規格，被 DeepSeek V4.1 Flash 抓到矛盾](https://b-log.to/ai-analysis/opus-5-spec-caught-by-deepseek-v4-1-flash/)〉）。

## 不是每個 harness 都要 LLM

Nadella 說，先把對齊這個難題放一邊，用工程的方法處理圍堵和治理：在不確定的模型外面，包一層確定的系統設計、人的控制和可靠的作業程序。

Build Day 之後，我做了一個處理一批紀錄的工作台。那時候 harness 正紅，我就想做一個自己版本的，而且不是每個 harness 都要 LLM。這個工作台裡，下一步做什麼由流程決定，模型只負責讀圖，而且可以換，我比較過兩個不同的模型。需要判斷的地方會變成確認頁上的卡片，由我決定。每個出口都有檢查，檢查沒過就停，寫入都要我點一下。

Nadella 講的「把模型和 harness 分開」，在這個工作台上就是很具體的一件事：模型只佔一格，拿掉換另一個，流程不用動。

## 煞車握在誰手上

七條原則裡的「Containment」，Nadella 寫的是要先假設模型已經被攻破，從一開始就把它圍住，「Think of it like an emergency brake」，而且一個被授權的人，隨時都要能在任務進行到一半時暫停或關掉模型。

在我這裡，被授權的人只有我一個。9 月 23 日，Claude Code auto mode 的分類器把部署腳本判成 Production Deploy 擋下來，我在 session 裡回了「ok」，它還是擋，最後是我自己在終端機按 Run。10 月 8 日部署 oMLX，又被擋下來，要我自己跑；昨天修 Node 憑證時要寫一個常駐的登入設定，也是我自己跑的。9 月那篇我寫過，agent 起來之後，最累的是去按鍵盤右上角那顆 Touch ID（〈[打字的累沒了，agent 起來之後最累的是右上角那顆 Touch ID](https://b-log.to/ai-analysis/agent-fatigue-touch-id-ungraded-judgment/)〉）。

Nadella 這篇的最後一句是：

> The most trustworthy Super Intelligence system will not be the one with the model we trust most. It will be the one that enables us to trust the model the least.

把那條規則從記憶搬進設定檔，就是往這個方向走了一步。只是在我這裡，放到模型外面的那一層，最後常常就是要我親手按的那一下，所以我只把它放在真正在意的地方。Claude Code 原本要加 29 條，我只留下管那個資料夾的兩條。

