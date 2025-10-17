# WordPress 永久連結實作：從概念到實踐

## 前言

在網站開發中，URL 結構不僅影響使用者體驗，更直接關係到 SEO 效果。WordPress 風格的永久連結（Permalinks）是業界公認的最佳實踐之一。本文將分享我在實作 WordPress 風格永久連結系統時的經驗與心得。

## 什麼是 WordPress 風格的永久連結

### 傳統 URL vs WordPress 風格

**傳統動態 URL：**
```
https://example.com/post.php?id=123
https://example.com/article?type=tech&date=2025-01-01
```

**WordPress 風格永久連結：**
```
https://example.com/tech-development/my-awesome-post/
https://example.com/ai-analysis/openai-vs-anthropic/
```

### 為什麼選擇 WordPress 風格

1. **SEO 友善**：URL 包含關鍵字，提升搜尋引擎排名
2. **使用者友善**：URL 直觀易懂，便於分享和記憶
3. **階層結構**：反映網站內容的分類層次
4. **穩定性**：永久不變的連結，確保長期可用

## 實作架構設計

### 系統需求

1. **URL 重寫**：將友好 URL 轉換為內部參數
2. **路由系統**：根據 URL 解析對應的內容
3. **資料庫設計**：儲存文章與其永久連結的對應關係
4. **自動生成**：根據文章標題自動產生永久連結

### 技術選擇

**前端：**
- 純 HTML/CSS/JavaScript（無框架依賴）
- Service Worker 實現快取機制

**後端（模擬）：**
- GitHub Actions 作為自動化流程
- Node.js 腳本處理重定向頁面生成

**資料結構：**
```json
{
  "slug": "wordpress-permalink-implementation",
  "title": "WordPress 永久連結實作：從概念到實踐",
  "category": "技術開發",
  "publishedAt": "2025-10-17T00:30:00.000Z"
}
```

## 實作步驟詳解

### 步驟 1：設計 URL 結構

根據 WordPress 的最佳實踐，我們選擇以下結構：
```
/{category}/{slug}/
```

**分類對應表：**
```javascript
const categoryMapping = {
  "AI 分析": "ai-analysis",
  "技術開發": "tech-development", 
  "技術分析": "tech-analysis",
  "開發哲學": "dev-philosophy"
};
```

### 步驟 2：實作路由系統

**前端路由邏輯：**
```javascript
// 解析當前 URL
function parseCurrentPath() {
  const path = window.location.pathname;
  
  // 移除開頭和結尾的斜線
  const cleanPath = path.replace(/^\/|\/$/g, '');
  
  // 分割路徑部分
  const parts = cleanPath.split('/');
  
  if (parts.length === 2) {
    return {
      category: parts[0],
      slug: parts[1]
    };
  }
  
  return null; // 不是永久連結格式
}

// 根據解析結果載入內容
function loadContent(category, slug) {
  // 轉換分類程式碼回中文
  const reverseCategoryMap = {
    "ai-analysis": "AI 分析",
    "tech-development": "技術開發",
    "tech-analysis": "技術分析", 
    "dev-philosophy": "開發哲學"
  };
  
  const chineseCategory = reverseCategoryMap[category];
  
  // 載入對應文章
  loadPost(slug, chineseCategory);
}
```

### 步驟 3：自動生成重定向頁面

**Node.js 生成腳本：**
```javascript
// scripts/generate-redirects.js
const fs = require('fs');
const path = require('path');

// 分類映射
const categoryMapping = {
  "AI 分析": "ai-analysis",
  "技術開發": "tech-development",
  "技術分析": "tech-analysis", 
  "開發哲學": "dev-philosophy"
};

// 讀取文章資料
const postsData = JSON.parse(fs.readFileSync('data/posts.json', 'utf8'));

// 為每篇文章生成重定向頁面
postsData.forEach(post => {
  const categorySlug = categoryMapping[post.category];
  const redirectPath = `${categorySlug}/${post.slug}/`;
  const fullPath = path.join(__dirname, '..', redirectPath, 'index.html');
  
  // 確保目錄存在
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  
  // 生成重定向頁面內容
  const redirectContent = generateRedirectPage(post, redirectPath);
  
  // 寫入檔案
  fs.writeFileSync(fullPath, redirectContent);
  console.log(`Generated: ${redirectPath}`);
});

function generateRedirectPage(post, redirectPath) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title}</title>
  <meta http-equiv="refresh" content="0; url=/post.html?slug=${post.slug}">
  <link rel="canonical" href="https://b-log.to/post.html?slug=${post.slug}">
</head>
<body>
  <p>正在重新導向至文章頁面...</p>
  <p>如果您的瀏覽器沒有自動重新導向，請點擊<a href="/post.html?slug=${post.slug}">這裡</a>。</p>
</body>
</html>`;
}
```

### 步驟 4：設定 GitHub Actions 自動化

**工作流程配置：**
```yaml
# .github/workflows/generate-redirects.yml
name: 生成重定向頁面

on:
  push:
    branches: [ main ]
    paths: [ 'data/posts.json' ]

jobs:
  generate-redirects:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: 設定 Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: 生成重定向頁面
      run: node scripts/generate-redirects.js
      
    - name: 提交變更
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add .
        git commit -m "自動生成重定向頁面" || exit 0
        git push
```

## 實作過程中的挑戰與解決方案

### 挑戰 1：中文分類轉換

**問題：** 分類名稱包含中文字元，無法直接用於 URL

**解決方案：**
```javascript
// 建立雙向映射表
const categoryMapping = {
  "AI 分析": "ai-analysis",
  "技術開發": "tech-development",
  "技術分析": "tech-analysis",
  "開發哲學": "dev-philosophy"
};

const reverseCategoryMapping = Object.fromEntries(
  Object.entries(categoryMapping).map(([key, value]) => [value, key])
);

// 自動轉換函數
function slugifyCategory(category) {
  return categoryMapping[category] || category;
}

function unslugifyCategory(slug) {
  return reverseCategoryMapping[slug] || slug;
}
```

### 挑戰 2：向後相容性

**問題：** 舊的 URL 格式 (`/post.html?slug=xxx`) 仍需正常運作

**解決方案：**
```javascript
// 檢測 URL 格式並統一處理
function handleRouting() {
  const urlParams = new URLSearchParams(window.location.search);
  const slugFromQuery = urlParams.get('slug');
  
  if (slugFromQuery) {
    // 舊格式：/post.html?slug=xxx
    loadPost(slugFromQuery);
  } else {
    // 新格式：/{category}/{slug}/
    const parsed = parseCurrentPath();
    if (parsed) {
      loadContent(parsed.category, parsed.slug);
    } else {
      // 首頁或其他頁面
      loadHomepage();
    }
  }
}
```

### 挑戰 3：SEO 最佳化

**問題：** 確保搜尋引擎能正確索引新的 URL 結構

**解決方案：**
```html
<!-- 在重定向頁面中加入 SEO 標籤 -->
<meta name="description" content="${post.summary}">
<meta name="keywords" content="${post.tags.join(', ')}">
<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.summary}">
<meta property="og:url" content="https://b-log.to/${redirectPath}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://b-log.to/post.html?slug=${post.slug}">
```

## 效能最佳化策略

### 1. 預生成靜態頁面

不是每次請求都動態生成，而是在文章更新時預先生成所有重定向頁面。

### 2. 快取策略

```javascript
// Service Worker 快取策略
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/post.html?slug=')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response; // 返回快取版本
          }
          return fetch(event.request).then(response => {
            // 快取新版本
            return caches.open('posts-cache').then(cache => {
              cache.put(event.request, response.clone());
              return response;
            });
          });
        })
    );
  }
});
```

### 3. 懶加載內容

```javascript
// 只在需要時載入文章內容
function loadPost(slug) {
  // 顯示載入指示器
  showLoadingIndicator();
  
  // 懶加載文章內容
  fetch(`content/posts/${slug}.md`)
    .then(response => response.text())
    .then(markdown => {
      const html = parseMarkdown(markdown);
      document.getElementById('content').innerHTML = html;
      hideLoadingIndicator();
    })
    .catch(error => {
      showError('無法載入文章內容');
      hideLoadingIndicator();
    });
}
```

## 測試與驗證

### 測試案例

1. **新格式 URL 存取**
   - 輸入：`/tech-development/wordpress-permalink-implementation/`
   - 預期：正確載入對應文章

2. **舊格式 URL 向後相容**
   - 輸入：`/post.html?slug=wordpress-permalink-implementation`
   - 預期：正確載入對應文章

3. **無效 URL 處理**
   - 輸入：`/invalid-category/invalid-post/`
   - 預期：導向 404 頁面

4. **分類頁面**
   - 輸入：`/tech-development/`
   - 預期：顯示該分類下的所有文章

### 自動化測試

```javascript
// 測試腳本
const testCases = [
  {
    name: '新格式 URL',
    url: '/tech-development/wordpress-permalink-implementation/',
    expectedSlug: 'wordpress-permalink-implementation'
  },
  {
    name: '舊格式 URL',
    url: '/post.html?slug=wordpress-permalink-implementation',
    expectedSlug: 'wordpress-permalink-implementation'
  }
];

testCases.forEach(test => {
  console.log(`測試: ${test.name}`);
  
  // 模擬 URL 解析
  const result = parseUrl(test.url);
  
  if (result.slug === test.expectedSlug) {
    console.log('✅ 通過');
  } else {
    console.log(`❌ 失敗: 預期 ${test.expectedSlug}, 實際 ${result.slug}`);
  }
});
```

## 維護與更新

### 新增文章流程

1. **撰寫 Markdown 內容**
   ```
   content/posts/new-article.md
   ```

2. **更新文章目錄**
   ```json
   // data/posts.json
   {
     "slug": "new-article",
     "title": "新文章標題",
     "category": "技術開發",
     // ... 其他欄位
   }
   ```

3. **自動觸發重新生成**
   - GitHub Actions 自動偵測 `data/posts.json` 變更
   - 執行 `scripts/generate-redirects.js`
   - 生成新的重定向頁面
   - 自動提交變更

### 新增分類

1. **更新分類映射**
   ```javascript
   // scripts/generate-redirects.js
   const categoryMapping = {
     // 現有分類...
     "新分類": "new-category"
   };
   ```

2. **更新前端映射**
   ```javascript
   // assets/main.js
   const categoryMapping = {
     // 現有分類...
     "新分類": "new-category"
   };
   ```

3. **重新生成所有頁面**
   ```bash
   node scripts/generate-redirects.js
   ```

## 總結與心得

### 實作成果

1. **SEO 提升**：友好的 URL 結構提升搜尋引擎排名
2. **使用者體驗改善**：直觀的 URL 便於分享和記憶
3. **自動化流程**：GitHub Actions 確保一致性
4. **向後相容**：舊 URL 繼續正常運作

### 技術收穫

1. **URL 設計原則**：學習了如何設計使用者友善的 URL 結構
2. **自動化流程**：掌握了 GitHub Actions 的實際應用
3. **前後端協作**：理解了如何在前端實現路由系統
4. **效能最佳化**：學習了靜態生成和快取策略

### 未來改進方向

1. **國際化支援**：支援多語言 URL 結構
2. **更靈活的路由**：支援更深層的分類結構
3. **自動化測試**：建立完整的測試流程
4. **效能監控**：加入載入時間和錯誤追蹤

WordPress 風格的永久連結實作不僅是技術問題，更是使用者體驗和 SEO 策略的重要組成部分。透過系統化的設計和自動化流程，我們可以建立一個既友善又高效的網站 URL 結構。