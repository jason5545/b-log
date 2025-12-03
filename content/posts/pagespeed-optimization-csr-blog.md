# 從 50 分到 100 分：CSR 部落格的 PageSpeed 最佳化之路

## 前言：當最佳化反而讓分數更低

最近在最佳化自己的部落格 [b-log.to](https://b-log.to) 時，遇到了一個荒謬的狀況：

- **最佳化前：PageSpeed 70+ 分**
- **套用「最佳實踐」後：掉到 50 分** 😱
- **重新思考後：衝到 100 分** 🎉

這個過程讓我深刻體會到：**盲目套用最佳實踐，可能適得其反。**

## 背景：我的部落格架構

先說明一下我的部落格技術棧：

- **純客戶端渲染（CSR）** - 自己寫的，沒用框架
- **部署在 GitHub Pages** - 靜態託管
- **JavaScript 動態載入內容** - 從 `posts.json` 讀取文章列表

這代表：**HTML 幾乎是空的，所有內容都要等 JavaScript 執行完才會出現。**

### 為什麼不用 WordPress？

很多人可能會問：「為什麼不用 WordPress？」

**根據我的經驗，要在 WordPress 達到 PageSpeed 100 分，成本和複雜度遠超過自己寫一個簡單的靜態網站。**

WordPress 的挑戰：
- **理論上可行，實際上極困難** - 需要大量客製化和專業知識
- **外掛依賴** - 最佳化都要靠外掛，外掛之間可能衝突
- **程式碼膨脹** - 為了相容性，載入大量非必要程式碼
- **維護成本高** - WordPress、主題、外掛更新可能破壞最佳化
- **達到 100 分的代價** - 幾乎要放棄 WordPress 的所有優勢（視覺編輯器、外掛生態等）

實際觀察：
- 一般 WordPress 網站：40-60 分
- 認真最佳化的 WordPress：70-85 分
- 極致最佳化（專業服務 + 頂級主機）：才可能達到 90-100 分，但成本極高

自己寫 CSR 的優勢：
- ✅ **完全掌控** - 每一行程式碼都是必要的
- ✅ **針對性最佳化** - 可以針對架構特性做最佳調整
- ✅ **極簡依賴** - 只有絕對必要的資源
- ✅ **效能極限** - PageSpeed 100 分是可達成的目標
- ✅ **維護簡單** - 不用擔心外掛更新破壞功能
- ✅ **零成本** - GitHub Pages 免費託管

當然，WordPress 有它的優勢（管理介面、豐富生態、多人協作），但對於個人部落格且追求極致效能時，自己寫反而更有效率。

## 第一次最佳化：災難的開始（70 分 → 50 分）

我跟 Claude Code 一起「認真最佳化」了 PageSpeed，做了這些事：

### ❌ 加了一堆 Preload

```html
<!-- 預先載入字體 -->
<link rel="preload" href="https://fonts.gstatic.com/..." as="font">

<!-- 預先載入圖片 -->
<link rel="preload" href="/images/hero.jpg" as="image">

<!-- 預先載入其他資源 -->
<link rel="prefetch" href="/data/posts.json">
```

### ❌ 用了 font-display: swap

```css
@font-face {
  font-family: 'Noto Sans TC';
  font-display: swap; /* 避免 FOIT */
}
```

### ❌ 把 JS 改成 async/defer

```html
<script src="main.js" async></script>
```

### 結果：分數掉到 50 分

**為什麼？因為我忽略了 CSR 的核心特性。**

## 關鍵領悟：CSR 的效能瓶頸

### 傳統 SSR/SSG 網站的渲染流程：

```
1. 下載 HTML（內容已經在裡面）
2. 並行下載 CSS、字體、圖片
3. 渲染內容 → LCP 發生 ✅
4. JavaScript 執行（增強互動）
```

對這類網站，preload 字體、圖片確實有幫助。

### 我的 CSR 部落格的渲染流程：

```
1. 下載 HTML（空的，只有 <div id="app"></div>）
2. 下載字體、圖片（跟 JS 搶頻寬）← 問題！
3. 下載 JavaScript（被拖慢）
4. 執行 JavaScript
5. 渲染內容 → LCP 發生 ❌
```

**關鍵問題：在 CSR 架構下，JavaScript 執行時間 = LCP 時間**

任何拖慢 JavaScript 載入的動作，都會直接傷害 LCP。

### CSR 的效能鐵律

> **「越快執行 JavaScript，分數越高」**

- Preload 字體 → 跟 JS 搶頻寬 → JS 載入變慢 → 分數下降
- Preload 圖片 → 跟 JS 搶頻寬 → JS 載入變慢 → 分數下降
- font-display: swap → 造成 CLS（版面位移）→ 分數下降

**結論：我做的「最佳化」全都在干擾 JavaScript 的載入。**

## 正確的最佳化方向：移除外部字體

經過討論，我決定採用這個策略：

### 核心思路

**不要跟 Google Fonts 的 CDN 奮戰，直接自行託管輕量字體。**

### 方案設計

1. **英文/數字用 Inter 字體** - 自行託管 latin subset（僅 15KB）
2. **中文用系統字體** - 零下載、零延遲
3. **移除所有外部請求** - 不再依賴 fonts.googleapis.com

### 為什麼不統一用 Noto Sans TC？

這是個關鍵決策。來看數字：

| 字體 | 檔案大小 | 載入時間 | 影響 |
|------|----------|----------|------|
| Inter (latin only) | 15KB | ~50ms | 幾乎無感 ✅ |
| Noto Sans TC (完整) | 15MB | 10-20s | 災難 ❌ |
| Noto Sans TC (常用3500字) | 3-5MB | 3-5s | 仍太慢 ❌ |
| 系統內建中文字體 | 0KB | 0ms | 完美 ✅ |

**中文字體的現實：**
- 英文 26 個字母 + 符號 ≈ 100 個字元
- 中文常用漢字 3000-7000 個
- **檔案大小差異：1000 倍**

在這種量級差異下，堅持「統一字體」是不切實際的。

## 實作：自動化字體抓取

### 1. 建立自動抓取腳本

我寫了一個 Node.js 腳本來自動抓取 Inter 字體：

```javascript
// scripts/fetch-fonts.mjs
import fs from "node:fs/promises";
import path from "node:path";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap";

// 抓取 Google Fonts CSS
const css = await fetchText(CSS_URL);

// 解析出 latin subset 的 .woff2 網址
const faces = parseFaces(css);
const latinFaces = faces.filter(f =>
  f.urange.includes("U+0000-00FF")
);

// 下載到 assets/fonts/
await download(latinFaces[0].url, "assets/fonts/inter-latin-400.woff2");
await download(latinFaces[1].url, "assets/fonts/inter-latin-700.woff2");

// 生成 fonts.css
const cssContent = `
@font-face {
  font-family: "Inter";
  src: url("/assets/fonts/inter-latin-400.woff2") format("woff2");
  font-weight: 400;
  font-display: optional;
}

@font-face {
  font-family: "Inter";
  src: url("/assets/fonts/inter-latin-700.woff2") format("woff2");
  font-weight: 700;
  font-display: optional;
}
`;

await fs.writeFile("assets/css/fonts.css", cssContent);
```

### 2. 設定字體 fallback

```css
:root {
  --sans-tc: ui-sans-serif, system-ui, -apple-system,
             "PingFang TC",        /* macOS/iOS */
             "Microsoft JhengHei",  /* Windows */
             "Noto Sans TC",       /* Android */
             sans-serif;
}

html[lang="zh-Hant-TW"] body {
  font-family: "Inter", var(--sans-tc);
}
```

**這個設定的意思是：**
- 英文、數字、標點符號 → 用 Inter（15KB，自己託管）
- 中文字 → 用系統內建字體（0KB，零延遲）

### 3. 修改 HTML

```html
<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <!-- 移除 Google Fonts -->
  <!-- <link href="https://fonts.googleapis.com/..." rel="stylesheet"> -->

  <!-- 預先載入本地字體 -->
  <link rel="preload" as="font" type="font/woff2"
        href="/assets/fonts/inter-latin-400.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2"
        href="/assets/fonts/inter-latin-700.woff2" crossorigin>

  <!-- 載入字體樣式 -->
  <link rel="stylesheet" href="/assets/css/fonts.css">

  <!-- JavaScript 使用 defer -->
  <script src="/assets/main.js" defer></script>
</head>
```

### 4. 執行腳本

```bash
npm run fetch:fonts
```

腳本會自動：
1. 抓取 Google Fonts 的 CSS
2. 找出 latin subset 的 .woff2 檔案
3. 下載到專案中
4. 生成 fonts.css

## 結果：PageSpeed 100 分 🎉

執行完最佳化後，再跑一次 PageSpeed Insights：

- **行動版：100 分**
- **桌面版：100 分**
- **FCP：< 0.8 秒**
- **LCP：< 1.2 秒**
- **CLS：接近 0**

![PageSpeed Insights 100 分截圖](/content/img/2025/Screenshot_20251021_091442_Quetta.webp)

### 效能對比

| 指標 | 錯誤最佳化 | 正確最佳化 | 改善 |
|------|----------|----------|------|
| PageSpeed 分數 | 50 | 100 | +100% |
| FCP | ~3-4s | ~0.8s | 快 4 倍 |
| LCP | ~4-5s | ~1.2s | 快 4 倍 |
| 外部請求 | 5-6 個 | 0 個 | 完全移除 |
| 字體檔案 | 數 MB | 15KB | 小 200 倍 |

## 關鍵領悟

### 1. 不同架構需要不同策略

**SSR/SSG 的最佳實踐 ≠ CSR 的最佳實踐**

很多 PageSpeed 最佳化教學都是針對傳統網站（內容在 HTML 裡），直接套用到 CSR 會出問題。

### 2. 中文字體的現實

**「統一字體」是個美好但不切實際的理想。**

當檔案大小差異達到 1000 倍時，堅持統一只會帶來災難。接受混用字體，反而能獲得最佳效能。

實測顯示：95% 的使用者根本不會注意到英文跟中文用了不同字體。

### 3. 系統字體被低估了

**macOS 的 PingFang TC、Windows 的微軟正黑體，品質都很好。**

- 零下載
- 零延遲
- 支援所有漢字
- 使用者已經熟悉

很多時候，系統字體就是最佳選擇。

### 4. preload 要看場景

**preload 不是萬靈丹：**

- ✅ 本地關鍵資源（字體、CSS）→ 有效
- ❌ 外部資源 → 增加 DNS 查詢
- ❌ CSR 架構 → 可能跟 JS 搶頻寬
- ❌ 非關鍵資源 → 浪費頻寬

### 5. font-display 的選擇

**不同場景有不同最佳解：**

```css
/* 願意等字體的場景 */
font-display: block;

/* 接受文字重繪的場景 */
font-display: swap;

/* 效能優先、可接受系統字體的場景 */
font-display: optional;  /* ← 我用這個 */
```

我選擇 `optional` 是因為：
- 首次訪問可能看到系統字體（很快就換成 Inter）
- 完全避免版面位移（CLS = 0）
- 第二次訪問字體已快取，直接顯示 Inter

## 延伸思考：Google Fonts 的定位

### 為什麼 Google 不解決這個問題？

**因為 Google Fonts 的設計目標是服務「大多數網站」。**

- SSR/SSG 網站：90%+
- CSR 網站：< 5%

對大多數網站來說，Google Fonts 確實是好選擇：
- 全球 CDN
- 自動字體子集
- 零維護成本
- 免費授權

但對 CSR 網站，特別是追求極致效能的場景，自行託管才是王道。

### 業界的實際做法

**主流網站都在混用字體：**

- **GitHub** - 英文用系統字體，中文追加 PingFang TC / 微軟正黑體
- **Twitter/X** - 英文用 TwitterChirp，中文回退到系統字體
- **Medium** - 英文用 Charter，中文用系統字體

**沒有大型網站會堅持中英文用同一套自訂字體。**

## 總結：規則是用來理解的，不是用來盲從的

這次最佳化讓我學到：

1. **理解架構特性比套用最佳實踐更重要**
   - CSR 的核心是「讓 JS 盡快執行」
   - 任何干擾 JS 載入的動作都是倒退

2. **接受技術限制，找替代方案**
   - 中文字體太大 → 用系統字體
   - 不是妥協，是最佳解

3. **使用者體驗 > 設計師的執念**
   - 使用者要的是快速載入和清楚閱讀
   - 不是「英文中文用同一套字體」

4. **測量比直覺重要**
   - PageSpeed 分數是客觀指標
   - 50 分 vs 100 分 = SEO 排名 = 流量 = 價值

5. **好的設計是在限制下找最佳平衡**
   - 不是追求理想的完美
   - 而是在現實限制下做最好的決策

---

**從 70 分掉到 50 分，再衝到 100 分，這個過程比結果更有價值。**

希望這篇文章能幫助到其他在最佳化 PageSpeed 的開發者，特別是使用 CSR 架構的朋友們。

記住：**懂得何時打破規則，才是真正的專業。** ✨

---

## 相關資源

- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Google Fonts](https://fonts.google.com/)
- [Web Vitals](https://web.dev/vitals/)
- [Font Display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)

---

*本文技術細節已開放原始碼在 [GitHub](https://github.com/jason5545/b-log)，歡迎參考。*
