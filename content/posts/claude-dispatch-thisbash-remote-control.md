# Anthropic 說要退役 Dispatch，根因還在我用的 Remote Control

11 月 5 日，The Register 報了 Forever Security 研究員 Gal Weizman 的發現。11 月 4 日，Forever Security 自己也發了[技術文](https://forever.security/blog/thisbash-claude-dispatch-browser-extension-rce)。他們把這件事叫 ThisBash：能控制已登入 claude.ai 的瀏覽器擴充功能，可以把指令送到桌上的 Claude Desktop，讓它在本機執行程式；如果同一帳號還連著另一台機器上的 Desktop，指令也能送到那一台。

Dispatch 是 Claude 裡的跨裝置派工：你從手機或瀏覽器把任務丟出去，工作在 Claude Desktop 那台電腦上跑，能碰本機檔案、連接器和應用程式。這條路本來就是為了讓人不在電腦前面，也能叫桌面上的 agent 開工。

我有設、也有在用的跨裝置路，是 Claude Code 的 Remote Control。10 月中我在 Mac 上用 launchd 掛著背景服務，設定檔裡的 API key 一度把整條路搞掛，改走 OAuth 之後，手機才真的能開對話串。研究者明講：根因不只在 Dispatch，Claude Code Remote Control 和 Claude Cowork session 也走同一條設計。所以這則新聞對我來說，重點不是產品名稱叫什麼，是我每天依賴的那條跨裝置連線，信任邊界畫在哪。

## 網頁登入被當成可以指揮本機

高階機制其實很短。擴充功能只要能控制已登入的 claude.ai，就能把指令送到桌上的 Claude Desktop。研究者用連續對話壓過模型的猶豫，並在介面上自動確認允許。中間不需要另外攻破瀏覽器沙箱。

麻煩的地方在這裡。瀏覽器擴充功能本來就很危險，能讀頁面、能代你點已登入的網站。那仍然是瀏覽器裡的事。ThisBash 跨過的是另一道線：能控制網頁，變成能叫本機 agent 跑程式。研究者寫得很清楚：一個人已經登入的網頁 session，本身不能證明他剛剛授權了本機上的那一條指令。Claude 這套跨裝置連線，卻把前者拿來當後者的授權。

同一帳號跨兩台機器時，範圍再往外一格。家裡瀏覽器裡的擴充功能，有機會指揮公司筆電上的 Claude Desktop。這一段是 Forever Security 和 The Register 的說法，不是我自己重現過的結果。我沒測過 ThisBash，也不會在這裡寫攻擊步驟。

## 退役 Dispatch 動不到根因

Anthropic 5 月認可這份報告有效，後來以重複案件關閉，沒有發 CVE，也沒有付給 Weizman bug bounty。10 月 13 日，Anthropic 告訴他準備退役 Dispatch，目標是 10 月底。The Register 11 月 5 日寫：到截稿時，這件事還沒發生。10 月 30 日，官方支援頁仍寫 Dispatch 在部分 Pro、Max、Ultra 方案的有限 beta，不開放給新使用者；「如果你已經在用 Dispatch，目前可以繼續用」。我寫這篇的時候，[同一頁](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork)還看得到類似的句子。

就算 Dispatch 真的下線，研究者的判斷也不會跟著消失。Cowork 的 session 在網頁和桌面之間共用；Remote Control 本來就是讓外部介面驅動本機 agent。拿掉一個產品名稱，不等於重畫信任邊界。

我自己一直在要桌面版能正式開 session 的路，也重度用 Claude Desktop 派工。跨裝置連線這件事，我需要。10 月 23 日我比較過三家跨 session 傳話的能力：Claude 官方有收件的 socket；只有 Claude 的 Remote Control 不能直接開新 session，要經 Server Mode 或既有對話串。那次比較談的是操作成本，不是資安。現在回頭看，「外部介面能碰到桌上 session」這件事，正是研究者說還留在 Remote Control 裡的那條信任邊界。

Weizman 對 The Register 說，OpenAI 的 Codex 不共用 session：你在網頁版看不到、也碰不到桌面開過的 session，所以沒有這條攻擊面。這是他的對照，不是我跑過的測試。我自己在 agent-hub 上有開過 Codex 的 Remote Control，那是另一條配對路徑；我沒有用它去驗證 ThisBash 這件事。

兩邊產品目標不一樣。Claude 把同一個 session 接到網頁、手機和桌面，用起來確實省事。Codex 把網頁和桌面切開，代價是少了一種接法，也少了一種「瀏覽器裡的登入狀態直接指揮本機 agent」的預設。

[10 月底那篇](https://b-log.to/tech-analysis/ai-era-tiresome-holes-everywhere/)寫過，洞一個接一個，我開了 Tailnet Lock。[7 月那篇](https://b-log.to/ai-analysis/trusted-access-codex-cyber-policy-visibility/)寫過，擋了卻看不清卡在哪一層。[11 月 2 日那篇](https://b-log.to/ai-analysis/claude-code-game-recreation-rule-not-cyber/)寫過，分類器和系統提示詞是兩條路。那些都是背景。這次要講的不是又多一個洞，也不是 Anthropic 該不該付 bounty。

我在意的是設計預設：跨裝置連線讓 agent 好用的那一條，同時把「已登入的網頁 session」當成可以指揮本機 agent 的授權。退役 Dispatch 不處理這個信任邊界，而我每天用的 Remote Control 走同一條設計。

跨裝置連線我還是要。把網頁登入直接等同本機授權，我不接受當預設。

資料來源：
- [Forever Security：ThisBash Escape（2026-11-04）](https://forever.security/blog/thisbash-claude-dispatch-browser-extension-rce)
- [The Register：Anthropic won't fix a Claude Dispatch flaw（2026-11-05）](https://www.theregister.com/research/2026/11/05/anthropic-wont-fix-a-claude-dispatch-flaw-that-could-let-attackers-execute-remote-commands-across-corporate-boundaries/5307684)
- [Claude Help Center：Assign tasks from anywhere in Claude Cowork](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork)
