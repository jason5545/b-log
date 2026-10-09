# agent 讓重造輪子變便宜，我選擇 fork，再把改過的地方寫進 PATCHES.md

10/8，我的 DroidDeck fork 同步 upstream 的時候，刪掉了一段自己加的字型修正。

那段修正是為了一個很具體的問題：Steam 介面切到繁體中文，中文全變成方塊。upstream 前一天合併的 #374 處理的是同一件事，所以 fork 原本複製字型、另外寫規則的做法，這次整段換成 upstream 版，只留下 upstream 還沒處理到的一塊：沒有標語言的中日韓文字。會刪得這麼乾脆，是因為 fork 根目錄有一份 [PATCHES.md](https://github.com/jason5545/DroidDeck/blob/main/PATCHES.md)，維護規則第二條就寫著：

> upstream 修了同一件事：確認該條列的測試仍通過或等價改寫，再整段換成 upstream 版，兩處一起拿掉。

這種檔案我手上有三份，oMLX、T3 Code、DroidDeck 各一份，都是獨立的一個檔案。有了 agent 寫程式之後，重造輪子變得很便宜。我的做法是不重造：fork 現成的，再把改過的地方寫下來。

## 自己寫，現在比找套件快

Flask 的作者 Armin Ronacher 在 2025 年 1 月寫了〈[Build It Yourself](https://lucumr.pocoo.org/2025/1/24/build-it-yourself/)〉，主張少用依賴。他舉的例子是 Rust 的 `terminal_size`：一個只負責查終端機大小的 crate，會再拉進三、四個 crate，前後發了 26 個版本；他自己十年前寫在某個專案裡的版本，一次都沒更新過，到現在還能用。文章裡有一句直接講到 AI：

> It's 2025 and it's faster for me to have ChatGPT or Cursor whip up a dependency free implementation of these common functions, than it is for me to start figuring out a dependency.

他也沒有把話說死。處理 HTTP、QUIC 這種難題的函式庫，他照樣用，tokio 他也不打算拿掉。他反對的是只用到一個函式，卻要編譯幾百個函式。

一年後，這件事的規模放大了。Cloudflare 在 2026 年 2 月發表 [vinext](https://blog.cloudflare.com/vinext/)：一位工程師（文章特別註明，其實是工程經理）指揮 AI，不到一週，在 Vite 上重做了 Next.js 的 API。整個專案在 OpenCode 裡跑了 800 多個 session，Claude API 的 token 花了大約 1,100 美元。Cloudflare 自己也寫明，vinext 還在實驗階段。

## 便宜的輪子，後面要有人養

自己寫的成本掉下來，重複也跟著來。九月的 [RepoReuse 論文](https://arxiv.org/abs/2609.35357)用 75 條、每條 5 輪的開發任務，審了 3,000 輪 agent 的程式碼。agent 第 1 輪平均會讀 83.6% 的相關程式碼，到第 5 輪只剩 35.4%。到了第 5 輪，50.8% 的任務鏈裡留著重複的實作，第 1 輪時只有 13.8%，而測試通過率幾乎沒動。agent 自己前幾輪寫的函式，它幾乎每一個都讀過，自我重用率還是從 83.9% 掉到 69.1%。論文附錄裡有一個案例：agent 把自己第 4 輪寫的函式完整讀過一遍，第 5 輪卻沒有呼叫它，從頭重寫了 262 行；參考解答呼叫那個函式，只要 68 行。10 個測試全過。

同一篇論文還在其中一組設定上，比較了三種「告訴 agent 之前做過什麼」的方式。只列出前幾輪函式的簽名、回傳值和行為，自我重用率從完全不給的 30.0% 拉到 67.8%；把前幾輪的原始碼整份貼給它，只有 29.2%，跟什麼都不給差不多。

另一篇看的是依賴。King's College London 分析了 [26,760 個 agent 開的 PR](https://arxiv.org/abs/2512.11589)，只有 1.3% 新增了依賴。乍看很像 Ronacher 想要的少依賴，但作者自己的推測是，agent 常常搞不定套件安裝和環境衝突，不加依賴可能是做不到，不見得是刻意保守。

整個生態系的數字也在漲。依 [mcptoplist 的觀測](https://mcptoplist.com/observatory)，MCP 官方 registry 到 10/9 有 40,951 個 server，最近 30 天多了 11,518 個。這是上架數，不代表裡面有多少在做同一件事；功能重複的專案到底佔多少，我還沒看到有人量化過。

日本那邊，みのみ在 note 上寫了〈[車輪に埋もれる私たち](https://note.com/mizuoishii/n/n0dd8cd263e9a)〉。她在 Zenn 上看 Claude Code 相關的文章：導入 claude-mem 的、不用 claude-mem 的、自己寫記憶引擎的、教人寫 CLAUDE.md 的。全部都在解同一個問題：LLM 記不住對話，而且每一篇都不知道別人已經用另一種方式解過了。她的解釋很短：「探すより作る方が速い。だから探さない。」找比做慢，所以不找。這些輪子的文章又佔滿了搜尋結果，下一個人照著做，輪子就越造越多。

## Theo 說：fork，然後把意圖寫下來

Theo 在四月的影片〈[A letter to tech CEOs](https://www.youtube.com/watch?v=G1xqTjoihfo)〉最後，提了另一條路。起點是 Yasha 的做法：他會把專案裡的每個套件都當成可以直接改的程式碼，改完用 patch-package 套上去。問題是套件一更新，要改的那段程式碼搬了位置，patch 就得重寫。Theo 的提議是，每一次客製化都改兩個地方：一個是程式碼，另一個是一份 `patch.md`，用白話寫下這次改動的意圖。

> The patch.md simply describes all of the features you have added to the app.

之後的更新流程是這樣：從 main 拉新版，能乾淨套上就直接用；套不上，按一顆「Run Update with Agent」，讓 agent 解合併衝突；agent 也解不開，就在背景開另一個 instance，照 `patch.md` 把你的功能在新版上重做一遍，你確認沒問題再切過去。Theo 說他太忙，沒空自己做，但這已經排進 T3 Code 的 roadmap。

他講的是 fork 一個現成的 app，在上面加自己要的東西，跟從零重寫是兩回事。輪子還是同一個，只是多了一份說明：我在這個輪子上加了什麼、為什麼加。

我的 oMLX、T3 Code，還有一個在 Android 上跑 Steam 的 DroidDeck，都已經在這樣做了。

## 我的三份檔案

[oMLX 的 PATCHES.md](https://github.com/jason5545/omlx/blob/main/PATCHES.md) 歷史最長。8/20 起，AGENTS.md 裡就記著「跟著 upstream 走」的合併策略，之後要守的本地 patch 也陸續記進去；9/30 那天，本地 patch 清單搬出來，變成獨立的 PATCHES.md。那一版寫的是「只保留十一個本地功能」，今天是「三十一個」。從 9/30 到現在，這份檔案改了 39 次，fork 跟 upstream 合併了 5 次。

[T3 Code 的 patches.md](https://github.com/jason5545/t3code/blob/main/patches.md) 是 10/7 才開的，記了三件事：OMP provider、正體中文介面，以及用我自己的開發者憑證簽的 nightly。[DroidDeck 的 PATCHES.md](https://github.com/jason5545/DroidDeck/blob/main/PATCHES.md) 從 10/4 開始，fork 從那天起每天都跟 upstream 合併一次。

把三份檔案跟 Theo 的 `patch.md` 放在一起看，有幾件事是他沒提到的。

**每一條都寫了行為底線。** 三份檔案的格式不完全一樣，但 oMLX 和 DroidDeck 的維護規則第一條都要求：新增本地 patch 時，寫清楚「為什麼要改、相關檔案、測試、行為底線」。DroidDeck 字型那條的行為底線是：

> Steam 介面的中文不會是方塊，繁中不會用到 KR／JP 字面。

Theo 的 `patch.md` 描述功能，讓 agent 知道要重做什麼。行為底線加上測試，是讓 agent 重做完之後，有辦法確認自己做對了。這些檔案也會老實寫出還沒驗證的部分，例如 DroidDeck 觸控那條，改成跟著 Touch 設定走之後，「還沒上手機切 Touchpad／Direct 確認」。

**合併衝突先照清單處理。** oMLX 和 DroidDeck 都有一節「合併衝突檢查」，逐檔列出要守住的函式和設定。oMLX 那份列了二十一項，從 `omlx/server.py` 的 sub-key policy 到 `pyproject.toml` 的 optional dependency。清單之外的規則只有一句：

> 追 upstream 時，衝突只要守住上面幾塊，其餘一律取 upstream 版本。

Theo 的流程是先讓 agent 解，解不開再重做全部功能。這裡的預設是 upstream 贏，只有清單上的幾塊要人守。

**upstream 做了，本地就刪。** 開頭那段字型修正是一個例子。DroidDeck 的 Slay the Spire 2 那條也是：upstream 的 #168 處理掉大部分啟動問題之後，fork 原本用 app ID 寫死的 `KNOWN_FIXES` 拿掉了，只留下 upstream 沒有的 `godot_tabtip`。oMLX 那份也寫著，xgrammar 的 patch「已被 upstream 吸收，不需再維護本地版」。為了知道什麼時候能刪，維護規則還要求：修的是 upstream 的 bug，就寫明來源 commit、PR 和上游 issue。

**有用的改動送回 upstream。** 三月我寫過〈[AI 正在打破開放原始碼的社會契約](https://b-log.to/tech-analysis/ai-breaking-open-source-social-contract/)〉，當時的立場是 vibe 出來的東西，自己用可以，PR 回去要三思。DroidDeck 這次送了，但只送一條。遊戲內觸控的 patch 送成了 [PR #241](https://github.com/Droid-Deck/DroidDeck/pull/241)，PR 只包含這一條，10/7 又補上 `steamdecktouchscreen` 的證據，目前還開著。正體中文翻譯送的 [#208](https://github.com/Droid-Deck/DroidDeck/pull/208) 沒進去：維護者要求拿掉 commit 裡的 `Co-Authored-By`，還沒改，upstream 自己的翻譯 #216 就先合併了，#208 以重複關掉。這件事後來也寫進了維護規則：送 upstream 的 PR，commit 不帶 `Co-Authored-By` trailer。

**有些衝突在設計時就避開了。** T3 Code 的中文介面，大部分字串是在 build 的時候才翻：

> Most text is translated at build time so component sources stay identical to upstream.

元件的原始碼跟 upstream 一樣，合併時就不會為了翻譯在元件檔案上撞到。代價是每次同步完，要跑 `node scripts/i18n/extract.ts` 找出新進來、還沒翻的字串。檔案開頭也記了 upstream 的 baseline commit `b707eeb`，下次同步時知道要從哪裡比。

## 那顆按鈕還沒有

三個 fork 都沒有 Theo 說的「Run Update with Agent」。每次同步就是 merge upstream，衝突落在哪個檔案，就照 PATCHES.md 的清單逐項確認，再跑檔案裡寫的測試。要怎麼合、哪些要守，是我跟 agent 討論出來的，執行交給 agent。

PATCHES.md 會從 AGENTS.md 獨立出來，是因為 AGENTS.md 那時已經超過 32 KB。Kimi Code 的原始碼裡把 AGENTS.md 的[建議上限](https://github.com/MoonshotAI/kimi-code/blob/419aced0e97fa04b75f8f71b089e1667f6de6d0a/packages/agent-core-v2/src/agent/profile/context.ts#L8)定在 `32 * 1024`，超過就在狀態列跳出警告：

> AGENTS.md total … KB exceeds the recommended 32 KB. Large instruction files increase cost and may impact performance; consider trimming.

它不會截斷，內容照樣全部交給模型，只是提醒你修剪。OpenAI 的 Codex CLI 也是 [32 KiB](https://developers.openai.com/codex/guides/agents-md)，但那邊是硬上限，超過的部分就不讀了。所以我把本地 patch 清單搬出去，替 AGENTS.md 減肥。

這幾份檔案也不會讓 fork 變小。oMLX 那份在九天內從十一條長到三十一條。但不少條目都寫了自己什麼時候可以刪。DroidDeck 觸控那條的最後一句是：

> 合併後整條改取 upstream 版，這裡和檢查清單對應的那行一起拿掉。

那句話寫的是 PR #241 被合併之後的事。到那時候，這一條就從檔案裡刪掉，那部分直接用 upstream 的版本。

