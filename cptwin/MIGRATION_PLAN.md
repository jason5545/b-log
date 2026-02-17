# cptwin.com WordPress 遷移計畫

## 來源

- 網站：cptwin.com
- 系統：WordPress
- 主機面板：StackCP（20i）
- 文章數量：約 400 篇（累積 10 年）
- 有圖片，無語音檔
- 主機速度極慢

## 分類映射

WordPress 分類 → b-log slug：

| WordPress 分類 | b-log slug |
|---------------|------------|
| 媽媽經 | parenting |
| 就學與學習 | education |
| 夯話題 | trending |

> 如果實際匯出後發現更多分類，再補充。

## 遷移步驟

### Step 1：下載圖片（用 lftp）

從 StackCP 後台取得 FTP/SFTP 連線資訊（主機、帳號、密碼、Port）。

```bash
# 安裝 lftp（如果還沒裝）
brew install lftp

# 批量下載 uploads 資料夾，支援斷點續傳
lftp -u USERNAME,PASSWORD ftp://HOST -e "mirror wp-content/uploads/ ./cptwin/uploads; quit"
```

- 主機很慢，掛著跑就好
- 斷了重跑會跳過已下載的檔案
- 下載完成後圖片會在 `cptwin/uploads/` 裡，結構是 `{year}/{month}/filename.jpg`

### Step 2：匯出 WordPress XML

WordPress 後台 → 工具 → 匯出 → 所有內容 → 下載匯出檔案。

把 XML 檔案放到 `cptwin/` 資料夾。

### Step 3：執行遷移腳本（待開發）

```bash
node cptwin/migrate.js --xml cptwin/export.xml --uploads cptwin/uploads
```

腳本功能：
1. 解析 WordPress XML
2. 只處理已發布的文章（跳過草稿、私人文章）
3. HTML → Markdown 轉換
4. 從本地 uploads 資料夾複製圖片到 `content/img/{year}/`
5. 替換圖片路徑為 `/content/img/{year}/filename.jpg`
6. 生成每篇 `content/posts/{slug}.md`
7. 生成完整的 `data/posts.json`（逆時間排序）
8. 生成完整的 `feed.json`（逆時間排序）
9. 更新 `config/categories.json`

### Step 4：驗證

- [ ] 抽查幾篇文章的 Markdown 格式
- [ ] 確認圖片路徑正確
- [ ] 驗證 JSON 格式
- [ ] 本地跑 `python -m http.server 8000` 確認顯示正常

### Step 5：推送

```bash
git add .
git commit -m "遷移 WordPress 文章"
git push
```

GitHub Actions 自動生成重定向頁面和 sitemap。

## 待處理

- [ ] 取得 StackCP FTP/SFTP 連線資訊
- [ ] 下載圖片
- [ ] 匯出 WordPress XML
- [ ] 開發遷移腳本（`cptwin/migrate.js`）
- [ ] 整合 Cusdis 留言系統（取代 Giscus）
- [ ] 確認 WordPress 留言是否需要保留

## 注意事項

- 不要用 PowerShell 處理中文檔案
- 圖片推送後 GitHub Actions 會自動轉 WebP
- 遷移腳本用 Node.js 寫（專案已有 Node.js 環境）
- HTML 轉 Markdown 可能需要人工檢查清理（WordPress HTML 常常很髒）
