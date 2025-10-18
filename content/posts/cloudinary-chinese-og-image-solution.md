# 解決 Facebook 分享預覽的中文顯示問題：Cloudinary 整合實戰

當你滿心期待地在 Facebook 分享你的中文部落格文章，卻發現預覽圖只顯示「loading」或一堆亂碼方塊時，那種挫折感我完全理解。今天花了幾個小時，終於徹底解決了這個問題。

## 問題的根源

最初使用 `og-image.vercel.app` 來動態生成 Open Graph 圖片。對於英文內容來說，這個服務完美無瑕。但對於中文？完全不行。

**問題有兩個層次：**

1. **Facebook 不執行 JavaScript**
   我的 `post.html` 中的 OG meta tags 是由 JavaScript 動態填入的。Twitter/X 可以正常抓取，但 Facebook 的爬蟲只看到空白的 `<meta property="og:title" content="Loading">`。

2. **og-image.vercel.app 不支援中文字型**
   即使預先填入 meta tags，使用 `og-image.vercel.app` 生成的圖片也會將中文顯示為亂碼或方塊，因為預設字型不包含 CJK 字元集。

## 解決方案：Cloudinary + Noto Sans TC

### 為什麼選擇 Cloudinary？

考慮過幾個方案：
- **靜態預設圖片**：太單調，失去個性化
- **手動設計封面**：每篇文章都要設計，不切實際
- **自架 Vercel Edge Function**：需要額外專案，維護成本高
- **Cloudinary**：免費額度足夠，內建文字覆蓋 API，支援自訂字型 ✅

### 實作步驟

#### 1. 註冊 Cloudinary 並上傳背景圖片

首先註冊免費帳號，記下你的 Cloud Name（我的是 `dynj7181i`）。

然後建立一張 1200×630px 的背景圖片。我選擇使用 SVG 製作漸層背景：

```svg
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#556bff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3644d8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#grad)" />
  <text x="1140" y="600" font-family="Arial" font-size="24"
        fill="#ffffff" opacity="0.8" text-anchor="end">(b)-log</text>
</svg>
```

上傳後得到 Public ID：`og-background_cbst7j`

#### 2. 上傳 Noto Sans TC 字型

這是關鍵步驟。Cloudinary 的內建字型（如 WenQuanYi Zen Hei）雖然支援中文，但視覺效果不夠現代。我想用 Noto Sans TC。

**重要：字型必須作為 authenticated raw file 上傳，且 Public ID 不能包含底線。**

步驟：
1. 前往 Cloudinary Settings → Upload Presets
2. 建立新 preset：
   - Signing Mode：Signed
   - Delivery type：Authenticated
3. 使用此 preset 上傳 `NotoSansTC-Bold.ttf`
4. 設定 Public ID 為 `notosanstc-bold.ttf`（全小寫，無底線）

#### 3. 測試文字覆蓋 API

Cloudinary 的文字覆蓋語法是這樣的：

```
https://res.cloudinary.com/{cloud_name}/image/upload/
  c_fill,w_1200,h_630/
  co_rgb:ffffff,
  l_text:{font_id}_{size}_{alignment}:{encoded_text},w_{max_width},c_fit/
  fl_layer_apply,g_center/
  {background_id}.png
```

關鍵參數：
- `co_rgb:ffffff`：文字顏色（白色）
- `l_text:notosanstc-bold.ttf_60_center:...`：使用自訂字型，60px，置中對齊
- `w_1000,c_fit`：限制文字寬度 1000px，自動縮放和換行
- `fl_layer_apply,g_center`：套用文字圖層並置中

測試時發現：
- **60px 字型 + 1000px 寬度**：完美，無白邊
- **60px 字型 + 1100px 寬度**：長標題會超出邊界
- **50px 字型**：文字太小，視覺效果不佳

#### 4. 修改 generate-redirects.js

在生成 WordPress 風格頁面時，預先填入 Cloudinary URL：

```javascript
// 生成 Open Graph 圖片 URL
let ogImageUrl;
if (coverImage) {
  ogImageUrl = `${baseUrl}/${coverImage}`;
} else {
  const cloudName = 'dynj7181i';
  const backgroundId = 'og-background_cbst7j';
  const fontId = 'notosanstc-bold.ttf';
  const encodedTitle = encodeURIComponent(title);

  ogImageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `c_fill,w_1200,h_630/` +
    `co_rgb:ffffff,` +
    `l_text:${fontId}_60_center:${encodedTitle},w_1000,c_fit/` +
    `fl_layer_apply,g_center/` +
    `${backgroundId}.png`;
}
```

這樣每篇文章都會自動生成包含正確 OG 圖片 URL 的頁面。

## 遇到的坑

### 坑 1：字型檔案上傳失敗（Error 400）

一開始直接在 Media Library 上傳字型，Cloudinary 自動加上底線後綴（如 `NotoSansTC-Bold_i1elwz.ttf`），導致文字覆蓋 API 無法識別。

**解決方法**：必須使用 authenticated upload preset，並手動設定不含底線的 Public ID。

### 坑 2：長標題超出圖片邊界

測試「OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲」這樣的長標題時，發現文字超出 1200px 寬度，導致左右出現白邊。

**解決方法**：加入 `w_1000,c_fit` 參數，限制文字區域寬度並自動縮放。

### 坑 3：Facebook 快取問題

即使 OG 圖片 URL 正確，Facebook 可能還是顯示舊的預覽。

**解決方法**：使用 [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) 強制重新抓取：
1. 輸入文章 URL
2. 點選「Scrape Again」
3. 確認預覽正確

## 最終效果

現在所有文章的 Facebook 分享預覽都能正確顯示：
- ✅ 標題使用 Noto Sans TC Bold 字型
- ✅ 白色文字於藍色漸層背景
- ✅ 自動換行，無白邊
- ✅ 右下角有 (b)-log 浮水印

最重要的是：**完全自動化**。未來新增文章時，GitHub Actions 會自動生成包含正確 OG 圖片的頁面，無需手動操作。

## 技術細節總結

**Cloudinary 設定：**
- Cloud Name: `dynj7181i`
- 背景圖片: `og-background_cbst7j` (1200×630px SVG 漸層)
- 字型: `notosanstc-bold.ttf` (authenticated raw file)

**最佳配置：**
- 字型大小: 60px
- 文字寬度限制: 1000px
- 對齊方式: center
- 自動縮放: c_fit

**成本：**
- Cloudinary 免費額度：每月 25 credits
- 每次圖片生成約消耗 0.0001 credits
- 可支援約 250,000 次預覽請求/月（遠超實際需求）

## 學到的教訓

1. **不要假設第三方服務支援所有語言**
   英文能用不代表中文也能用。測試時要用實際內容，不要只用「test」。

2. **了解平台限制很重要**
   Facebook 不執行 JavaScript，這個基本認知能省下很多除錯時間。

3. **自動化是值得投資的**
   花幾小時設定好自動化流程，未來能省下無數次重複操作。

4. **免費服務也能很強大**
   Cloudinary 的免費額度對個人部落格來說綽綽有餘，不一定要自己架設服務。

## 下一步

目前所有文章都使用統一的漸層背景。未來可以考慮：
- 為重要文章設計專屬 `coverImage`
- 根據文章分類使用不同背景顏色
- 加入更多視覺元素（圖示、裝飾線條等）

但現在這樣已經很好了。**能用、好看、自動化**，這就是我要的。

---

**相關資源：**
- [Cloudinary 文字覆蓋文件](https://cloudinary.com/documentation/layers)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Open Graph Protocol](https://ogp.me/)
