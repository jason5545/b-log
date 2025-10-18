# WebP 自動轉換與路徑相容性：為靜態部落格打造完整的圖片處理流程

當你為靜態網站加入圖片時，是否曾遇到這些問題：每次都要手動壓縮、轉換格式、更新 Markdown 參照？更糟的是，當你實作了 WordPress 風格的 URL 後，發現所有圖片都破圖了？

這篇文章記錄我如何從零打造一個完整的圖片處理自動化系統，解決了從格式轉換到路徑相容性的所有挑戰。

## 問題起源：靜態網站的圖片困境

### 手動處理的痛點

在為舊文章補充圖片時，我面臨了典型的靜態網站圖片管理問題：

1. **格式最佳化**：原始 JPG 檔案太大（單張 300+ KB）
2. **手動轉換**：每次都要開啟圖片編輯器轉換為 WebP
3. **Markdown 更新**：手動將 `![](...)` 改為 `<picture>` 標籤提供降級方案
4. **重複勞動**：每新增一張圖片就重複一次流程

這些步驟不僅耗時，更重要的是**容易出錯**且**無法規模化**。

### WordPress 風格 URL 的意外挑戰

更複雜的是，我的網站同時支援兩種 URL 格式：

- **舊格式**：`/post.html?slug=example`
- **新格式**：`/category/slug/`（WordPress 風格）

當我用相對路徑 `content/img/photo.jpg` 時：
- 在 `/post.html` 中能正常顯示
- 在 `/category/slug/` 中卻破圖了

問題在於**不同的 URL 深度導致相對路徑解析錯誤**。

## 技術選型：為何選擇這些工具

### WebP：現代化的圖片格式

**選擇理由**：
- 平均比 JPEG 小 25-35%
- 支援有損和無損壓縮
- 現代瀏覽器支援度高（Chrome, Firefox, Safari 14+）

**考量點**：
- 需要降級方案（`<picture>` 標籤）
- 轉換品質設定需要平衡（我選擇 85）

### Sharp：高效能的 Node.js 圖片處理

**選擇理由**：
- 基於 libvips，速度遠超其他 JavaScript 圖片庫
- API 簡潔易用
- 支援完整的 WebP 參數調整

**範例程式碼**：
```javascript
await sharp(imagePath)
  .webp({
    quality: 85,
    alphaQuality: 85,
    method: 6,  // 最佳壓縮
  })
  .toFile(webpPath);
```

### GitHub Actions：零成本的 CI/CD

**選擇理由**：
- 與 GitHub Pages 無縫整合
- 免費額度充足（公開 repo 無限制）
- 可自動提交變更

**替代方案考量**：
- Cloudflare Workers：需要額外設定，且無法修改原始碼
- Netlify Build Plugins：綁定平台
- 本地腳本：需要記得執行，容易遺忘

## 系統架構：三個腳本 + 一個 Workflow

### 架構概覽

```
使用者推送圖片
    ↓
GitHub Actions 觸發
    ↓
convert-to-webp.js ─→ 生成 WebP 檔案
    ↓
update-image-refs.js ─→ 更新 Markdown
    ↓
自動提交並推送
```

### 核心腳本 1：convert-to-webp.js

**功能**：
- 遞迴掃描 `content/img/` 目錄
- 找出所有 `.jpg`, `.jpeg`, `.png` 檔案
- 轉換為 WebP 並保留原檔（降級方案）
- 冪等性設計：已存在的 WebP 不重複轉換

**關鍵實作**：
```javascript
// 遞迴掃描
function findImages(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findImages(filePath, fileList);
    } else if (['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// 轉換並記錄統計
async function convertToWebP(imagePath) {
  const webpPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  if (fs.existsSync(webpPath)) {
    return { skipped: true };
  }

  const info = await sharp(imagePath)
    .webp({ quality: 85, alphaQuality: 85, method: 6 })
    .toFile(webpPath);

  const originalSize = fs.statSync(imagePath).size;
  const savings = ((1 - info.size / originalSize) * 100).toFixed(1);

  return { converted: true, originalSize, webpSize: info.size, savings };
}
```

**設計考量**：
- 使用 `method: 6` 取得最佳壓縮（雖然較慢，但 CI 環境無所謂）
- 保留原始檔案作為 `<picture>` 降級方案
- 詳細的統計輸出（節省空間、處理數量）

### 核心腳本 2：update-image-refs.js

**功能**：
- 掃描所有 Markdown 文章
- 找出 `![alt](path)` 格式的圖片
- 轉換為 `<picture>` 標籤

**關鍵實作**：
```javascript
function convertToPictureTag(match, alt, imagePath, markdownDir) {
  const parsedPath = path.parse(imagePath);
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);

  // 檢查 WebP 是否存在
  if (!hasWebPVersion(imagePath, markdownDir)) {
    return match;
  }

  // 正規化路徑並轉換為絕對路徑
  let normalizedWebpPath = webpPath.replace(/\\/g, '/');
  let normalizedImagePath = imagePath.replace(/\\/g, '/');

  normalizedWebpPath = normalizedWebpPath.replace(/^\.\.\/img\//, '/content/img/');
  normalizedImagePath = normalizedImagePath.replace(/^\.\.\/img\//, '/content/img/');

  return `<picture>
  <source srcset="${normalizedWebpPath}" type="image/webp">
  <img src="${normalizedImagePath}" alt="${alt}" loading="lazy">
</picture>`;
}
```

**設計考量**：
- 自動加入 `loading="lazy"` 屬性
- 路徑正規化（反斜線轉正斜線）
- **重點**：轉換為絕對路徑（解決 URL 深度問題，後續詳述）

### GitHub Actions Workflow

**觸發條件**：
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'content/img/**/*.jpg'
      - 'content/img/**/*.jpeg'
      - 'content/img/**/*.png'
```

**執行步驟**：
```yaml
jobs:
  convert-to-webp:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install sharp
      - run: node scripts/convert-to-webp.js
      - run: node scripts/update-image-refs.js
      - run: |
          git config user.name "github-actions[bot]"
          git add content/img/ content/posts/
          git commit -m "🖼️ 自動轉換圖片為 WebP 格式"
          git push
```

**關鍵設定**：
- `contents: write`：允許 bot 自動提交
- `paths` 過濾器：只在圖片變更時執行
- 使用 HEREDOC 格式化 commit message

## 路徑相容性難題：深度調查與解決

### 問題現象

系統上線後，發現 WordPress 風格 URL 的文章中所有圖片都破圖：

- ✅ `/post.html?slug=example` - 圖片正常
- ❌ `/life-stories/example/` - 圖片破圖

### 使用 Task Agent 深度調查

我啟動了 general-purpose agent 進行完整的程式碼調查，重點分析：

1. **Markdown 渲染流程**（`assets/main.js`）
2. **WordPress URL 生成機制**（`scripts/generate-redirects.js`）
3. **封面圖片為何正常顯示**（對照組）

**Agent 調查結果**：

```javascript
// assets/main.js 第 470-486 行
async function renderMarkdownContent(slug, contentEl) {
  const response = await fetch(`${POSTS_ROOT}${slug}.md?t=${Date.now()}`);
  // POSTS_ROOT = '/content/posts/'

  const markdown = await readUtf8Text(response);
  contentEl.innerHTML = window.marked.parse(markdown);
  // 關鍵：沒有任何圖片路徑轉換！

  enhanceCodeBlocks(contentEl);
}
```

**問題根源**：

| 訪問方式 | 頁面位置 | 圖片路徑 | 瀏覽器解析 |
|---------|---------|---------|-----------|
| 舊格式 | `/post.html` | `content/img/photo.jpg` | `/content/img/photo.jpg` ✅ |
| WordPress 格式 | `/life-stories/example/index.html` | `content/img/photo.jpg` | `/life-stories/example/content/img/photo.jpg` ❌ |

**關鍵發現**：
- Markdown 從 `/content/posts/{slug}.md` 載入
- `marked.js` 直接解析，**不處理路徑**
- 相對路徑相對於**當前頁面位置**解析
- WordPress 風格頁面在不同目錄深度，導致解析錯誤

### 解決方案：絕對路徑 + JavaScript 向後相容

**方案 1：修改 Markdown 為絕對路徑**

```markdown
<!-- 修改前 -->
<img src="content/img/2015/photo.jpg">

<!-- 修改後 -->
<img src="/content/img/2015/photo.jpg">
```

**優點**：
- 簡單直接
- 對所有 URL 深度都有效
- 符合 HTML 標準

**方案 2：JavaScript 自動轉換（向後相容）**

在 `assets/main.js` 的 `renderMarkdownContent()` 加入：

```javascript
// 修正圖片路徑：將相對路徑轉換為絕對路徑
contentEl.querySelectorAll('img, source').forEach(el => {
  const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
  const path = el.getAttribute(attr);
  if (path && path.startsWith('content/')) {
    el.setAttribute(attr, '/' + path);
  }
});
```

**優點**：
- 自動處理，無需修改現有 Markdown
- 向後相容舊內容
- 在客戶端動態修正

**最終採用**：兩者結合
- 新內容使用絕對路徑（規範）
- JavaScript 處理舊內容（相容）
- `update-image-refs.js` 自動生成絕對路徑

### 封面圖片也需要修正

別忘了 `data/posts.json` 中的 `coverImage` 也要使用絕對路徑：

```json
{
  "coverImage": "/content/img/2025/cover.jpg"
}
```

## 效能成果：實測數據

### 檔案大小最佳化

實測 3 張演唱會照片的轉換結果：

| 檔案 | 原始大小 | WebP 大小 | 節省 |
|------|---------|-----------|------|
| photo1.jpg | 152.6 KB | 115.8 KB | 24.1% |
| photo2.jpg | 195.3 KB | 156.9 KB | 19.6% |
| photo3.jpg | 312.3 KB | 303.5 KB | 2.8% |
| **總計** | **660.2 KB** | **576.2 KB** | **12.7%** |

**觀察**：
- 平均節省 12.7%（部分圖片節省高達 24.1%）
- 最後一張圖片節省較少（可能已經過壓縮）
- 品質設定 85 在視覺上無明顯差異

### 預期效能改善

基於 Web Vitals 標準：

- **FCP (First Contentful Paint)**：無影響（圖片非關鍵渲染路徑）
- **LCP (Largest Contentful Paint)**：預期改善 15-30%（封面圖片）
- **CLS (Cumulative Layout Shift)**：已透過 CSS 設定 `max-width: 100%` 和 `height: auto` 避免

### 自動化效益

**時間節省**：
- 手動處理：每張圖片約 2-3 分鐘
- 自動化後：0 分鐘（推送即可）

**錯誤減少**：
- 手動更新 Markdown 容易遺漏或格式錯誤
- 自動化保證一致性

## 可複用性：如何套用到其他專案

### 快速上手指南

1. **複製三個核心檔案**：
   - `scripts/convert-to-webp.js`
   - `scripts/update-image-refs.js`
   - `.github/workflows/convert-to-webp.yml`

2. **調整設定**：
   ```javascript
   const CONFIG = {
     imgDir: 'content/img',  // 改為你的圖片目錄
     quality: 85,            // 調整品質
     supportedFormats: ['.jpg', '.jpeg', '.png'],
   };
   ```

3. **設定 GitHub Actions 權限**：
   ```yaml
   permissions:
     contents: write
   ```

4. **推送圖片測試**：
   ```bash
   git add content/img/
   git push
   ```

### 關鍵要點總結

**路徑處理**：
- ✅ 使用絕對路徑（`/content/img/...`）
- ❌ 避免相對路徑（`content/img/...` 或 `../img/...`）
- 💡 加入 JavaScript 向後相容層

**自動化設計**：
- 冪等性：重複執行不會產生錯誤
- 詳細日誌：清楚顯示處理結果
- 錯誤處理：單一圖片失敗不影響整體流程

**品質控制**：
- WebP 品質 85 是視覺與檔案大小的平衡點
- 保留原始檔案作為降級方案
- 使用 `loading="lazy"` 改善初始載入

### 進階最佳化方向

1. **響應式圖片**：
   ```html
   <picture>
     <source srcset="/img/photo-800w.webp 800w, /img/photo-1200w.webp 1200w">
     <img src="/img/photo.jpg" alt="...">
   </picture>
   ```

2. **模糊預覽（LQIP）**：
   - 生成低品質預覽圖（10% 品質、10% 尺寸）
   - 使用 CSS `filter: blur()` 製作佔位符

3. **CDN 整合**：
   - 上傳到 Cloudinary 或 Imgix
   - 利用即時轉換和最佳化

4. **圖片尺寸限制**：
   - 加入尺寸檢查（如最大寬度 1920px）
   - 自動縮放過大的圖片

## 結語：自動化的價值

這個系統從無到有只花了幾小時，卻能在未來數年持續節省時間。更重要的是，它展示了幾個重要原則：

1. **深度調查勝於盲目嘗試**：使用 Task agent 系統性分析問題根源
2. **自動化要考慮相容性**：不能只解決新問題，也要處理舊內容
3. **文件化很重要**：詳細的 README 和 commit message 讓未來的自己（或他人）快速理解

如果你也在維護靜態網站，不妨考慮建立類似的自動化流程。初期投資的時間，會在長期得到數倍回報。

---

**相關資源**：
- [sharp 文件](https://sharp.pixelplumbing.com/)
- [WebP 規範](https://developers.google.com/speed/webp)
- [GitHub Actions 文件](https://docs.github.com/en/actions)
- [Web Vitals](https://web.dev/vitals/)
