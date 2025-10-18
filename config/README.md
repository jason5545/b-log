# 設定檔說明

## 📁 config/categories.json

此檔案集中管理部落格的分類映射，避免在多個檔案中重複定義。

### 檔案結構

```json
{
  "categoryMapping": {
    "中文分類名稱": "英文-slug"
  }
}
```

### 使用位置

此設定檔會被以下檔案使用：

1. **`scripts/generate-redirects.js`** (Node.js 環境)
   - 使用 `fs.readFileSync()` 同步讀取
   - 用於生成 WordPress 風格的永久連結頁面

2. **`assets/main.js`** (瀏覽器環境)
   - 使用 `fetch('/config/categories.json')` 非同步載入
   - 在 `DOMContentLoaded` 事件時預先載入
   - 包含降級方案：如果載入失敗，使用硬編碼的預設值

### 新增分類

若要新增分類，只需在 `categoryMapping` 中加入新的鍵值對：

```json
{
  "categoryMapping": {
    "AI 分析": "ai-analysis",
    "技術開發": "tech-development",
    "技術分析": "tech-analysis",
    "開發哲學": "dev-philosophy",
    "生活記事": "life-stories",
    "新分類": "new-category"  // 新增這行
  }
}
```

**注意**：
- 分類名稱（鍵）：使用中文，顯示在網站上
- URL slug（值）：使用英文小寫 + 連字號，用於 URL 路徑
- 修改後需重新執行 `node scripts/generate-redirects.js` 生成新的重定向頁面

### 效益

✅ **單一真實來源**：所有分類定義集中管理
✅ **避免不一致**：不再需要在兩個檔案中同步維護
✅ **易於擴充**：新增分類只需修改一個檔案
✅ **降級保護**：前端載入失敗時自動使用預設值
