# 讓 Claude 手畫部落格封面：重測晚了兩個月，封面欄位從 2 月就漏了

今天我在 Claude.ai 網頁端測 Opus 5 手寫 SVG，題目用 9/17 那篇〈[是店家也沒關係，直接說就好](https://b-log.to/business-insights/reseller-just-say-it/)〉。

第一張花了 9 分鐘。檔案 24 KB，362 個元素。iPhone 三鏡頭的金屬環、玻璃反光、相機平台的階差都畫出來了，旁邊還有兩個買家頭像和一個聊天視窗。

品質比我預期高。

慢是因為輸出量大。SVG 要模型一個字一個字寫出來，24 KB 就是逐字寫完 24 KB。

第二張我改成完全沒有字，尺寸 1600×900。這張快很多，手機、鏡頭、漸層、濾鏡的定義都沿用第一張，只重寫版面。我的封面本來就都是無字的。

## 2 月為什麼沒讓它收 SVG

這個 connector 是 2/25 建的，當時的事寫在〈[幫靜態部落格接上 MCP，然後我可以躺在床上用手機發文了](https://b-log.to/tech-development/static-blog-mcp-connector/)〉。

那時候我沒讓它收 SVG。原因很單純，那時候模型畫出來的 SVG 都很醜。

今天我回頭查了官方公告。2/5 的 Opus 4.6 公告，完全沒提視覺輸出。7/24 的 Opus 5 公告，才第一次寫到「much stronger visual outputs」。

所以 2 月不做，這個判斷沒錯。

該重測的時間點是 7 月底，官方第一次把視覺輸出寫進公告的時候。我實際重測是今天，晚了大概兩個月。

## 早該補的是那個欄位

模型的部分，等是合理的。

但 create_post 和 edit_post 從 2/25 開始就沒有 coverImage 欄位。只要我離開 Mac，就沒辦法幫文章設封面。

這件事跟模型能力無關。這個欄位 2 月就能加。

那為什麼不讓它收點陣圖，用 base64 塞進去？

MCP 工具的參數也是模型逐字生成的。一張 70 KB 的 WebP 轉成 base64，大約九萬個字元，比畫一張圖還慢，中間錯一個字元整張就壞了。SVG 是文字，模型寫起來最自然。網頁端的 Opus 自己也給了一樣的結論。

能接 MCP 的，只有 Claude 的網頁端和手機 App，其他家都不行。所以這條流程做完，我躺在床上用手機發文，也能附封面。

## 這篇就是第一次實測

新工具叫 upload_cover_svg，直接收 SVG 原始碼。create_post 和 publish_draft 改成 coverSvg 必填，之後的新文章一律要有封面。

封面規則寫在工具裡：16:9，建議 viewBox 用 0 0 1600 900，完全不能有文字，不能用 `<text>`，也不能用 path 畫字。所有東西都要 inline，不能引用外部資源，300 KB 以內。

accentColor 我沒拿掉。它是首頁卡片左側那條 3px 色條，也是分類標籤的顏色，我喜歡那個呈現。這次改成必填，顏色要配合文章主題。

200 篇文章裡，有 119 篇沒有封面，靠 accentColor 的漸層撐畫面。前端的 fallback 留給它們。

實作是 Codex 上的 Luna（gpt-5.6-luna xhigh）做的，一次就過。tsc 過了。負測試一個塞了 35 個 `<text>`，另外 `<image>`、`<script>`、1200×630 各一個。create_post 缺欄位的測試有三個。sharp 轉出來是 1600×900，然後部署。connector 的 commit 是 5fad0ba，b-log 的是 cc84d17。中間它抓到自己一個正規表示式的括號寫錯。

這篇文章是用這條新流程發的第一篇。

封面也是 Opus 5 在這個對話裡手寫的，26.6 KB、348 個元素：一支手機，螢幕上的向量編輯器裡有一張圖正在被畫出來，旁邊一條路從手機接到伺服器，再接到部落格。深藍底，橘色是主角，這篇的 accentColor 也跟著用同一個橘色。

實測在發文之前就卡了一下。我開這個對話的時候，connector 伺服器已經是新版。Claude 直接對伺服器打 tools/list，回來是 13 個工具。但對話裡載入的工具清單還是舊的 12 個，create_post 沒有 coverSvg，也找不到 upload_cover_svg。我把 connector 重新連線之後，同一個對話裡才看得到新工具。

寫到這裡，這篇還沒發出去。接下來先用 upload_cover_svg 的 dryRun 驗封面。dryRun 不會去查文章存不存在，所以文章還沒建立也能先驗。驗過了再呼叫 create_post，一次帶文章、封面和 accentColor。

發出去之後，GitHub Actions 會把 .svg 轉成 .webp，再改掉 coverImage。那一步我要自己去 b-log.to 看。
