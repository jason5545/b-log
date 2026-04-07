# 因為你值得：我為什麼離開 Claude，又為什麼沒有真的離開

最近在臉書上看到一篇貼文。一個動畫公司的人，去年五月公司 NAS 炸了，12 顆 16TB 硬碟、90TB 的專案檔案，ZFS metadata corruption——所有內容都還在硬碟裡，但系統再也讀不出來。找了好幾間資料救援公司，開多少錢都說 OK，結果每一間看完都說救不了。

放了快一年，某天他突然想到：能不能讓 AI 試試？

他用 Claude Code，花不到五千塊的硬體，自己把三年份的資料全部救回來了。他不是工程師，完全沒有 Linux 和 ZFS 的經驗。

這就是 Claude 的能力。是真的。我從來沒有懷疑過這一點。

但我要離開了。

## 付費兩年，$840 美金

我從 2024 年開始訂閱 Claude Pro，後來升級到 Max $100 方案。兩年下來，付了超過 $840 美金。Claude 是我測過七家 AI 之後的最終選擇——不是衝動，是深度評估後的決定。

我甚至為了 Claude，在今年二月刪掉了 ChatGPT 的帳號。

然後三月底，一切開始崩。

## Claude Code 的三重打擊

Claude Code 出了 prompt cache bug。本來一天的配額，現在一兩個小時就燒完。同一時期，Anthropic 開始尖峰時段調控，早鳥優惠也結束了。三件事疊在一起，我的 $100/月 Max 方案變得幾乎不可用。

更深層的問題是公司的態度。System prompt 差別計費、使用規範模糊、bug 兩週不修、員工之間互相打臉。Matt Pocock 在社群上問了三週都得不到答案。同一個模型對不同人的行為不一致，而 Anthropic 的回應是沉默。

我需要找替代方案。

## 四條路都堵了

ChatGPT？我二月才刪了帳號，而且是經過七家 AI 深度測試後的決定。中國模型？三不五時冒簡體中文。OpenRouter？路由同一批模型，可用性風險一樣。本地部署？M5 Max 還沒開賣。

然後我想通了一件事：prompt cache bug 是 Claude Code **客戶端**的問題，不是模型的問題。我已經有 GitHub Copilot 訂閱，裡面有同一個 Claude Opus 4.6，不經過 Claude Code 的 harness，bug 不影響、計費走 GitHub 不受尖峰調控。

所以我沒有重新註冊 ChatGPT。我選了 Copilot 這條路。

## Copilot 也不是答案

但是 GitHub 沒有一個好的 iOS Copilot Chat 客戶端。所以我自己做了一個。

用 Claude Code 做的。是的，我用 Claude 做了一個離開 Claude 的工具。

我把 tool call 自動執行、MCP 整合、auto-compaction、context window tracking 全部做進去了。官方都沒有的功能，我的 app 有。

然後我發現了一個問題。

同一個 Claude Opus 4.6：

| 平台 | Context Window |
|---|---|
| **Anthropic 官方 API** | **1,000,000 tokens** |
| **GitHub Copilot（VS Code）** | **192K tokens** |
| **GitHub Copilot（第三方客戶端）** | **144K tokens** |

Anthropic 在 2026 年三月就已經把 1M context window GA 了，標準定價不加錢。但 GitHub 把它砍到剩 1/5 不到。

我付了 Copilot Pro+ 的錢，拿到的是一個被閹割的 Claude。

## 403：你不該問這個問題

我想調查這個差異的原因。是 client ID 的限制？是 token exchange 機制？還是刻意的產品策略？

我嘗試用 VS Code 的 client ID 做 OAuth 測試，看看是不是 client ID 不同導致 GitHub 給的 token limit 不一樣。

GitHub 的回應是直接 403。錯誤訊息明確指出這是不被允許的行為，並附上 TOS 的連結。

但只給了 TOS 首頁。

我怎麼知道違反哪一條？TOS 那麼長，你丟一個首頁給我，等於是叫我自己去翻一整份法律文件。這就像警察跟你說「你違法了」，然後丟一本六法全書給你，叫你自己去查。

我不是在惡意冒充 VS Code。我是在合理地調查為什麼同一個模型、同一個 API，第三方客戶端拿到的 context window 比官方客戶端少了 48K。GitHub 的回應是把門關上。

## 兩個平台都不穩

或許有人會說，至少 Copilot 穩定呀？

不。

GitHub 在 2026 年前幾個月的事故紀錄：一月 Copilot 全面中斷、錯誤率峰值 100%；三月連續多日服務降級；四月初 5xx 錯誤持續超過五小時。The Register 的標題寫得很直白：GitHub 連三個九的正常運行時間都做不到。StatusGator 在二月偵測到超過兩萬次中斷，IsDown 在三月偵測到 87 次事故是官方根本沒有報告的。

那 Claude 官方呢？過去 30 天 uptime 只有 98.97%。三月初重大中斷，claude.ai、Claude Code、API、OAuth 全掛。

兩邊都不穩，各自缺一塊。

## 然後是 CEO

如果只是產品問題，我可以等。Bug 會修、穩定性會改善。

但 Dario Amodei 讓我沒辦法等。

光是 2026 年三月到四月：說 Claude 可能已經有意識了、內部備忘錄洩漏罵駡 OpenAI 的軍事合約、被迫公開道歉向 Trump 示好、投資人公開擔憂他「volatile personality, cannot control his emotions」。

The Atlantic 的專題標題叫「The Dissonance of Dario Amodei」——一邊寫萬字 AI 烏托邦宣言，一邊承認在安全和商業壓力之間掙扎。

一個 CEO 今天說 AI 有意識，明天跟五角大廈吵架，後天又公開道歉。我怎麼相信這間公司的產品路線圖會穩定？怎麼相信他們不會突然改定價、改 TOS、砍功能？

我之前寫過：「Claude 是最好的 AI，但『最好』不代表『可靠』。」現在看來，這句話不只是講產品，講的是整間公司。

## 離開平台，不離開模型

所以我的答案是：離開 claude.ai，不離開 Claude。

我自己做了 CopilotChat，一個比官方更完整的 iOS 客戶端。我建了 MCP Memory Server，讓記憶可以跨平台帶著走。我規劃了 M5 Max 本地部署，等硬體到了就不用再看任何平台的臉色。

我用 Claude Code 做了一個離開 Claude 的工具。然後用這個工具，回來跟 Claude 說這些話。

這不是諷刺，這是現實。模型的能力是真的，平台配不上。我不懷疑模型，我懷疑的是承載它的人。

## 因為你值得

有人用 Claude 救回了三年份的心血。我用 Claude 做了一個完整的 app。無數人用 Claude 寫程式、做研究、解決問題。

這個模型值得我做這些事情。值得我付兩年的費用、值得我自己建 harness、值得我規劃本地部署。

但「值得」不代表我要無條件地留在一個不尊重付費使用者的平台上。

我離開的不是 Claude。我離開的是一個不配得上它的生態。

因為你值得。所以我自己來。
