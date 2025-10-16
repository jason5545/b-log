
# WordPress風格永久連結實驗記錄

## 概述

本文檔記錄了將 b-log 網站的永久連結從 `post.html?slug={slug}` 格式改為WordPress風格的 `/{category}/{slug}/` 格式的完整實驗過程，包括實施、遇到的問題、解決方案以及最終撤回的決定。

## 實驗目標

將現有的查詢參數式永久連結：
```
https://b-log.to/post.html?slug=openai-contradiction-dangerous-game
```

改為WordPress風格的目錄式永久連結：
```
https://b-log.to/ai-analysis/openai-contradiction-dangerous-game/
```

## 實施過程

### 第一階段：基礎實施

#### 1. 分析現有結構
- 現有永久連結格式：`post.html?slug={slug}`
- 所有文章連結由 JavaScript 中的 `slugToPath()` 函數生成
- 文章分類存儲在 `data/posts.json` 中，使用中文分類名稱

#### 2. 修改 slugToPath 函數
```javascript
// 原始函數
function slugToPath(slug) {
  return `post.html?slug=${encodeURIComponent(slug)}`;
}

// 修改後的函數
const categoryMapping = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy'
};

function slugToPath(slug, category) {
  if (category) {
    const categorySlug = categoryMapping[category] || category.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    return `${categorySlug}/${slug}/`;
  }
  return `${slug}/`;
}
```

#### 3. 更新URL解析邏輯
修改 `renderArticle()` 函數以支援從URL路徑中提取slug：
```javascript
// 從URL路徑中提取slug，支援WordPress風格的永久連結
const pathParts = window.location.pathname.split('/').filter(part => part);
let slug = null;

if (pathParts.length > 0) {
  slug = pathParts[pathParts.length - 1];
  if (slug.endsWith('/')) {
    slug = slug.slice(0, -1);
  }
}

// 向後兼容：如果從路徑中找不到slug，嘗試從查詢參數中獲取
if (!slug) {
  const params = new URLSearchParams(window.location.search);
  slug = params.get('slug');
}
```

#### 4. 添加重定向機制
```javascript
// 如果使用的是舊的查詢參數格式，重定向到新的WordPress風格URL
const params = new URLSearchParams(window.location.search);
if (params.get('slug')) {
  const post = posts[index];
  const newUrl = slugToPath(post.slug, post.category);
  window.history.replaceState({}, '', newUrl);
}
```

#### 5. 更新所有相關連結
- 首頁文章連結
- 特色文章連結
- 導航連結
- 相關文章連結
- 分享連結
- metadata中的URL

#### 6. 更新 feed.json
將所有文章URL從舊格式改為新格式：
```json
{
  "id": "openai-contradiction-dangerous-game",
  "url": "https://b-log.to/ai-analysis/openai-contradiction-dangerous-game/",
  // ...其他欄位
}
```

### 第二階段：解決GitHub Pages限制

#### 問題發現
測試時發現GitHub Pages不支援自定義URL路由，新格式的URL返回404錯誤：
```
HTTP/1.1 404 Not Found
```

#### 解決方案1：404頁面重定向
創建 `404.html` 頁面，檢測新格式的URL並重定向到舊格式：
```javascript
// 檢查是否是WordPress風格的URL
function isWordPressUrl(pathname) {
  const parsed = parseWordPressUrl(pathname);
  return parsed && parsed.slug && parsed.categorySlug;
}

// 重定向到正確的頁面
function redirectToPost() {
  if (isWordPressUrl(window.location.pathname)) {
    const parsed = parseWordPressUrl(window.location.pathname);
    const newUrl = `post.html?slug=${parsed.slug}`;
    window.location.replace(newUrl);
    return;
  }
  show404Page();
}
```

#### 解決方案2：實際目錄結構
由於404頁面方法可能有延遲，創建實際的目錄結構：
1. 為每個英文分類創建目錄：
   - `ai-analysis/`
   - `tech-development/`
   - `tech-analysis/`
   - `dev-philosophy/`

2. 為每篇文章創建重定向頁面：
```html
<!-- ai-analysis/openai-contradiction-dangerous-game.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲 - b-log</title>
  <meta http-equiv="refresh" content="0; url=/post.html?slug=openai-contradiction-dangerous-game">
  <script>
    window.location.replace('/post.html?slug=openai-contradiction-dangerous-game');
  </script>
</head>
<body>
  <p>Redirecting to <a href="/post.html?slug=openai-contradiction-dangerous-game">OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲</a>...</p>
</body>
</html>
```

### 第三階段：文檔更新

更新 `agent.md` 文檔，添加：
- 永久連結結構說明
- 中文分類到英文的映射表
- URL格式示例
- 向後兼容性說明

## 遇到的問題

### 1. 中文分類在URL中的問題
**問題**：中文分類名稱在URL中會導致編碼問題和SEO問題。

**解決方案**：創建中文分類到英文的映射表，使用URL友好的英文分類名稱。

### 2. GitHub Pages不支援自定義URL路由
**問題**：GitHub Pages是靜態網站托管服務，不支援動態URL路由，新格式的URL返回404錯誤。

**解決方案**：
- 創建404頁面處理重定向
- 創建實際的目錄結構和重定向頁面

### 3. 雙重重定向的複雜性
**問題**：需要維護兩套重定向機制，增加了複雜性。

**解決方案**：優先使用實際目錄結構，404頁面作為備用方案。

## 最終決定：撤回所有修改

### 撤回原因
1. **複雜性增加**：需要維護大量的重定向頁面和目錄結構
2. **維護成本高**：每新增一篇文章就需要創建對應的重定向頁面
3. **GitHub Pages限制**：無法實現真正的服務器端重定向
4. **收益有限**：現有的查詢參數式URL已經足夠使用

### 撤回過程
1. 使用 `git reset --hard bb467ab` 回到修改前的狀態
2. 使用 `git push --force` 強制更新遠端倉庫
3. 手動恢復 `agent.md` 到原始狀態（不推送）

## 經驗總結

### 技術方面
1. **GitHub Pages限制**：靜態網站托管服務在URL路由方面有顯著限制
2. **重定向策略**：多層重定向會增加複雜性和潛在的性能問題
3. **維護成本**：動態URL結構需要自動化工具支持，手動維護不可持續

### 決策方面
1. **需求評估**：WordPress風格URL雖然美觀，但對於現有系統的實際價值有限
2. **成本效益分析**：實施成本超過了預期收益
3. **技術債務**：複雜的解決方案可能會引入長期維護問題

### 未來改進方向
1. **遷移到動態平台**：考慮遷移到支援自定義路由的平台（如Netlify、Vercel等）
2. **自動化工具**：如果需要實施，應該開發自動化工具生成重定向頁面
3. **漸進式改進**：考慮小範圍測試，而不是全面實施

## 結論

雖然WordPress風格的永久連結在SEO和用戶體驗方面有一定優勢，但在GitHub Pages的靜態環境下實施會帶來過多的複雜性和維護成本。在當前的技術棧和需求下，維持現有的查詢參數式永久連結是更實際的選擇。

這次實驗雖然最終被撤回，但提供了寶貴的經驗，對未來可能的平台遷移或技術改進有重要參考價值。

---

*記錄日期：2025-10-17*  
*實驗期間：2025-10-16 至 2025-10-17*