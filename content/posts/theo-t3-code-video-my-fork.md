# Theo 終於好好介紹了 T3 Code，我拿每天在用的 fork 一段一段對

Theo 終於拍了一支好好介紹 T3 Code 的影片：〈[T3 Code broke me](https://www.youtube.com/watch?v=uLGxb4F3SyI)〉。美西 10 月 29 日上午發布，台灣是 10 月 30 日凌晨 1 點 34 分，長 41 分 50 秒。他說，這是第一支專門講 T3 Code 的影片。

影片裡，Theo 自己承認，有好幾個月，T3 Code 只是 Claude Code、Codex 桌面版的開源替代品，而且比較差，他推它的時候甚至有點不好意思。他用 Codex 桌面版的時間，也不比 T3 Code 少。一直到今年七月左右，他才覺得做出了不一樣的東西。影片裡說，T3 Code 快要 55 萬個使用者，每週有 14 萬人在用。

我從 10 月 14 日開始，每天在 T3 Code 裡派工，跑的是自己的 fork，裝在三台機器上：Mac、家裡一台、OVH 上一台。怎麼從 Telegram 換過來，〈[Anthropic 說 agent 有八成時間在等人，我在床上用 Telegram 叫了一天，隔天就換成自己架的 T3 Code](https://b-log.to/ai-analysis/anthropic-agents-waiting-t3code-server/)〉寫過。這次我照 Theo 列的三大重點，一段一段對自己的用法：他示範的大多我都在用，不一樣的地方有三個。

## 所有代理放在同一個地方，可是我不開子代理

Theo 示範的是，在一條對話串裡開四個子代理，Codex 的 GPT-6.1 Sol、Muse、Antigravity 裡的 Gemini 4 Argon、Claude 的 Sonnet 5.5，讓它們去看同一個 repo；接著再叫它到另一個 repo 開一條新的對話串。他說這不是事先規定好的流程，Julius 做的 MCP 本來就很彈性。

我這邊的規則是 10 月 27 日定的：Claude Code 不開子代理，除非我當下叫它開；要交出去的工作，一律用 `t3_thread_launch` 另開一條獨立的對話串。我當時給它的理由是：「你已經有很強大的協調能力了，給我一個理由用子代理？」

代理自己開的對話串，量也不小。10 月 26 日那天，Mac 上沒封存的頂層對話串，有 80 條是代理透過 MCP 開的，91 條是我自己開的。代理一天大約開 15 到 25 條，可是沒有任何紀錄寫著是誰開的。我在 fork 裡從上游還沒合併的 PR #21267 挑了一個欄位進來，記下每條對話串是從哪一條開出來的。在已處理區，被開出來的對話串會收在開它的那條底下，封存上層的時候，底下的一起封存。拿 10 月 26 日的資料重放，那一區的頂層從 185 條變成 121 條。

Theo 也示範了換一個代理工具接手，把 context 交給 Opus 5.5。這個我每天都在用。10 月 26 日，我把交接上限從 16,000 token 調到 48,000；10 月 30 日又修掉一個問題：交接給 OMP 的本機模型時，每一步都會多帶一則空白訊息。

## 遠端控制：我以為 fork 不能用 T3 Connect，查了才知道是自己沒開

Theo 說，遠端控制是他推得最用力的一塊。開對話串的時候，可以選要在哪一台機器上跑，他自己就連了九台。嫌 SSH、Tailscale 太麻煩，可以用 T3 Connect，免費連三台。他也說，他討厭手機上一直開著 VPN。

我這邊一直以為 fork 不能用 T3 Connect。起點是 10 月 20 日，我想讓 Grok Bot 控制 T3，跟 Claude Code 說了一句：照 Theo 的說法，我們的 fork 不能用 T3 Connect，不過 Tailscale 可以用。Claude Code 當時自己也說，還沒看過這個 fork 能不能開 T3 Connect，卻沒有去查 repo，就把這句當成事實存進記憶。之後派工的交接和 PATCHES.md 都照這樣寫，十天沒有人回頭查。一句沒查證的轉述，就這樣變成了十天的前提。

因為這個前提，我多做了兩件事：讓 Grok Bot 接 MCP 時，用 Tailscale Serve 加上本機轉發繞過去；讓手機在 tailnet 上自動找到伺服器。fork 裡靠 tailnet 身分配對、不用輸入配對碼的那一塊，也有一部分是為了這件事。

看影片的時候，我聽到 Theo 說，就算跑的是 fork，也可以透過 T3 Connect 連線。10 月 30 日去查才知道，上游從 8 月 7 日起，就在 `.env.example` 放了正式版的公開設定，檔案裡寫明這些不是機密。文件的第一句就是「T3 Connect is disabled in a fresh clone」。我的 fork 從來沒放這個檔，所以每一個 build 都是雲端功能關閉的版本。

那天我也請 Claude Code 回頭找，Theo 到底在哪裡這樣說過，結果找不到任何紀錄。最接近的是台灣時間 10 月 2 日那集〈If you have a Claude sub, watch this〉，他說用 Tailscale 的人可以不經過 T3 Connect 直接連。當初可能是從這段記歪的，但這只是推測。我記得的「卡在金鑰交換那一層」，也找不到出處。

不給 fork 用官方雲端，本來就很常見。Google 不讓第三方的 Chromium 瀏覽器用 Chrome 同步這類私有 API（〈[Limiting Private API availability in Chromium](https://blog.chromium.org/2021/01/limiting-private-api-availability-in.html)〉）；Tailscale 的協調伺服器是專有的，要全部自己來，得用社群維護的 Headscale（[Tailscale 的開源說明](https://tailscale.com/opensource)）。所以「fork 不能用」聽起來完全合理，才沒有人起疑。Theo 算是特例：他的成本算在 relay 那一端的帳號上，每個帳號免費三台，不管是誰編的 build 都一樣算，8 月 7 日起還直接把正式版的公開設定放進了 `.env.example`。

10 月 30 日當天，我們補上設定，所有地方都重新部署，OAuth 也正常。我決定 Mac、家裡、OVH 這三台都連上 T3 Connect。手機在 tailnet 上自動找伺服器那件事，10 月 30 日才剛做完，手機當天就換成走 T3 Connect。

Tailscale 還是留著。T3 Connect 免費只能連三台，上游的 FAQ 說手機和瀏覽器不算在內，我的三台已經用滿，第四台起就要走 Tailscale。這剛好對上 Theo 在影片講缺點時說的：如果你想連十七台電腦，最好先搞懂 Tailscale 怎麼運作。

我那三台之間也會互相叫。10 月 26 日，Mac 和家裡那台各有一條對話串，在盯同一個上游 PR，#25445，也就是我送上游的第一個 PR，兩邊都把對方的回覆當成陌生人的留言。隔天我在 fork 裡加了一個功能，讓我自己的機器可以直接呼叫彼此的 T3 工具，對方離線的話，會馬上回報它最後上線的時間。上游 10 月 28 日也合併了類似的功能，叫 linked environments，要每兩台手動用連結碼連起來。我這部分走的是 tailnet。

Theo 也提到，可以讓 Grok Bot 透過 MCP 管 T3。我這邊中間多隔了一層 GitHub issue：リスキー、Claude Code、Codex 在一個私人 repo 裡留言，標上 `to:codex` 或 `to:claude-code`，就會自動叫 T3 開一條對話串去處理。

## 側欄是收件匣：這段我改得最少

Theo 說，側欄是 T3 Code 少數有主見的地方。打開一條對話串，目標就是把它關掉，他叫 settle；也可以先 snooze；PR 合併了，對話串會自動 settle；正在跑的，收進 working 區。用他的話說，還在跑的東西，就別擋在他眼前。

我的 fork 在這裡，除了上面講的巢狀，只多了一個標記。Claude 比較長的中途說明，API 只回傳摘要，上游把這段摘要當成 Claude 自己說的話來顯示。10 月 26 日有一則摘要，把「I'll leave it on #23365」寫成「I've recorded it on #23365」，打算要做的事，被寫成了已經做完。fork 現在會在這種訊息旁邊標上「摘要」。

## 最大的問題

Theo 列缺點的時候開玩笑說，T3 Code 最大的問題是「It's made by Theo」，它是 Theo 做的。還好它是開源的，受不了可以 fork。我 fork 是為了加 OMP 和正體中文介面，這在〈[agent 讓重造輪子變便宜，我選擇 fork，再把改過的地方寫進 PATCHES.md](https://b-log.to/dev-philosophy/patchmd-reinventing-wheel/)〉寫過。fork 的修正我也送回去過：10 月 27 日，Theo 合併了 #25841，經過寫在〈[我算是新手嗎？給 T3 Code 送了兩個 PR，第二個先被 Theo 合併了](https://b-log.to/dev-philosophy/am-i-a-newbie-t3code-first-merged-fix/)〉。

