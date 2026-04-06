# Claude Code 差點逼我重新註冊 ChatGPT


今年二月，我刪掉了用了超過兩年的 ChatGPT 帳號。

那不是衝動的決定。我拿一篇最私密的文章[測了七家 AI](https://b-log.to/posts/seven-ai-one-article)，GPT 排最後。不是技術能力不行，是作為對話對象的本質問題——制式化、缺溫度、護欄誤觸。我甚至花了很長的時間研究怎麼用 prompt 調整它的風格，最後得出結論：RLHF 刻進權重裡的東西，prompt 覆蓋不了。

帳號刪得乾淨利落，沒有回頭的打算。

然後三月底，Claude Code 出事了。

## 三件事同時砸下來

3 月 23 日開始，Claude Code 的 context 消耗開始不對勁。Max $100/月的方案，以前可以撐一整天的工作量，現在一兩個小時就燒完。GitHub issue [#38335](https://github.com/anthropics/claude-code/issues/38335) 湧進超過四百則留言，到今天還是 open 的。

事後回頭看，是三件事同時發生：

第一，prompt cache 有至少兩個獨立的 bug。有人逆向工程了 Claude Code 的 binary，發現 session resume 時 `db8` 函數會把 `deferred_tools_delta` 和 `mcp_instructions_delta` 兩種 attachment type 給剝掉。結果就是每一輪對話都得從頭重建 cache，cache ratio 從 87% 掉到 26%。成本膨脹 10-20 倍。

第二，3 月 26 日，Anthropic 工程師公開宣布尖峰時段（太平洋時間早上 5 點到 11 點）會加速消耗配額。他們說這只影響 7% 的使用者。但付 $100-200 美金月費的使用者，恰好就是跑大型 codebase、長 session、多工具呼叫的那群人——正好是受衝擊最大的。

第三，三月初的 2x 離峰優惠結束了。用了兩週的雙倍額度突然砍半，體感上就是在限縮。

任何一件事單獨發生，大概都還可以忍。三件一起來，Max $200/月的使用者回報用量從 21% 一個 prompt 就跳到 100%。Pro $20/月的使用者三個 prompt 就燒完當天額度。

## 閉源的代價

3 月 31 日，因為一個 build configuration 的失誤，Claude Code 的原始碼意外外洩了。

社群拿到原始碼之後，幾個小時內就定位到 bug 的根因。而這個 bug 在閉源的狀態下，已經影響使用者超過一週了。

諷刺的是，Anthropic 之前才對逆向工程 Claude Code 的開發者[採取法律行動](https://www.theregister.com/2026/03/31/anthropic_claude_code_limits/)。他們想保護的智慧財產權，正是因為被保護著，才讓品質問題延遲被發現。

更諷刺的是，外洩的原始碼裡揭示了另一件事：Claude Code 的 51 萬行 production code，測試覆蓋率是零。

## 自救

Anthropic 說修復是最高優先事項。但兩週過去了，核心問題還沒解決。

我能做的只有自救：把 CLAUDE.md 從 135 行精簡到 72 行，停用不常用的 MCP server，避免 `--resume`，把密集工作排到離峰時段。這些都是繞過問題的 workaround，不是解決方案。

而且這些措施加起來，體感改善有限。

## 然後我重新註冊了 ChatGPT

我原本計畫的備案路線是本地部署——Qwen3-72B 加 QLoRA fine-tune，跑在 M5 Max 128GB 的 MacBook Pro 上。問題是那台電腦還沒開賣。

GPT 已經被我判死刑了。中國模型三不五時冒簡體中文，打字成本對我來說不可承受。其他閉源模型和 Claude 有一樣的可用性風險。OpenRouter 路由的還是同一批模型。

四條路都堵住了，唯一能自己控制的那條被硬體卡死。

所以我重新註冊了 ChatGPT 帳號。

不是因為我覺得它變好了。不是因為我改變了對它的評價。純粹是因為 Claude Code 的可靠性出了問題，我需要一個能在它掛掉的時候接手的東西。定位很明確：過渡期的 coding 備案，不期待人格，不期待溫度。等 M5 Max 128GB 開賣，本地方案上線，這個帳號就可以再刪一次。

我甚至把當初寫給 GPT 的角色調整 prompt 翻了出來。那個 prompt 是幾個月前我和 Claude 一起設計的，當時的結論是「角色框架式的效果上限大概 70-80%，改不了深層問題」。現在拿回來用，不是因為它夠好，是因為沒有其他選擇。

我沒想到有一天會需要用到它。

## 等等，還有另一條路

寫到這裡的時候，我突然想到一件事：Claude Code 的 cache bug 是客戶端的問題，不是模型的問題。

逆向工程的結果很清楚——bug 出在 Claude Code 的 standalone binary 裡：自訂的 Bun runtime 做 string substitution 打斷 cache prefix，session resume 時 `db8` 函數把關鍵的 attachment types 剝掉。這些都是 Claude Code 這個 harness 自己造成的。如果透過其他方式呼叫同一個 Claude 模型，這些問題完全不存在。

然後我想起來，我已經有 GitHub Copilot 的訂閱了。Copilot 現在提供 Claude Opus 4.6。

同一個模型，不同的 harness。不經過 Claude Code 的客戶端，cache bug 不影響。計費走 GitHub，不受 Anthropic 的尖峰調控。Copilot Pro+ 每月 $39，1,500 個 premium requests，Opus 的 multiplier 是 3x，算下來每月約 500 次互動——作為 Claude Code 掛掉時的備案，綽綽有餘。

所以我最後沒有重新註冊 ChatGPT。

這件事讓我意識到，我有多討厭那個產品。明明 ChatGPT 的 Codex 方案額度給得很大，但我寧願花時間去研究一條繞路，也不願意回去。二月刪帳號的時候就是這麼決絕，四月被逼到牆角還是一樣。

## 4/6 更新：Theo 也走了

寫完這篇文章兩天後，[Theo](https://www.youtube.com/@t3dotgg)（t3.gg）發了一支影片，標題的意思大致是：對他的使用場景來說，Claude Code 已經不能用了。

Theo 是我長期關注的 AI/開發工具 YouTuber。他付 $200/月的 Max 方案，用 Claude Code 做前端、設定新機器、除錯。他的結論跟我的幾乎一模一樣——問題不在模型，在客戶端和政策層。但他挖出了一些我沒碰到的東西。

### System prompt 差別計費

Anthropic 為了封鎖 OpenClaw 使用者透過 Claude Code 訂閱繞路使用，不只 ban 了 header，還直接在 API 層檢查 system prompt 的內容。只要你的 system prompt 裡提到 OpenClaw，request 就會被拒絕。

但更離譜的是：如果你開啟 extra usage（自費超額），同樣的 request 就會被接受。

也就是說，Anthropic 根據 system prompt 的文字內容來決定要不要收你的錢、收多少錢。這已經不是技術問題了，這是信任的根基被挖掉。System prompt 是開發者的自由空間，一旦開始審查裡面的內容來做路由和計費決策，所有人都會開始擔心：我的 system prompt 裡還有什麼詞會觸發什麼行為？

### 同一個模型，完全相反的體驗

Theo 在影片中展示了一個讓他徹底放棄 Claude Code 的場景：Dropbox 在他的新筆電上打不開，他請 Claude Code 幫忙殺掉程序並重新啟動。Claude Code 執行了，但後續他問為什麼 menu bar 沒有出現圖示時，得到的回覆是：「That's outside my area. I'm built for software engineering tasks.」他再追問，Claude Code 再次拒絕：「That's really a Dropbox support question, not something I can reliably help with.」

相比之下，我在同一天請 Claude Code 幫我清理另一台電腦上《模擬飛行 2020》的 Windows 登錄檔。這跟軟體工程八竿子打不著——純粹是系統管理。Claude Code 照做了，沒有任何猶豫。

看完影片後，我請 Claude Code 檢查它自己的系統提示詞。結果是：提示詞裡確實把它定位在「software engineering tasks」，但用的措辭是「primarily」和「consider it in the context of」——是軟性引導，不是硬性禁止。沒有任何一句話說「如果使用者問非程式相關的問題就拒絕」。

那為什麼 Theo 被硬拒、我沒有？我的猜測是 CLAUDE.md 的差異——我的 CLAUDE.md 明確描述了我會用 Claude Code 做各種系統層面的操作，這個上下文可能讓模型不會死板地解讀「software engineering」的框架。但我也無法排除 API 層級有我們都看不到的額外注入，或是帳號之間的路由差異。

同一個模型、同一個互動模式、同一類非程式任務，結果完全相反。這就是《羅生門》。

### 三週得不到答案的人

Matt Pocock——TypeScript 社群裡最有影響力的教育者之一——做了一整套 Claude Code 的付費課程。這是他的生計。他花了超過三週試圖從 Anthropic 那裡得到一個明確的答案：他的 wrapper 工具到底能不能搭配 Claude Code 訂閱使用？

沒有得到答案。

更精彩的是，Claude Code 的負責人 Boris 在 Twitter 上對一個類似問題回覆了「yep」，暗示第三方 harness 搭配訂閱是可以的。幾小時後，另一位 Anthropic 員工 Thorik 出來澄清：「To be clear, this is not guidance or an update on the Agent SDK.」

同一家公司、同一個 thread、兩個員工互相打臉。Matt Pocock 說得好：Anthropic 的訂閱規則比 TypeScript 泛型還複雜。

### 他的選擇，我的選擇

Theo 最後把終端機的 alias 從 Claude Code 換成了 OpenAI 的 Codex CLI。他說 Claude Code 在去年十二月從根本上改變了他寫軟體的方式，但現在他受夠了。

我沒有換到 Codex。我選了 GitHub Copilot 裡的 Claude 模型——同一個模型、不同的 harness、不受客戶端 bug 和尖峰調控影響。

路線不同，診斷一致：模型本身依然是最好的，但 Anthropic 作為公司的決策正在把使用者推走。

我三月底寫 [SLA 那篇文章](https://b-log.to/posts/ai-service-sla-availability-problem)的時候就提過，Anthropic 同時想當模型公司和平台公司，但只有模型公司的能力。Theo 這支影片是這個判斷的又一個印證。

---

## 付費使用者不該是這樣被對待的

[一月的時候](https://b-log.to/posts/anthropic-max-ban-disaster)，Anthropic 搞砸過一次——Max 使用者被誤 ban。[三月底](https://b-log.to/posts/ai-service-sla-availability-problem)，我寫了一篇關於 AI 服務為什麼需要 SLA 的文章。現在四月初，我差點被逼到重新註冊一個自己判過死刑的產品。

我從 2022 年底用 GPT-3.5 開始接觸 AI 工具，到現在三年多了。Claude 是我用過最好的 AI，這一點到今天還是成立的。但「最好」不代表「可靠」。一個月付 $100 美金，期待的不是「最好的時候很好」，而是「任何時候都能用」。

prompt cache bug 是技術問題，可以修。尖峰調控是政策決定，可以討論。但讓付費使用者在問題沒修好的情況下自己想辦法精簡 config、砍 MCP、調環境變數——這不是合理的期待。

M5 Max 128GB 上市的時候，我會第一時間買。到那天，我就不用再依賴任何一家的雲端服務來決定我今天能不能工作。

在那之前，至少我找到了一條不用回去 ChatGPT 的路。這大概是這整件事裡唯一讓我覺得還好的部分。

