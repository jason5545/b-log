# b-log 專案協作指引

全域規則在 `~/.codex/AGENTS.md`（`~/.claude/CLAUDE.md` 是指向它的 symlink）。這裡只放這個 repo 的邊界。發文流程的完整程序在 `~/.agents/skills/b-log-publish/SKILL.md`。

## 不要自己加 updatedAt

- 改文章時，不要動 `data/posts.json` 的 `updatedAt`，也不要手改 `feed.json` 的 `date_modified`。
- 這個欄位會連動 `feed.json` 的 `date_modified`、文章靜態頁的 `dateModified` 與 `article:modified_time`、`sitemap.xml` 的 `lastmod`。移除之後，這幾處會回到 `publishedAt`。
- 只有 Jason 明確說要更新日期時才可以動。改字、補段落、修 typo、依回饋調整內文，都不構成理由。
- repo 裡有 91 篇帶 `updatedAt` 的文章（多為 `YYYY-MM-DDT00:00:00Z` 形式），那是刻意的日期，不能拿來當作自己也可以加的理由。
- 發生紀錄：2026/9/3 Claude Code 改三篇舊文後順手更新，Jason 說「dont use update at」，隨即還原；9/7 重申；9/16 Codex 改 `theo-voice-computer-use-everyday-limits` 時自己補了完整時間戳，以 commit `7fa7baf` 移除。這條已經三次發生，動這個欄位前先回頭確認一次。

## 送出前要同步產物

- 改動文章或 `data/posts.json` 之後，跑 `node scripts/sync-feed.js`、`node scripts/generate-redirects.js`、`node scripts/generate-sitemap.js`，最後 `npm run validate` 要通過。
- 產物沒同步，PR 檢查會直接失敗（`.github/workflows/content-pipeline.yml`）。推送 `main` 之後，內容資料管線與 Facebook 發文管線會自動接手。
