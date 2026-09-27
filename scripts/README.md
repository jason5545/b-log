# WordPress 風格永久連結自動化系統

這個自動化系統為 b-log 網站提供 WordPress 風格的永久連結支援，解決了 GitHub Pages 靜態網站的 URL 路由限制。

## 工作原理

系統透過為每篇文章自動生成重定向頁面，使 WordPress 風格的 URL（如 `/ai-analysis/slug/`）能夠正常運作：

1. **重定向頁面生成**：為每篇文章在對應的分類目錄下建立 `index.html`
2. **自動化執行**：當 `posts.json` 更新時，GitHub Actions 自動執行生成腳本
3. **零維護成本**：新增文章時無需手動建立重定向頁面

## 目錄結構

```
b-log/
├── ai-analysis/
│   ├── openai-contradiction-dangerous-game/
│   │   └── index.html (重定向頁面)
│   └── openai-vs-anthropic-red-lines/
│       └── index.html (重定向頁面)
├── tech-development/
│   └── unified-remote-evo-development-journey/
│       └── index.html (重定向頁面)
├── tech-analysis/
│   └── frontend-backend-validation-analysis/
│       └── index.html (重定向頁面)
└── dev-philosophy/
    └── understanding-vs-execution-vibe-coding/
        └── index.html (重定向頁面)
```

## 分類映射

中文分類會自動轉換為 URL 友好的英文分類：

| 中文分類 | 英文分類 (URL) |
|---------|---------------|
| AI 分析 | ai-analysis |
| 技術開發 | tech-development |
| 技術分析 | tech-analysis |
| 開發哲學 | dev-philosophy |

## 使用方式

### 自動執行（推薦）

當您更新 `data/posts.json` 並推送到 GitHub 時，GitHub Actions 會自動：

1. 偵測到 `posts.json` 的變更
2. 執行 `generate-redirects.js` 腳本
3. 為新文章生成重定向頁面
4. 自動提交並推送變更

**無需任何手動操作！**

### 手動執行

如果需要手動重新生成所有重定向頁面：

```bash
# 在專案根目錄執行
node scripts/generate-redirects.js
```

執行後會看到類似輸出：

```
開始生成重定向頁面...

📁 建立目錄：ai-analysis/
✅ 已建立：ai-analysis/openai-contradiction-dangerous-game/index.html
✅ 已建立：ai-analysis/openai-vs-anthropic-red-lines/index.html
...

完成！共建立 5 個重定向頁面
```

### 手動觸發 GitHub Actions

您也可以在 GitHub 上手動觸發 workflow：

1. 前往 Repository 的 **Actions** 頁面
2. 選擇 **生成重定向頁面** workflow
3. 點選 **Run workflow** 按鈕

## URL 格式

### WordPress 風格 URL（新格式）

```
https://b-log.to/ai-analysis/openai-contradiction-dangerous-game/
https://b-log.to/tech-development/unified-remote-evo-development-journey/
```

`post.html` 只保留為產生文章頁的模板，不再支援查詢參數文章入口。

## 舊分類重定向頁面範例

當文章分類變更時，舊分類路徑會產生 `noindex` 重定向頁：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/new-category/article-slug/">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="https://b-log.to/new-category/article-slug/">
  <title>重定向中...</title>
  <script>
    window.location.replace('/new-category/article-slug/');
  </script>
</head>
<body>
  <p>頁面已移動至 <a href="/new-category/article-slug/">新位置</a>...</p>
</body>
</html>
```

## 技術優勢

### ✅ 解決的問題

1. **GitHub Pages 限制**：透過實際的目錄結構，繞過靜態網站不支援動態路由的限制
2. **SEO 友好**：WordPress 風格的 URL 更簡潔、更容易被搜尋引擎索引
3. **自動化維護**：完全自動化，無需手動干預

### ⚡ 效能最佳化

- **即時重定向**：使用 JavaScript `window.location.replace()` 實現毫秒級重定向
- **Meta refresh 備用**：確保在 JavaScript 不可用時也能正常重定向
- **零延遲**：相比 404 頁面方案，沒有額外的頁面載入時間

### 🔄 向後相容

- 舊的查詢參數格式仍然完全支援
- 不會影響現有的連結和書籤
- 逐步遷移，無需強制更新

## 新增分類

如需新增新的分類，請更新 `scripts/generate-redirects.js` 中的 `categoryMapping`：

```javascript
const categoryMapping = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy',
  // 新增您的分類
  '新分類': 'new-category'
};
```

## 故障排除

### 問題：新文章的重定向頁面沒有自動生成

**解決方案：**
1. 檢查 GitHub Actions 是否成功執行
2. 確認 `data/posts.json` 確實有更新
3. 手動執行 `node scripts/generate-redirects.js`

### 問題：重定向頁面顯示 404

**解決方案：**
1. 確認分類目錄和文章目錄都已建立
2. 確認 `index.html` 檔案存在
3. 清除瀏覽器快取後重試

### 問題：GitHub Actions 沒有自動執行

**解決方案：**
1. 檢查 `.github/workflows/generate-redirects.yml` 是否存在
2. 確認 workflow 檔案語法正確
3. 檢查 Actions 頁面的錯誤訊息

## 相關檔案

- `scripts/generate-redirects.js` - 重定向頁面生成腳本
- `.github/workflows/generate-redirects.yml` - GitHub Actions workflow
- `data/posts.json` - 文章資料（觸發來源）
- `wordpress-permalink-experiment.md` - 完整實驗記錄

## 授權

本系統為 b-log 專案的一部分，採用相同的授權條款。

## Facebook 自動發文

`.github/workflows/facebook-publish.yml` 會在「內容資料管線」成功跑完後檢查新文章，並透過 `scripts/publish-facebook-post.js` 將尚未發佈過的文章連結貼到 Facebook 粉絲專頁。

需要在 GitHub Repository Secrets 設定：

- `FB_PAGE_ID`：Facebook 粉絲專頁 ID
- `FB_PAGE_ACCESS_TOKEN`：具備發佈權限的 Page Access Token

可選 Repository Variable：

- `FB_GRAPH_API_VERSION`：Meta Graph API 版本，預設 `v25.0`

第一次執行時，若 `data/facebook-published.json` 不存在，腳本只會建立既有文章 baseline，不會把舊文章全部發出去。之後 `data/posts.json` 出現新的 slug 時才會自動發文。

## 首頁 LATEST 版面檢查

改首頁 LATEST 的版面前後各跑一次：

```bash
npm run check:layout
```

- 自己開一個本機靜態伺服器，用 `playwright-core` 的無頭 Chromium 開首頁，不用另外開 `python -m http.server`。
- 7 種寬度（375、820、1000、1216、1440、2056、2560）× 7 種內容：最新一篇、標題最長與最短、摘要最長與最短（都挑有封面的）、沒有封面、Crossing Field 分類頁。指定文章用站內搜尋完整標題換進 LATEST。
- 每格截 LATEST 那一塊，量高度、封面尺寸與比例、標題行數，檢查 AGENTS.md「首頁 LATEST 的版面」的規則：沒有橫向捲動、標題不超出欄寬、手機版封面在上且是 16:9、寬螢幕封面不比 4:3 窄、封面底部切齊文字（到 4:3 上限或 12rem 最矮高度的例外會列成備註）。
- 輸出到系統暫存資料夾（`--out <資料夾>` 可指定），裡面有一頁自帶圖片的比較板 `index.html` 和 `report.json`；`--open` 會直接用預設瀏覽器打開比較板。有格子沒通過時結束碼是 1。
- 需要 `playwright-core` 對應版本的 Chromium（放在 `~/Library/Caches/ms-playwright`）。缺的話：`npx playwright-core install chromium-headless-shell`。
