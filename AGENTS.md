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

Jason 2026/9/26 指定的硬規則。外觀改版方向是 Airbus ECAM 的色彩語意（青色＝可以點、綠色＝已解決、琥珀＝要注意），當天只定了概念，還沒實作；這條不管改版做到哪裡都適用。

- 洋紅只用在跟 LiSA 有關的東西：シルシ、Crossing Field 兩個分類的標籤與列表分類欄、TOPICS 裡這兩項、她的歌詞和訪談回答的出處與說話者標記、跟她有關的紀念區塊。
- 其他地方一律不用洋紅，也不用接近洋紅的粉紅、紫紅：連結、hover、按鈕、強調、行內程式碼、語法突顯、別人的說話者標記（Crossing Field 裡的「媽媽」用灰色）都不行。
- 反過來，LiSA 相關的標記也只用洋紅，不借青色、綠色、琥珀。
- 洋紅只有一組 token（mock 是深色 `#ee7ad0`、淺色 `#a3226f`，Jason 可能另外指定）。要換色就改 token，不開第二種粉紅。
- 為什麼：ECAM 的洋紅保留給特定狀況的訊息，這個站把它保留給她。

目前違規（2026/9/26 掃 `assets/styles.css` 與 `data/posts.json`，判準是色相 285–350°、飽和度 > 35%；封面 SVG 未掃）：

- `.article-body code` 與 `.article-body .token.tag` 用 `#f38ba8`，所有技術文章的行內程式碼都是粉紅。
- 2 篇 `accentColor` 是粉紅系、內文沒提到 LiSA，要換色：`asian-sex-diary-no-longer-johns-diary`（`#9f3f60`）、`japan-av-industry-hypocrisy`（`#8b2252`）。
- 算她的、不算違規：Crossing Field 主題、十週年紀念區塊、12 月生日橫幅，以及分類不是 LiSA 但 Jason 9/26 確認算她的 `songshan-airport-jpop-parallel-world`（`#e85d75`）、`birthday-avatar-ai-barrier`（`#e91e8c`）。改版時這些色碼一併換成洋紅 token。
