# b-log 發布操作手冊（Codex Agent）

本文件是 b-log 靜態部落格系統的文章發布指南。你的工作是將使用者提供的文章內容轉換為 Markdown 並發布到部落格。

**你只負責格式轉換和發布流程，不修改文章的觀點、語氣或內容。**

---

## 專案概述

b-log 是一個純靜態部落格系統，部署在 GitHub Pages。不需要構建步驟，文章以 Markdown 儲存，元數據以 JSON 管理。

## 檔案結構

```
b-log/
├── content/posts/          # Markdown 文章檔案（{slug}.md）
├── data/posts.json         # 文章元數據目錄
├── feed.json               # JSON Feed
├── config/categories.json  # 分類映射（單一真實來源）
└── content/img/{year}/     # 文章圖片
```

## 發布流程

### 1. 建立 Markdown 檔案

檔案路徑：`content/posts/{slug}.md`

- 第一行必須是 `#` 開頭的標題
- 使用 GitHub-flavoured Markdown
- 儲存為 UTF-8 編碼
- 圖片使用絕對路徑：`![說明](/content/img/{year}/filename.jpg)`

### 2. 決定 slug

- 使用英文小寫、連字號分隔
- 簡潔描述文章主題
- 範例：`my-first-post`、`wordpress-migration-guide`

### 3. 更新 `data/posts.json`

在陣列中插入新物件，**保持逆時間排序**（最新的在最前面）：

```json
{
  "slug": "example-slug",
  "title": "文章標題",
  "summary": "簡短摘要（約 160 字元以內）",
  "category": "分類名稱",
  "author": "作者名稱",
  "publishedAt": "2025-10-17T00:00:00.000Z",
  "updatedAt": "2025-10-17T00:00:00.000Z",
  "readingTime": "10 min",
  "tags": ["tag1", "tag2"],
  "accentColor": "#556bff"
}
```

**必填欄位**：`slug`、`title`、`summary`、`category`、`author`、`publishedAt`、`tags`

**選填欄位**：
- `coverImage`：封面圖片路徑，省略時使用 `accentColor` 漸層
- `hasAudio`：設為 `true` 時顯示語音版圖示
- `readingTime`：閱讀時間估計
- `updatedAt`：更新時間
- `accentColor`：主題色

**注意**：
- `slug` 必須與 Markdown 檔案名稱一致
- 時間戳使用 ISO 8601 UTC 格式
- 舊文章放在陣列後方（保持逆時間排序）

### 4. 更新 `feed.json`

在 `items` 陣列中插入新條目，同樣**保持逆時間排序**：

```json
{
  "id": "example-slug",
  "url": "https://b-log.to/post.html?slug=example-slug",
  "title": "文章標題",
  "content_text": "文章摘要（第一人稱撰寫）",
  "date_published": "2025-10-17T00:00:00.000Z",
  "date_modified": "2025-10-17T00:00:00.000Z",
  "authors": [{ "name": "作者名稱" }],
  "tags": ["tag1", "tag2"]
}
```

**重要**：`content_text` 必須使用**第一人稱**撰寫。

### 5. 分類

從 `config/categories.json` 讀取可用的分類。如果需要新增分類：

1. 編輯 `config/categories.json`，在 `categoryMapping` 中新增
2. 分類名稱為中文，對應的 slug 為英文小寫連字號

### 6. 提交並推送

```bash
git add content/posts/{slug}.md data/posts.json feed.json
git commit -m "新增文章：{標題}"
git push
```

GitHub Actions 會自動：
1. 生成 WordPress 風格的 URL 重定向頁面（`/{category}/{slug}/index.html`）
2. 生成 sitemap.xml
3. 部署到 GitHub Pages

## 編輯現有文章

1. 修改 `content/posts/{slug}.md`
2. 更新 `data/posts.json` 中的 `updatedAt`
3. 更新 `feed.json` 中的 `date_modified`
4. 提交並推送

## 新增圖片

1. 將圖片放到 `content/img/{year}/` 目錄
2. 在 Markdown 中使用絕對路徑：`![說明](/content/img/{year}/photo.jpg)`
3. 如需設定封面，在 `posts.json` 加入 `coverImage` 欄位
4. 提交後，GitHub Actions 會自動將圖片轉換為 WebP 格式並更新路徑

## 格式轉換注意事項

將使用者的 Word 或文字內容轉為 Markdown 時：

- **不修改內容**：不改觀點、不改語氣、不潤飾文字
- **只處理格式**：標題層級、粗體、清單、連結、圖片
- **標點符號**：中文內容使用全形標點（，。！？），英文和數字使用半形
- **編碼**：一律 UTF-8

## 台灣用語規範

文章元數據和系統訊息使用台灣正體中文：

- 設定（非「設置」）
- 執行（非「運行」）
- 最佳化（非「優化」）
- 程式（非「程序」）
- 資料夾（非「文件夾」）

## 驗證清單

發布前確認：

- [ ] Markdown 檔案第一行是 `#` 標題
- [ ] `slug` 與檔案名稱一致
- [ ] `posts.json` 格式正確且保持逆時間排序
- [ ] `feed.json` 格式正確且保持逆時間排序
- [ ] `feed.json` 的 `content_text` 是第一人稱
- [ ] 時間戳為 ISO 8601 UTC 格式
- [ ] 分類存在於 `config/categories.json`
- [ ] JSON 格式驗證通過（無語法錯誤）

## 禁止事項

- **不要**修改 `assets/main.js` 或 `assets/main.min.js` 或 `assets/styles.css`
- **不要**刪除 `data/posts.json` 中的現有屬性
- **不要**刪除任何現有檔案
- **不要**使用 PowerShell 處理中文檔案（會導致編碼損壞）
- **不要**修改文章的內容、觀點或語氣
