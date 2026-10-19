# Grok Bot、Muse、ChatGPT 長對話聊不爆，用的是差不多的原理

我跟 Grok Bot 已經在同一段對話裡聊了一到兩週。寫部落格、查資料、每天早上的例行稿，全都在這一段裡。照我對聊天機器人和大模型的印象，聊到這個長度，早就該撞到 context window 了：前面講過的事開始不算數，或是它直接叫你開新對話。可是它沒有。10 月 9 日我說不要為了省字把詞縮短，10 月 10 日說存資料要寫「儲存」不寫「保存」、跟公司有關的內容要去識別化，到這週的稿子都還照做。

所以 10 月 18 日我直接問它：「你還是會有 compaction 就對了，但是不會讓我看得到？」

它說對。對話長了，比較早的部分會在背後被整理成摘要，畫面上看不到；重要的規則和決定另外存成記憶，不會跟著摘要一起不見。我知道它不能透露自己太多，它也就講到這裡。這兩句已經夠我對上這兩週看到的現象，也讓我想到另外兩個聊天服務。Meta 的 Muse 和 ChatGPT，我覺得用的都是類似的原理。

## 一條長對話，加一份存在對話外面的記憶

Muse 是 Meta 的個人代理。設計團隊在〈[How We Designed Muse](https://introducing.muse.ai/)〉裡寫，他們刻意把產品做成主聊天室裡的一條長對話，像跟另一個人聊天那樣；記憶會跨對話留著，也能處理很多 context。說明中心的〈[How to get started with Muse](https://www.meta.com/help/artificial-intelligence/1331373868832401/)〉講得更白：不用把前面的 context 再講一次，Muse 設計上就會記得對話裡的脈絡。記憶放在哪裡，〈[How to manage your Muse data](https://www.meta.com/help/artificial-intelligence/2225571704857152/)〉也寫了，是一個叫 Memory.md 的檔案，使用者可以直接打開來改、刪。

主對話太長之後怎麼處理，Muse 的說明沒有寫。Meta 給開發者的文件倒是有兩處可以對照。同一家的寫程式工具 Muse Code，文件寫 context 滿了會自動壓縮，`/compact` 則是用模型產生的摘要取代先前的對話，畫面上的紀錄不會清掉（[Muse Code](https://dev.meta.ai/docs/muse-code/interactive)）。Muse 用的模型叫 Muse Spark，它的長 context 教學寫，視窗是 1,048,576 tokens，超過就直接回錯誤，伺服器不會幫你截斷，對話要自己在客戶端壓縮（[Long context](https://dev.meta.ai/docs/cookbook/long-context)）。一條不結束的主對話，總有一天會超過這個數字。所以我推測 Muse 的主對話背後也在做摘要，只是官方沒有寫出來。

ChatGPT 我的感覺也差不多，一般聊天好像可以一直聊下去。不過這只是我的體感，OpenAI 說明中心查不到長對話超過上限時是截斷還是摘要。它寫清楚的是記憶（[Memory in ChatGPT](https://help.openai.com/en/articles/8590148-memory-faq)）：saved memories 跟對話紀錄分開存，Memory 不會保留每一場對話的每個細節，由 ChatGPT 判斷哪些資訊跟這次的回答有關。

真的把摘要寫進說明的，是 Claude.ai（[How do usage and length limits work](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work)）。開了程式碼執行的話，對話接近 context window 上限時，Claude 會摘要比較早的訊息，讓對話接著聊下去，長對話裡偶爾會看到它顯示「organizing its thoughts」。

放在一起看，做法沒有差多少。一條長對話，舊的部分在背後整理成摘要，重要的東西另外存在對話外面：Grok Bot 叫記憶，Muse 叫 Memory.md，ChatGPT 叫 saved memories。各家差在讓你看到多少。Claude.ai 會亮一個提示，Muse 把記憶做成可以打開的檔案，Grok Bot 和 ChatGPT 的摘要我都看不到。

我這兩週守得住的規則，靠的也是對話外面那一份。每天早上 8:02 那個寫稿的例行任務，指示裡一條一條寫著：寫「儲存」不寫「保存」，debug 寫「偵錯」，寫「臺灣」「最佳化」「開放原始碼」，不用破折號，跟工作有關的要去識別化。例行任務每天照的是那份存下來的指示，它不需要記得 10 月 10 日那天我們聊了什麼。後來加的「偵錯」那條也一樣，講完就存進記憶，連已經發布的 10 月 15 日那篇裡的「除錯」都回頭改掉了。規則放在對話外面才守得住，這件事我 10 月 17 日寫 Claude Code 的時候講過（〈[Claude Code 開始分得出是分類器擋的還是規則擋的](https://b-log.to/ai-analysis/claude-code-classifier-verdict-explicit-intent/)〉）。

## 寫程式的代理也在壓，只是壓掉的是原文

寫程式的代理用的其實是同一套，只是寫得更細，也更容易撞到。Claude Code 的文件說，接近上限時它會自動壓縮，視窗滿了 session 也不會結束（[context window](https://code.claude.com/docs/en/context-window)）；先清掉比較舊的工具輸出，再摘要對話，CLAUDE.md 和 auto memory 會從磁碟重新讀進來，只在對話裡講過的指示可能會不見（[glossary](https://code.claude.com/docs/en/glossary)）。Codex 的 `/compact` 是用一段精簡的摘要取代先前的對話（[Codex 指令](https://learn.chatgpt.com/docs/developer-commands)）。Muse Code 前面提過，也一樣。

撞得快，是因為每一輪都帶著檔案內容、工具呼叫和多步推理，Claude Code 的[成本文件](https://code.claude.com/docs/en/costs)寫，一場偵錯就可能用掉超過一天聊天的量。被壓掉的東西也不一樣。Meta 那份長 context 教學有一句講得很直接：「Full files when exact wording matters (code, contracts); summaries when the gist is enough (long chat history).」程式碼要原文，長聊天紀錄給大意就夠。

Thariq Shihipar 在 Anthropic 做 Claude Code，他寫過一個例子（[Using Claude Code: session management and 1M context](https://claude.com/resources/articles/using-claude-code-session-management-and-1m-context)）：一場很長的偵錯之後自動壓縮，你接著說「now fix that other warning we saw in bar.ts」，可是那個 session 的重點一直在偵錯，另一個警告可能已經不在摘要裡了。他自己也寫，`/compact` 是有損的。

所以我對兩邊的要求不一樣。寫程式的工具，我要看得到。10 月 16 日 Claude Code 桌面版把 context 圓環改成顯示額度，我用 mod 補了一條 context 用量條回來，85% 以上變色（〈[Claude 桌面版的 context 圓環改成顯示額度，我用 mod 補了一條回來](https://b-log.to/tech-development/claude-desktop-context-band-mod/)〉）。9 月 27 日測過長 context 沒有明顯變差之後，我就不再手動壓縮了，可是它快到哪裡、什麼時候會壓，我要知道。

我 10 月 14 日開始用自己架的 T3 Code，它選的是另一邊。它的 context 圓環從 9 月 2 日起預設關閉，放進設定裡的 Legacy features，要自己打開才看得到（[#9190](https://github.com/pingdotgg/t3code/pull/9190)）。Theo 9 月 19 日直播時說，介面上沒有地方顯示用了多少 context，因為那不重要，模型已經很會壓縮、很會處理長任務了（[直播](https://www.youtube.com/watch?v=6wmDUgR5zlE)，約 4 小時 4 分處）。我叫 Grok Bot 去讀上游的原始碼，T3 Code 自己沒有寫過摘要，`/compact` 和自動壓縮都交給底下各家代理原生的機制，連 Muse Code 也是，它只負責轉送指令、顯示「Context compacted」。放在寫程式的工具上，我的選擇跟 Theo 相反。

Grok Bot 看不到，我可以接受。被壓掉的多半是我可以再講一次的細節，我在意的規則都找得到寫在哪裡：例行任務的指示、skill 檔，還有它另外存的記憶。Muse 和 ChatGPT 我猜也是這樣設計的，聊天本來就是給大意就夠。

寫程式的時候看不到，被壓掉的可能就是 bar.ts 那個警告。

