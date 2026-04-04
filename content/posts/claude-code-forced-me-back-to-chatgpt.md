# 我被 Claude Code 逼到重新註冊 ChatGPT


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

## 付費使用者不該是這樣被對待的

[一月的時候](https://b-log.to/posts/anthropic-max-ban-disaster)，Anthropic 搞砸過一次——Max 使用者被誤 ban。[三月底](https://b-log.to/posts/ai-service-sla-availability-problem)，我寫了一篇關於 AI 服務為什麼需要 SLA 的文章。現在四月初，我在重新註冊一個自己判過死刑的產品。

我從 2022 年底用 GPT-3.5 開始接觸 AI 工具，到現在三年多了。Claude 是我用過最好的 AI，這一點到今天還是成立的。但「最好」不代表「可靠」。一個月付 $100 美金，期待的不是「最好的時候很好」，而是「任何時候都能用」。

prompt cache bug 是技術問題，可以修。尖峰調控是政策決定，可以討論。但讓付費使用者在問題沒修好的情況下自己想辦法精簡 config、砍 MCP、調環境變數——這不是合理的期待。

M5 Max 128GB 上市的時候，我會第一時間買。到那天，我就不用再依賴任何一家的雲端服務來決定我今天能不能工作。

在那之前，我只能這樣了。

