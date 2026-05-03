# 本機模型接 Claude Office：偽裝成 gateway 的三段門檻

我原本以為這件事應該很單純。

Claude for Excel / PowerPoint / Word 不是有 Enterprise Gateway 嗎？oMLX 不是有 Anthropic-compatible API 嗎？那理論上就是把 URL 填進去、API key 填進去，結束。

實際做下去才發現，這種「compatible」通常只保證最基本的對話格式像，並不保證一個真實產品送出來的完整 payload 也能吃。

我真正花時間的，是把它偽裝成 Office add-in 願意相信的 Claude gateway。

最終跑起來的架構是：

```
Claude Office add-in
  -> Tailscale HTTPS endpoint (tailnet only)
  -> local middleware (8010)
      - CORS / preflight compatibility
      - strip unsupported built-in tools
      - public model alias: claude-sonnet-4-5-20250929
      - upstream model rewrite: Qwen3.6-35B-A3B-MLX-8bit
  -> oMLX (8000)
      - 只載入 Qwen3.6-35B-A3B-MLX-8bit
```

中間解了三個問題。第一個是 HTTPS，第二個是 model name，第三個——也是最卡的那個——是 built-in tools。

---

## 第一個門檻：Office add-in 不是 terminal client

Office add-in 跑在 Office 的 WebView 裡，不是在自己 terminal 打 curl。它對 endpoint 有幾個現實限制：

- Enterprise Gateway URL 需要 HTTPS，至少要是 WebView 願意呼叫的安全來源
- 要能被 Office 的 WebView 存取
- CORS 要通
- `/v1/models` 要回它能接受的 model name
- `/v1/messages` 要能吃它實際送出的 payload，而不是自己測出來的那種最小 payload

所以單純填 `http://127.0.0.1:8000` 是不夠的。

我用 Tailscale Serve 幫本機 oMLX 套一層 tailnet 內可用的 HTTPS：

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 8010
```

設定成 tailnet only，不開 Funnel。endpoint 只在自己的 network 裡面能連，不會公開到 Internet。

這一步解決的是 WebView 可達性問題。但它還沒有解掉 model name 的檢查。

---

## 第二個門檻：Office add-in 會挑 model name

oMLX 的 `/v1/models` 原本回的是：

```
Qwen3.6-27B-mtp
Qwen3.6-35B-A3B-MLX-8bit
```

但 Office add-in 直接回：

```
Unsupported model — use Claude Opus or Sonnet 4.5 or later
```

它不是只看 endpoint 有沒有回模型，而是會檢查 model id 像不像 Claude 官方支援的版本。

### 中途嘗試：hard link alias（後來放棄了）

一開始的直覺是建立一個 alias folder。原本的模型還要保留，因為 Pi agent 和其他本機 agent 用的是 `Qwen3.6-35B-A3B-MLX-8bit`，不能動。

所以我在 `~/.lmstudio/models/` 下面建了一個同名但用 hard link 的資料夾：

```
~/.lmstudio/models/Qwen3.6-35B-A3B-MLX-8bit
~/.lmstudio/models/claude-sonnet-4-5-20250929
```

大型模型檔案是 hard link，共享同一份 inode，不會再多吃一份 36GB。reload 後 Office add-in 的 model name 檢查確實過了。

**但後來我發現這是一個陷阱。**

hard link 只能省磁碟空間，不等於省 runtime memory。如果 Office add-in 用 `claude-sonnet-4-5-20250929`，Pi agent 用 `Qwen3.6-35B-A3B-MLX-8bit`，oMLX 可能把它們當成兩個不同的 model id，各自載入一次。雖然底層檔案相同，但 runtime 仍然是两份記憶體。

35B 模型已經夠吃記憶體了，雙載風險不值得冒。所以我後來把 `claude-sonnet-4-5-20250929` 的 alias folder 刪掉了，不再在 oMLX 裡保留兩個 model id。

### 最新做法：middleware 做 model rewrite

Office add-in 需要看到 `claude-sonnet-4-5-20250929` 才肯過 model name 檢查，但 oMLX 只需要收到 `Qwen3.6-35B-A3B-MLX-8bit` 就行了。

所以 model alias 的任務從 oMLX 內部搬到了 middleware。middleware 現在做三件事：

1. **public model alias**：對 Office add-in 的 `/v1/models` 回應中，仍然包含 `claude-sonnet-4-5-20250929`，讓 Office add-in 通過檢查。
2. **upstream model rewrite**：`/v1/messages` 請求進來時，如果 model 欄位是 `claude-sonnet-4-5-20250929`，在轉給 oMLX 前改成 `Qwen3.6-35B-A3B-MLX-8bit`。
3. **downstream response rewrite**：oMLX 回傳結果裡的 model 欄位是 `Qwen3.6-35B-A3B-MLX-8bit`，middleware 再改回 `claude-sonnet-4-5-20250929` 回給 Office add-in。

這樣 Office add-in 看到的是 Claude-compatible model id，但 oMLX runtime 實際只會載入 Qwen 原模型。Pi agent 也不需要改 default model，繼續用 `Qwen3.6-35B-A3B-MLX-8bit` 就好。兩邊最後都落到同一個 model id，不會重複載入 35B。

---

## 第三個門檻：payload 不是你 curl 的那種最小 payload

當我在 Office add-in 裡送了一個簡單的 `hi`，畫面出現：

```
Something went wrong with your request.
```

看 oMLX server log，真正的錯誤是：

```
POST /v1/messages → 422:
  [
    {
      'type': 'missing',
      'loc': ('body', 'tools', 4, 'input_schema'),
      'msg': 'Field required',
      'input': {'type': 'web_search_20250305', 'name': 'web_search'}
    },
    {
      'type': 'missing',
      'loc': ('body', 'tools', 5, 'input_schema'),
      'msg': 'Field required',
      'input': {'type': 'code_execution_20250825', 'name': 'code_execution'}
    }
  ]
```

這個錯誤很關鍵。

我只是送 `hi`，但 Office add-in 自己在 request 裡塞了兩個工具：`web_search_20250305` 和 `code_execution_20250825`。在 Anthropic 官方 API 裡，這類 built-in tools 的 schema 和一般 custom tool 不同，不一定會帶 `input_schema`。但 oMLX 0.3.8 的 request validation 沒有接受這種 tool item，直接回 422。

Office add-in 送的是 Claude API 裡 built-in tools 風格的 payload。oMLX 的相容層在這個 case 沒有接受。兩邊都不是連線錯誤，但 schema 細節沒有對齊，接起來就炸掉。

這就是 `Something went wrong` 背後真正的原因。

---

## 解法：在 oMLX 前面加一層 compat gateway

Tailscale Serve 只能做 reverse proxy，不能改 request body。所以我在 oMLX 前面加了一個很薄的 Python middleware。

新的架構變成：

```
Claude Office add-in
  -> Tailscale HTTPS
  -> local middleware (8010)
      - CORS / preflight compatibility
      - strip unsupported built-in tools
      - model alias & rewrite
  -> oMLX (8000)
```

這個 middleware 現在做三件事：

**第一，處理 CORS。**

Office add-in 的 WebView 會發 preflight（OPTIONS）請求。middleware 原本手列了允许的 headers，但太窄了。Office add-in 在某些情況下可能會帶更多 header，如果 `Access-Control-Allow-Headers` 沒包含 preflight 要求的 header，WebView 就會擋掉真正的 POST。

後來的做法是動態 echo：OPTIONS 時讀取 `Access-Control-Request-Headers`，直接回傳回去。加上 `Access-Control-Allow-Private-Network: true`，處理瀏覽器 Private Network Access preflight。

這解了一個很微妙的情況：我後來 unload model 的時候，gateway 收到連續四個 OPTIONS 204，但沒有後續的 POST。看起來像無法連線，實際上是 preflight 沒過。

**第二，移除 oMLX 不支援的 built-in tools。**

遇到缺少 `input_schema` 的 tool items，先 strip 掉再轉給 oMLX。不是全部關掉 tool calling，而是移除 oMLX 目前會拒絕的那類。

我沒有選擇塞假的 `input_schema` 給 built-in tools。那樣雖然可能通過驗證，但模型可能真的產生 tool_use，Office add-in 又會以為後端支援 web search 和 code execution。那只是把錯誤往後延。

直接 strip 比較誠實。這套本機接法沒有提供 Claude 官方那些工具的對應實作，那就不要讓它們進去。

**第三，model alias 與 rewrite。**

以前的做法是在 oMLX 內部建 hard link alias。後來放棄了，因為 hard link 只能省磁碟，不等於省 runtime memory——oMLX 可能把兩個 model id 當成不同的模型各自載入。

所以現在 model alias 的任務移到 middleware。Office add-in 看到的 `/v1/models` 回應中包含 `claude-sonnet-4-5-20250929`，但 request 轉給 oMLX 之前，middleware 把 model 欄位改成 `Qwen3.6-35B-A3B-MLX-8bit`。oMLX 回傳的結果裡再改回去。

Log 裡會看到：

```
POST /v1/messages -> 200 stripped_tools=2
```

request 成功送到 oMLX，回 200。

---

## 讓它常駐

用 macOS LaunchAgent 讓 gateway 一直跑：

```
~/Library/LaunchAgents/com.jason.omlx-office-gateway.plist
```

關掉和啟動的指令：

```bash
# 停止
launchctl bootout gui/$(id -u)/com.jason.omlx-office-gateway

# 啟動
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jason.omlx-office-gateway.plist

# 看 log
tail -f ~/.omlx/logs/office_gateway.err.log
```

---

## 目前 Office add-in 的設定

```
Gateway URL: https://macbook-pro.tailb20be.ts.net
Model: claude-sonnet-4-5-20250929（由 middleware 提供 public alias）
API token: oMLX API key
```

後端狀態：

```
oMLX: 127.0.0.1:8000
  只載入 Qwen3.6-35B-A3B-MLX-8bit
middleware: 127.0.0.1:8010
  - public alias: claude-sonnet-4-5-20250929
  - upstream rewrite: Qwen3.6-35B-A3B-MLX-8bit
  - POST /v1/messages -> 200, stripped_tools=2
```

基本聊天和文件處理可以跑。但這個解法有明確的限制：

- Claude web search 不會真的可用
- Claude code execution 不會真的可用
- 如果 Office add-in 某個功能強依賴 built-in tools，還是可能遇到相容性問題

oMLX 原生有 Claude / Anthropic-compatible API，但不代表 Office add-in 可以直接接上。它跑在 WebView 裡，送出來的 request 除了基本的 API 相容性，還有額外條件。

---

## 本機 LLM 的難題常常不是推理，而是產品邊界的相容性

我原本以為只要 endpoint 是 Anthropic-compatible 就可以接。事實上是：

- Office add-in 要 HTTPS，不是 HTTP
- Office add-in 要特定的 model name，不是隨便什麼模型
- Office add-in 會送 built-in tools，不是只有基本對話
- Office add-in 跑在 WebView 裡，CORS preflight 的行為跟 curl 完全不同
- built-in tools 缺 `input_schema`，oMLX 0.3.8 不接受
- oMLX 原生有 Claude-compatible API，但 Office add-in 的實際 request 還需要 middleware 處理 CORS、built-in tools schema，以及 model id compatibility

這些每一個單獨看都不難解。但疊在一起，就變成一整個 compat shim。

本地模型的難題常常不在推理能力，而在產品邊界。一個「compatible」的 API，跟一個真實產品實際送出來的 payload，中間隔的不是幾行 code。

但至少它跑起來了。在 oMLX 前面加一層薄薄的 middleware，解決了最卡的那個 422。後面如果還有問題，就看它是不是送了其他 oMLX 還不相容的欄位。

慢慢補就好。
