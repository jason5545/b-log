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
- 產物沒同步，PR 檢查會直接失敗（`.github/workflows/content-pipeline.yml`）。推送 `main` 之後，內容資料管線與 Facebook 發文管線會自動接手。

## 洋紅只給 LiSA

Jason 2026/9/26 指定的硬規則。外觀改版方向是 Airbus ECAM 的色彩語意（青色＝可以點、綠色＝已解決、琥珀＝要注意），d81239dc 已經上線；這條不管之後怎麼改都適用。

- 洋紅只用在跟 LiSA 有關的東西：シルシ、Crossing Field 兩個分類的標籤與列表分類欄、TOPICS 裡這兩項、她的歌詞和訪談回答的出處與說話者標記、跟她有關的紀念區塊。
- 其他地方一律不用洋紅，也不用接近洋紅的粉紅、紫紅：連結、hover、按鈕、強調、行內程式碼、語法突顯、別人的說話者標記（Crossing Field 裡的「媽媽」用灰色）都不行。
- 反過來，LiSA 相關的標記也只用洋紅，不借青色、綠色、琥珀。
- 洋紅只有一組 token（mock 是深色 `#ee7ad0`、淺色 `#a3226f`，Jason 可能另外指定）。要換色就改 token，不開第二種粉紅。
- 為什麼：ECAM 的洋紅保留給特定狀況的訊息，這個站把它保留給她。

目前狀態（2026/9/26 第三輪修正後）：

- d81239dc 之後違規已清零：行內程式碼與語法突顯不再是粉紅；`asian-sex-diary-no-longer-johns-diary`、`japan-av-industry-hypocrisy` 的 `accentColor` 已換成 `#2e6b75`、`#5b6770`。
- `npm run validate`（[scripts/validate-content.js](scripts/validate-content.js)）會擋兩件事，判準都是色相 285–350°、HSL 飽和度 > 35%：
  - (a) `data/posts.json` 的 `accentColor` 落在這個範圍的，只准出現在她的文章。
  - (b) `assets/styles.css`、`assets/css/*.css`，以及 `index.html`、`post.html`、`about.html`、`gadgets.html` 的 inline style（`<style>` 與 `style=""`），這個範圍的色碼只准出現在 `--magenta:` 宣告。
- 她的文章＝シルシ、Crossing Field 兩個分類，加上白名單兩篇：`songshan-airport-jpop-parallel-world`、`birthday-avatar-ai-barrier`（分類是文化觀察，Jason 9/26 確認算她的）。這些文章的 accentColor 在列表左緣色條與文章頁標題色條一律顯示 `var(--magenta)`，不用存的色碼。
- 白名單在 `assets/main.js`、`scripts/generate-redirects.js`、`scripts/validate-content.js` 三處的 `HER_POST_SLUGS`，validate 會比對三處是否一致；要加減文章，三處一起改。
- 她的文章在文章頁麵包屑的分類（シルシ、Crossing Field）顯示洋紅，靜態頁與 CSR 一致。
- 文章頁右欄的 CONTENTS（本文目錄）：Crossing Field 文章內文有 `crossing-field-toc` 的，右欄目錄照它的配色，編號洋紅、連結墨色；其他文章編號灰色、連結青色。
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
