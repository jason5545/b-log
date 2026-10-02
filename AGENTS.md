# b-log 專案協作指引

全域規則在 `~/.codex/AGENTS.md`（`~/.claude/CLAUDE.md` 是指向它的 symlink）。這裡只放這個 repo 的邊界。發文流程的完整程序在 `~/.agents/skills/b-log-publish/SKILL.md`。

## 不要自己加 updatedAt

- 改文章時，不要動 `data/posts.json` 的 `updatedAt`，也不要手改 `feed.json` 的 `date_modified`。
- 這個欄位會連動 `feed.json` 的 `date_modified`、文章靜態頁的 `dateModified` 與 `article:modified_time`、`sitemap.xml` 的 `lastmod`。移除之後，這幾處會回到 `publishedAt`。
- 只有 Jason 明確說要更新日期時才可以動。改字、補段落、修 typo、依回饋調整內文，都不構成理由。
- repo 裡有 91 篇帶 `updatedAt` 的文章（多為 `YYYY-MM-DDT00:00:00Z` 形式），那是刻意的日期，不能拿來當作自己也可以加的理由。
- 發生紀錄：2026/9/3 Claude Code 改三篇舊文後順手更新，Jason 說「dont use update at」，隨即還原；9/7 重申；9/16 Codex 改 `theo-voice-computer-use-everyday-limits` 時自己補了完整時間戳，以 commit `7fa7baf` 移除。這條已經三次發生，動這個欄位前先回頭確認一次。
- 內容資料管線每次都會跑 `npm run fix:updatedat`（[scripts/strip-redundant-updatedat.js](scripts/strip-redundant-updatedat.js)），自動移除與 `publishedAt` 相同的 `updatedAt`。相同值不影響任何輸出，留著只會讓日期看起來像被改過。

## 送出前要同步產物

- 改動文章或 `data/posts.json` 之後，跑 `node scripts/sync-feed.js`、`node scripts/generate-redirects.js`、`node scripts/generate-sitemap.js`，最後 `npm run validate` 要通過。
- 改 `assets/css/*.css`、`assets/styles.css` 之後跑 `npm run build:assets`（會把 CSS 寫進四個根目錄 HTML），再跑 `node scripts/generate-redirects.js` 帶到文章頁。見下面「CSS 內嵌在 HTML」。
- 產物沒同步，PR 檢查會直接失敗（`.github/workflows/content-pipeline.yml`）。推送 `main` 之後，內容資料管線與 Facebook 發文管線會自動接手。

## CSS 內嵌在 HTML

2026/10/2 改的。`index.html`、`post.html`、`about.html`、`gadgets.html`（和文章頁）不用 `<link>` 載入樣式表，`fonts.css`、`critical-shared.css`、`styles.css` 壓縮後直接寫在 `<head>`，由 `npm run build:assets` 產生（`scripts/inline-css.js`），`npm run validate` 會擋沒同步的頁面。原檔照舊改，HTML 裡兩組 `INLINE_CSS_*` 標記之間不要手改。

- 為什麼：PageSpeed 手機版首頁效能 97，Speed Index 3.8 s 是唯一不到綠燈的指標。濾鏡條前 6 格全白、2.4 s 整頁一次出現；實際載入 0.5～0.8 s 就完成，主執行緒在中間閒著，Chrome 卻到 1.3 s 才排第一個畫格、2.3 s 才呈現。PSI 與本機 Lighthouse 13.5（Chrome 153）都重現，首頁和文章頁有、about 和 gadgets 沒有。
- 逐一擋掉 Service Worker、main.min.js、封面圖、posts.json、字型、Cloudflare beacon，拿掉 view-transition、theme-color、manifest，都還是卡；只有三個樣式表全部不走 `<link>` 才消失。Chrome 內部為什麼這樣沒查清楚。
- 效果（同一套本機 Lighthouse，把線上首頁換成新 HTML）：效能 0.93 → 0.99～1.00，FCP 2.0 → 1.2 s，LCP 2.6 → 1.8 s，SI 4.0 → 1.2 s，CLS 0 → 0。
- 代價：每頁 HTML gzip 後多約 8 KB，CSS 不再跨頁快取。GitHub Pages 的 `max-age=600` 本來就讓外部 CSS 每 10 分鐘要重新驗證一次，那一趟一樣擋算繪。
- 不要改回 `<link>`。也不要只內嵌 fonts.css、critical-shared.css，把 styles 留在外部：實測兩次有一次照樣卡到 2.3 s。styles 改成非阻塞載入會先閃一次沒樣式的版面。

內嵌之後畫面提早出現，原本被蓋住的換字型位移就浮出來了（about、gadgets 一直都有）。所以 `fonts.css` 同時加了 `B612 Mono Fallback`：

- B612 Mono 每個字 0.65em，Mac 的 ui-monospace（SF Mono）是 0.618em。換字型時頁首 AUTO 按鈕寬 2.2px，412 寬的標語被擠成兩行；360 寬的導覽列從一行變兩行，整頁往下推 48px（字型晚到時 CLS 0.244）。
- 備用字型用 `local()` 指到系統的等寬字型，`size-adjust` 調到跟 B612 Mono 等寬：Menlo、DejaVu Sans Mono 107.96%，Liberation Mono、Droid Sans Mono、Courier New 108.32%。字型晚到 1.5 秒的實測：360、412 寬五種頁面 CLS 都是 0。Linux、Android 那幾個字型的字寬照字型規格算，沒在那兩個平台實測。
- 換掉 B612 Mono 或改它的 unicode-range 時，備用字型的 `size-adjust` 與 unicode-range 要跟著重算。
- B612（標題用的比例字）沒做：820 寬首頁標題換字型還有 0.0025 的位移，手機與 1440 寬是 0。

## 洋紅只給 LiSA

Jason 2026/9/26 指定的硬規則。外觀改版方向是 Airbus ECAM 的色彩語意（青色＝可以點、綠色＝已解決、琥珀＝要注意），d81239dc 已經上線；這條不管之後怎麼改都適用。

- 洋紅只用在跟 LiSA 有關的東西：シルシ、Crossing Field 兩個分類的標籤與列表分類欄、TOPICS 裡這兩項、她的歌詞和訪談回答的出處與說話者標記、跟她有關的紀念區塊，以及下面「Crossing Field 專屬設計」列的線與編號。
- 其他地方一律不用洋紅，也不用接近洋紅的粉紅、紫紅：連結、hover、按鈕、強調、行內程式碼、語法突顯、別人的說話者標記（Crossing Field 裡的「媽媽」用灰色）都不行。
- 反過來，LiSA 相關的標記也只用洋紅，不借青色、綠色、琥珀。
- 洋紅只有一組 token（mock 是深色 `#ee7ad0`、淺色 `#a3226f`，Jason 可能另外指定）。要換色就改 token，不開第二種粉紅。
- 為什麼：ECAM 的洋紅保留給特定狀況的訊息，這個站把它保留給她。

目前狀態（2026/9/26 第三輪修正後）：

- d81239dc 之後違規已清零：行內程式碼與語法突顯不再是粉紅；`asian-sex-diary-no-longer-johns-diary`、`japan-av-industry-hypocrisy` 的 `accentColor` 已換成 `#2e6b75`、`#5b6770`。
- `npm run validate`（[scripts/validate-content.js](scripts/validate-content.js)）會擋兩件事，判準都是色相 285–350°、HSL 飽和度 > 35%：
  - (a) `data/posts.json` 的 `accentColor` 落在這個範圍的，只准出現在她的文章。
  - (b) `assets/styles.css`、`assets/css/*.css`，以及 `index.html`、`post.html`、`about.html`、`gadgets.html` 的 inline style（`<style>` 與 `style=""`），這個範圍的色碼只准出現在 `--magenta:` 宣告。
- 她的文章＝シルシ、Crossing Field 兩個分類，加上白名單兩篇：`songshan-airport-jpop-parallel-world`、`birthday-avatar-ai-barrier`（分類是文化觀察，Jason 9/26 確認算她的）。這些文章的 accentColor 在 LOG、BRIEFING 的左緣色籤與文章頁標題色條一律顯示 `var(--magenta)`，不用存的色碼。
- accentColor 的份量（Jason 9/30 定）：文章頁標題上方 4px 整條；LOG、BRIEFING 只在列左緣畫 3px 短色籤，高度跟第一行一樣（LOG 是日期、BRIEFING 是分類行），不蓋滿整列，連續的列才不會接成彩色柵欄；文章頁右欄的 RELATED、LATEST 不畫，右欄的左緣色條只留給 CONTENTS 的目前章節。
- 白名單在 `assets/main.js`、`scripts/generate-redirects.js`、`scripts/validate-content.js` 三處的 `HER_POST_SLUGS`，validate 會比對三處是否一致；要加減文章，三處一起改。
- 她的文章在文章頁麵包屑的分類（シルシ、Crossing Field）顯示洋紅，靜態頁與 CSR 一致。
- 文章頁右欄的 CONTENTS（本文目錄）：Crossing Field 文章內文有 `crossing-field-toc` 的，右欄目錄照它的配色，編號洋紅、連結墨色、目前章節的左緣洋紅；其他文章編號灰色、連結青色、目前章節左緣青色。
- LATEST 的 meta 行與 LOG 標題的篩選名稱，她的分類名稱是洋紅（兩個分類都算），main.js 與 generate-redirects.js 輸出同一種 `<span class="her-cat">`。

Crossing Field 專屬設計（2026/9/26，只套 Crossing Field，不套シルシ；取代改版前的整頁粉紫漸層）：

- 依據是 Airbus PFD 的配色：飛行員在 FCU 選的目標是青色，交給 FMGC 管理的目標是洋紅。這個站照同一套，讀者點的東西是青色，她說的話是洋紅。洋紅只畫在線與字上，不鋪底色、不做漸層。
- 整頁：頁首下緣換成 2px 洋紅（文章頁與 `?category=Crossing Field` 分類頁）。判斷方式是頁面裡有 `data-category-theme="crossing-field"`，分類頁由 main.js 設在 `.home-grid`。
- 分類頁：LATEST、LOG 兩個標題的底線洋紅。
- 文章頁：最外層 h2 用明體，上方加洋紅兩位數章節編號，跟內文目錄與右欄目錄的編號一致（9/26 核對 7 篇，h2 與目錄都一對一、同順序；新文章沒有目錄或 h2 不在目錄裡時，編號會對不上）。
- 她的回答左邊一條 2px 洋紅線，同一人連續的段落接成一條，換人（`cf-answer--speaker-start`）就斷開；別人（媽媽）是 `--rule` 灰線。
- 封面 SVG 仍未掃。

## 螢幕空間要吃滿

Jason 從建站第一天就定的版面原則，2026/9/26 重申：「一個原則就是充分利用」。

- 出處：2025/10/16 的 `aed2252a`「優化網站寬度設定，最大化利用螢幕空間」、`e9a76247`「進一步優化網站適應性，支援超寬螢幕」。
- 內容區不設最大寬度。`.wrap`（[assets/css/critical-shared.css](assets/css/critical-shared.css)）只留左右 padding，每邊 `clamp(16px, 4vw, 40px)`。header、首頁、文章頁、about、gadgets 的左右緣一致。
- 寬螢幕多出來的寬度，靠字級放大（html 從 1280px 的 100% 線性放大到 2560px 的 125%）和加寬欄位吃掉，不留兩側空白。
- 文章頁 1100px 以上分兩欄：文章欄 `minmax(0, 1fr)`，右欄 `clamp(19rem, 100% - 56.375rem, 26rem)`，右欄只有一欄（RELATED、LATEST，下面接 CONTENTS）。右欄不能搶走文章的寬度：9/26 Jason 沒選右欄再分成兩、三欄的做法。首頁側欄是 `clamp(19rem, 24vw, 32rem)`。
- 不要拿「每行 35～45 字」這類一般排版慣例把欄寬收窄、置中，或把側欄移到文末。9/26 Jason 接受寬螢幕每行超過 48 字（1920 寬約 57～69 字）。
- 發生紀錄：2026/3/18 改成毛玻璃風格時，about、gadgets 被設了 `.content { max-width: 860px }`，當天移除。2026/9/26 ECAM 改版第一版（`d81239dc`）又把文章欄收成 736px 置中、側欄移到文末，後面三輪（`a6b32dac`、`d73369dc`、`428cab42`）才改回來。兩次都是動手前沒看這段歷史。
- 動版面之前，先跑 `git log -- assets/styles.css assets/css/` 看過去的版面決定。
- 改首頁 LATEST 前後各跑一次 `npm run check:layout`（[scripts/layout-check.mjs](scripts/layout-check.mjs)）：7 種寬度（375–2560）× 7 種內容（最新一篇、標題最長與最短、摘要最長與最短、沒有封面、Crossing Field 分類頁），截圖並檢查下一節的規則，輸出一頁比較板，有沒通過的格子會回傳錯誤。

為什麼不照多數網站限寬（Jason 9/26 的判斷，研究出處附在後面）：

- 限寬的慣例有三個來源：中等行長的閱讀研究；固定寬度的版面比較好控制，框架也直接寫成預設（例如 Tailwind Typography 的 `prose` 是 `max-width: 65ch`）；窄欄內容少也不會顯得空。只有第一個跟讀者有關，而且研究結論沒有一面倒。
- 螢幕上要捲動時，長行不一定比較慢。Dyson & Kipping 1998：每行 100 字元比 25 字元讀得快，一部分原因是捲動時間少。Bernard et al. 2002：受試者認為最長的行捲動量最合適。代價是理解：Dyson & Haselgrove 2001 裡，每行 55 字元的理解分數比 100 字元好。
- 限寬的慣例預設捲動不花力氣。讀者不只 Jason 一個（他 9/26 說每天 PV 至少五、六十到六、七十），但他自己也讀這個站，而且他用一根手指操作，每捲一次都是實體成本，一屏放得下多少內容是成本問題，不只是美感。其他讀者不會因此吃虧：手機本來就是單欄，版面不受影響；桌機讀者想要窄行，把視窗拉窄就好（下一點）。
- 吃滿時，想要窄行的讀者可以自己把視窗拉窄；限寬之後，讀者沒辦法把它拉寬。WCAG 1.4.8（AAA 級：每行不超過 80 字元，CJK 不超過 40）只要求「有辦法」達到，視窗縮窄就算，網站不用自己限寬，也不用另做切換鈕。
- 代價的處理：字級隨寬度放大，行長增加得慢（9/24 那篇在 1440 寬一行 47 字、1920 寬 57 字）。段落長的 Crossing Field 訪談翻譯在 2560 寬一行約 92 字，讀起來真的跟不上時，只針對這類文章處理，不回頭把全站收窄。

出處：[WCAG 2.2 Understanding 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)；Dyson, M. C. (2004), *How physical text layout affects reading from screen*, Behaviour & Information Technology 23(6), 377–393（Dyson & Kipping 1998、Bernard et al. 2002 的結果引自這篇回顧）；[Dyson & Haselgrove (2001)](https://www.sciencedirect.com/science/article/abs/pii/S1071581901904586)；[tailwindcss-typography `styles.js`](https://github.com/tailwindlabs/tailwindcss-typography/blob/main/src/styles.js)。

## 文章頁封面最高半個視窗

Jason 2026/9/26 決定。文章頁頂部的封面（`#post-hero`）高度最多是視窗高的 50%，照原圖比例、不裁切，寬度跟著縮、靠文章欄左緣。首頁 LATEST、列表、og:image 不受影響。

- 原圖寬高由 `scripts/generate-redirects.js` 直接讀 webp／png 檔頭，寫進 figure 的 `style="--cover-w: …; --cover-h: …"`，img 也帶 `width`／`height`；`sizes` 依比例逐篇產生。
- 版面規則在 `post.html` 的關鍵 CSS（`min(100%, 50svh × 寬高比)` 加 `aspect-ratio`）。`assets/styles.css` 的 `.post__cover` 不要再寫 `aspect-ratio`，會蓋掉逐篇比例。
- 用 svh 不用 vh：手機網址列伸縮時 svh 不變，而且是網址列展開時的可見高度。

## 首頁 TRAFFIC 側欄

2026/10/2 加的。側欄的 TRAFFIC（同一片空域）是 Jason 指定的站與社群，畫成一張 TCAS 畫面（ND ARC 模式），本機在下方中央，越重要越近。

- 畫面上只有 TCAS（Jason 10/2 定）。清單還在 DOM 裡但視覺隱藏，給螢幕閱讀器與鍵盤：Tab 到清單第 n 項時，畫面上第 n 個目標會亮並框起來（她的菱形平常就亮著，焦點要靠框看出來）。滑鼠與觸控直接點目標，每個目標有一塊透明點擊範圍（空心菱形中間也點得到），滑過用 `<title>` 顯示站名與簡介。
- 清單和畫面都由 `scripts/generate-traffic.js` 產生，改站點只改腳本開頭的 `TRAFFIC`，再跑 `npm run generate:traffic`。`index.html` 與 `assets/styles.css` 裡兩組 `TRAFFIC_*` 標記之間的內容不要手改。用法見 `scripts/README.md`。
- 腳本排版不合格就不寫檔：識別碼、菱形不能壓到弧線與刻度，點擊範圍照 WCAG 2.5.8 留 24px 間距。10/2 加這兩項檢查時，原本 12 個目標有 9 個壓線，位置照「距離排名不變、移動最少」重排過（LiSA、LiSATW 沒動）。
- 順序是 Jason 定的：LiSA 官方網站第一個（他說最重要），跟她有關的接在後面，其他照他給的順序。
- 跟她有關的站用洋紅：本人實心、其他空心；其餘站空心青色。站名和簡介取自各站自己的標題與描述，不自己編。
- 只放首頁，不放文章頁：文章頁右欄的高度是算過的（`post.html` 關鍵 CSS 裡 RELATED、LATEST 固定在畫面上的高度門檻），Jason 10/2 同意不放。

## 首頁 LATEST 的版面

Jason 2026/9/27 決定，當天試過三種做法才定案。

- 761px 以上左文右圖，文字欄 1.6 : 封面欄 1。封面不固定 16:9，高度撐到跟左邊文字一樣，用 `object-fit: cover` 裁切，文字下面不留白。標題在左欄，2056 寬是兩行。
- 封面最高只到 4:3（`max-height` 用 `cqw` 算封面欄寬）。961–1216px 有側欄、文字欄窄，不設上限會把 16:9 裁成直的（1000px 實測 0.63:1）；到上限之後封面靠上，下面留白。寬的一端沒有下限，2560 寬會裁到約 2.8:1，Jason 選了不設。
- 封面構圖要留安全區：首頁會裁成 4:3 到約 2.8:1，主體放中間（1344×768 是中間 1024×480，1600×900 是中間 1200×571），規則寫在 b-log-publish skill 與 MCP 的 `coverSvg` 說明。2.8:1 那端來自 12rem 最矮高度（2560 寬 240px），不是文字撐出來的。
- 封面四角有 HUD 角標，平常灰色，滑過跟標題一起變青色。標題與摘要用 `text-wrap: pretty`，不要換回 `balance`（右邊會留白）。760px 以下封面在上、文字在下，16:9 不裁。
- 當天試過但放棄的做法，不要再走回去：
  - 標題橫跨整塊一行、摘要和 16:9 封面排在下面：摘要下面每種寬度都空一大塊（2056 寬約 200px）。
  - 摘要下面接文章開頭、排到封面底部淡出：Jason 看了覺得怪，摘要跟開頭常講同一件事，又切在句子中間。
  - 拉長摘要去填：要跟封面等高，1440 寬要 326 字、2056 寬 544 字、2560 寬 769 字（當時中位數 100 字），只會在某一種寬度剛好，手機上 544 字有 553px 高；摘要同時是 meta／og 描述、`feed.json` 和 Facebook 發文內文，維持 160 字以內。
  - 放大摘要字級去填：2056 寬中位數要 41px，比標題 39.6px 還大。
