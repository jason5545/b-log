# Cloudflare Pages 部署指南

本指南說明如何將 b-log 部署到 Cloudflare Pages，並可選擇啟用瀏覽次數功能。

## 基本部署

### 1. 連接 GitHub Repository

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 進入 **Workers & Pages** → **Create application** → **Pages**
3. 選擇 **Connect to Git**
4. 授權並選擇你的 b-log repository

### 2. 設定建置

| 項目 | 值 |
|------|-----|
| Production branch | `main` |
| Build command | （留空，純靜態不需建置） |
| Build output directory | `/` |

### 3. 部署

點選 **Save and Deploy**，完成。

網站會自動取得 `*.pages.dev` 網域，也可以綁定自訂網域。

---

## 可選：瀏覽次數功能

使用 Pages Functions + KV 實作即時瀏覽統計。

### 1. 建立 KV Namespace

```bash
# 安裝 wrangler（如果還沒有）
npm install -g wrangler

# 登入
wrangler login

# 建立 KV namespace
wrangler kv:namespace create "PAGE_VIEWS"
```

記下輸出的 `id`，例如：`abc123def456...`

### 2. 建立 wrangler.toml

在專案根目錄建立 `wrangler.toml`：

```toml
name = "b-log"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "PAGE_VIEWS"
id = "你的_KV_NAMESPACE_ID"
```

### 3. 建立 Pages Function

建立 `functions/api/view.js`：

```javascript
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  // 驗證 slug
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response(JSON.stringify({ error: 'Invalid slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 取得目前計數
  let count = parseInt(await env.PAGE_VIEWS.get(slug)) || 0;

  // 如果是 POST，增加計數
  if (request.method === 'POST') {
    count++;
    await env.PAGE_VIEWS.put(slug, count.toString());
  }

  return new Response(JSON.stringify({ slug, count }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
```

### 4. 前端整合

在 `assets/main.js` 的文章頁面載入邏輯中加入：

```javascript
// 瀏覽次數（可選功能）
async function trackPageView(slug) {
  const API_BASE = 'https://你的網域.pages.dev';

  try {
    // 記錄瀏覽
    const res = await fetch(`${API_BASE}/api/view?slug=${slug}`, {
      method: 'POST'
    });
    const data = await res.json();

    // 顯示計數
    const el = document.getElementById('view-count');
    if (el && data.count) {
      el.textContent = data.count.toLocaleString();
    }
  } catch (e) {
    // 失敗不影響主體功能
    console.debug('Page view tracking unavailable');
  }
}
```

在 `post.html` 加入顯示位置：

```html
<span class="view-count">
  <span id="view-count">-</span> 次瀏覽
</span>
```

### 5. 部署

推送到 GitHub，Cloudflare Pages 會自動部署 Functions。

---

## 目錄結構

啟用 Functions 後的結構：

```
b-log/
├── functions/
│   └── api/
│       └── view.js      ← Pages Function
├── wrangler.toml        ← KV 綁定設定
├── content/
├── assets/
├── data/
└── ...（其他現有檔案）
```

---

## 與 GitHub Pages 的差異

| 項目 | GitHub Pages | Cloudflare Pages |
|------|--------------|------------------|
| 建置 | GitHub Actions | CF 自動 |
| 重定向 | 生成 `index.html` | 同樣支援，或用 `_redirects` |
| 動態功能 | 需另部署 Worker | Functions 內建整合 |
| CDN | GitHub 的 | Cloudflare 全球 CDN |
| 自訂網域 | 支援 | 支援 |

---

## 注意事項

1. **KV 免費額度**：每天 100,000 次讀取、1,000 次寫入，一般部落格綽綽有餘
2. **Functions 免費額度**：每天 100,000 次請求
3. **wrangler.toml 不要提交機密**：KV ID 本身不是機密，可以提交
4. **本地測試**：使用 `wrangler pages dev .` 測試 Functions

---

## 相關資源

- [Cloudflare Pages 文件](https://developers.cloudflare.com/pages/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [KV 文件](https://developers.cloudflare.com/kv/)
