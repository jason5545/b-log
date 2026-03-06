# 一張 Logo 圖片擋了所有人兩年：逆向台北市復康巴士登入機制

## 背景

我是重度身障者，日常出行靠台北市的復康巴士。訂車要透過一個 15 年以上的 JSP 網站：`0809080650.gov.taipei`。

我做這件事的動機很單純：**讓自己能順利去上班，而且不會忘記訂車。** 沒有其他意圖，沒有要搶占資源，也沒有要破壞任何系統。

理想情況下，這件事根本不需要自己動手。如果政府能提供批次預約或自動排程功能，我完全不需要走這條路。我也確實去問過——台北市目前的立場是，只有高中生有所謂的「特教專案」可以申請固定排車，其他身障者一律沒有，而且這項政策 20 年來從未改過。每次出行都要自己手動訂。

所以只剩一條路：自動化這個訂車流程。

目前有一套能用的方案：用 Claude Code 的瀏覽器自動化（claude-in-chrome MCP）操作 Chrome 完成訂車。但它依賴一個真實的 Chrome 視窗——不能跑在 headless Docker 裡，不能用在純文字環境。

所以我想做一件看起來很簡單的事：**用 curl 或 Python 登入這個網站。**

表單只有兩個欄位——帳號和密碼，POST 到 `/`。沒有 CSRF token，沒有隱藏欄位。前端 JS 只是 `setTimeout` 延遲兩秒後 `form.submit()`。看起來是隨便一個 `curl -d` 就能解決的事。

事實證明不是。

## 12 種方法，全部失敗

兩年前已經有人研究過這個問題，結論是放棄。我接手之後，又花了幾個月，試了以下所有方法：

| # | 方法 | 結果 |
|---|------|------|
| 1 | curl 標準 POST | 失敗 |
| 2 | curl 完全模擬 Chrome headers | 失敗 |
| 3 | Python requests | 失敗 |
| 4 | Python httpx | 失敗 |
| 5 | curl_cffi（模擬 Chrome TLS 指紋） | 失敗 |
| 6 | Node.js fetch | 失敗 |
| 7 | 各種 Sec-Fetch-* header 組合 | 失敗 |
| 8 | Tomcat URL 路由技巧（%2F 繞過代理） | 到了 Tomcat 但登入仍失敗 |
| 9 | multipart 等各種 POST body 格式 | 失敗 |
| 10 | 同一 TCP 連線 GET+POST | 失敗 |
| 11 | 連續重試多次 | 失敗 |
| 12 | 延遲 2 秒再 POST | 失敗 |

每一次「失敗」都長一樣：伺服器返回 7655 bytes 的登入頁面，`Server-Timing: total;dur=5.xxx`，連 SQL 查詢都沒跑到。密碼對或錯，回應完全一樣——**伺服器在驗證密碼之前就把請求擋掉了。**

## 把所有人帶偏的線索

這個問題最棘手的地方不是答案有多複雜，而是所有線索都指向錯誤的方向。

**線索一：瀏覽器的 fetch() 也能成功。** 在 Chrome console 裡執行最簡單的 `fetch('/', {method: 'POST', body: 'ac=...&ps=...'})` ，不加任何額外 header，100% 成功。這排除了「伺服器檢查特定 header」的可能性——至少看起來是這樣。

**線索二：curl_cffi 也失敗。** curl_cffi 可以模擬 Chrome 的 TLS 指紋（JA3），理論上能騙過 TLS 層的檢測。它也失敗了。這讓所有人都覺得問題不在 TLS 層。

**線索三：Server-Timing 的誤導。** 失敗時伺服器回傳 `total;dur=5.xxx`——整整 5 秒的處理時間。5 秒很長，讓人直覺以為伺服器在做某種複雜的驗證。但成功時只有不到 2 秒。失敗反而比成功慢，這不合理。

**線索四：TLS 憑證本身就壞的。** 這個網站的 SSL 憑證缺少 Subject Key Identifier，所有工具都需要 `--insecure` 或 `verify=False` 才連得上。一個連 TLS 憑證都搞不好的系統，怎麼可能有 TLS 指紋檢測？

這四條線索把所有人的注意力都拉到了 TLS 層和 HTTP header 層。但答案不在那裡。

## 突破口

在幾乎要放棄的時候，我決定試最笨的方法：**完整模擬瀏覽器載入頁面的整個過程。**

不只是 POST 登入表單，而是先 GET 首頁、載入所有 JS、CSS、圖片、等幾秒、然後再 POST。如果真實瀏覽器就是這樣做的，那我也照做。

```python
s = requests.Session()
s.get('https://0809080650.gov.taipei/', verify=False)

# 載入瀏覽器會載入的所有資源
for res in ['/func.js', '/func2.js', '/js/eventTool.js',
            '/js/baseTool.js', '/img2.gif', '/favicon.ico', ...]:
    s.get(f'https://0809080650.gov.taipei{res}', verify=False)

time.sleep(3)

r = s.post('https://0809080650.gov.taipei/',
    data={'ac': '帳號', 'ps': '密碼'},
    headers={'Referer': 'https://0809080650.gov.taipei/'},
    verify=False)
```

**登入成功了。**

`Server-Timing` 第一次出現了 `desc="0 sql"`——伺服器終於去查密碼了。回應從 7655 bytes 變成 2122 bytes，302 重定向到 `index2.jsp`，頁面上顯示我的名字。

兩年的謎題，第一次看到曙光。

## 縮小範圍

知道「載入全部資源」能成功之後，下一步是找出最小必要條件。我把 13 個資源一個一個單獨測試：

| 資源 | 結果 |
|------|------|
| func.js | 失敗 |
| func2.js | 失敗 |
| favicon.ico | 失敗 |
| **img2.gif** | **成功** |
| jjTool.css | 失敗 |
| eventTool.js | 失敗 |
| nonexistent.gif | 失敗 |

**只有 `img2.gif` 有效。** 不是「任何資源」，也不是「任何圖片」，就是這一張登入頁面的 logo。伺服器在 session 裡追蹤了你有沒有載入這張特定的圖片。

接著測延遲：

| 延遲 | 結果 |
|------|------|
| 0 秒 | 失敗 |
| 1 秒 | 失敗 |
| 1.9 秒 | 失敗 |
| **2.0 秒** | **成功** |
| 3.0 秒 | 成功 |

精確到 2.0 秒，對應前端 `chk()` 函數的 `setTimeout(..., 2000)`。

最後測 headers：

- User-Agent：**不需要。** 連 `bot` 都能過。
- Origin：不需要。
- Sec-Fetch-*：不需要。
- **Referer：必須。**

## 完整的機制

伺服器的防機器人檢查有三道，缺一不可：

1. **GET /img2.gif** — 登入頁的 logo 是 server-side 的 web beacon。載入時在 session 設 flag 並記錄時間戳。
2. **等 2 秒以上** — 從 img2.gif 載入後算起。確認客戶端有執行 JavaScript（`chk()` 強制延遲 2 秒）。
3. **POST 帶 Referer** — 確認請求來自同一個網頁。

這就是最小可行的 curl 登入：

```bash
curl -k -s -c cookies.txt https://0809080650.gov.taipei/ > /dev/null
curl -k -s -b cookies.txt https://0809080650.gov.taipei/img2.gif > /dev/null
sleep 2
curl -k -s -b cookies.txt -c cookies.txt \
  -d "ac=帳號&ps=密碼" \
  -H "Referer: https://0809080650.gov.taipei/" \
  -L https://0809080650.gov.taipei/
```

四行。不需要 Selenium，不需要 Puppeteer，不需要真實瀏覽器。

## 為什麼它擋了所有人兩年

事後來看，這三道檢查在技術上極其簡單。一個寫死的檔名、一個計時器、一個 header。但它有效地擋住了所有人兩年以上，原因是：

**它不在任何 checklist 上。**

標準的逆向工程流程是：看 headers → 看 cookies → 看 TLS 指紋 → 看 JS 混淆。沒有人會想到「試試載入頁面上的圖片」。這不是任何 WAF 產品的功能，不是任何安全框架的模式，可能就是某個工程師十五年前隨手寫的。

而且 Server-Timing 的 5 秒誤導非常致命。它讓人覺得伺服器在做複雜的驗證，把注意力拉到 TLS 和連線層。但那 5 秒大概只是 Tomcat 在等 timeout。

最諷刺的是：一個連 TLS 憑證都搞不好的系統，用一張 logo 圖片擋住了 curl_cffi 這種專門模擬 TLS 指紋的工具。所有人都在研究高深的加密層差異，答案卻是最樸素的 HTTP GET。

## 對這個防護的看法

這不是好的安全設計。沒有隨機性、沒有 CSRF token、密碼是身分證後六碼。Server-Timing header 直接洩漏後端架構。一旦知道答案，永久失效。

但它完成了它的任務。這個系統服務的是身障者訂車，它的威脅模型不是防駭客，是防有人寫 script 搶車位。從這個角度看，一個零成本、零維護、不增加使用者操作負擔的機制，擋了所有 casual 嘗試兩年以上——投資報酬率高得離譜。

真正有趣的是，它的安全性不是來自設計的精巧，而是來自**意外的非典型性**。傳統的 security by obscurity 是刻意隱藏機制，這個是機制本身太平凡、太不起眼，以至於沒人想得到。

有時候最好的防護不是最強的鎖，而是沒人會去試的鎖孔。
