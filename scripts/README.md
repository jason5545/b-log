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

### 查詢參數 URL（舊格式，仍支援）

```
https://b-log.to/post.html?slug=openai-contradiction-dangerous-game
```

**兩種格式都能正常使用！** 新格式會自動重定向到舊格式，確保向後相容。

## 重定向頁面範例

每個重定向頁面包含：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>文章標題 - b-log</title>
  <!-- Meta refresh 重定向 -->
  <meta http-equiv="refresh" content="0; url=/post.html?slug=article-slug">
  <!-- Canonical URL -->
  <link rel="canonical" href="https://b-log.to/post.html?slug=article-slug">
  <!-- JavaScript 重定向（更快） -->
  <script>
    window.location.replace('/post.html?slug=article-slug');
  </script>
</head>
<body>
  <p>正在重定向至 <a href="/post.html?slug=article-slug">文章標題</a>...</p>
</body>
</html>
```

## 技術優勢

### ✅ 解決的問題

1. **GitHub Pages 限制**：透過實際的目錄結構，繞過靜態網站不支援動態路由的限制
2. **SEO 友好**：WordPress 風格的 URL 更簡潔、更容易被搜尋引擎索引
3. **自動化維護**：完全自動化，無需手動干預

### ⚡ 效能優化

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
