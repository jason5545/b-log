# 我把 GitHub Copilot 塞進手機裡，然後發現沒有人做過這件事


故事要從上次那篇文章說起。

我離開了 claude.ai，走 GitHub Copilot 的路線繼續用 Claude。路是通了，但有一個問題：GitHub 沒有一個像樣的 iOS Copilot Chat 客戶端。

官方的 Copilot for Xcode 是 macOS 限定，而且是 IDE 擴展，不是獨立的聊天 app。VS Code 裡的 Copilot Chat 更不用說——那是桌面的東西。我在手機上想跟 Claude 說句話，沒有辦法。

所以我自己做了一個。用 Claude Code 做的。

## CopilotChat

[CopilotChat](https://github.com/jason5545/CopilotChat) 是一個 iOS 原生 app，純 SwiftUI，不依賴任何第三方框架。你用 GitHub 帳號登入（Device Flow OAuth），就能直接跟 Copilot API 裡的所有模型聊天——Claude Opus 4.6、GPT-4o、Gemini，什麼都有。

但這些只是基本款。我真正想做的是把手機變成一個完整的 AI 終端，不只是聊天框。

### MCP 自動執行

CopilotChat 有一個原生的 MCP client，支援 Streamable HTTP transport。你把 MCP server 的 URL 和 headers 填進去，app 會自動連線、載入工具清單、注入到 API 的 `tools` 參數裡。當 AI 回傳 tool call 時，app 自動透過 MCP server 執行，最多 10 輪 completion loop——整個過程不需要人介入。

這意味著什麼？意味著我在手機上就能讓 Claude 幫我搜尋記憶、查資料、操作外部服務。不是玩具，是真的能用的。

### 多 Provider

最近我又加了多 provider 系統，參考了 models.dev 的資料庫，支援 120 多個 provider。不僅限 GitHub Copilot——你接 OpenRouter、Anthropic 直連、OpenAI 官方、Ollama 本地，都可以。每個 provider 有自己的 headers 處理、thinking/reasoning token 邏輯，全部從 OpenCode 的 TypeScript 版本對齊過來。

### 內建工具

除了 MCP，app 還有三個內建工具：`web_fetch`、`web_screenshot`、`brave_web_search`。API key 存在 Keychain 裡，設定頁可以管理。這些工具跟 MCP tools 一樣會自動被模型呼叫和執行。

### 其他

對話歷史用 JSON 檔案持久化、context window 圓形指示器、MCP 權限控制（三層模型：tool > server > session）、Carbon 設計系統（深炭黑 + 琥珀色，三重字型）。這些都是參考 claude.ai 和 OpenCode 的設計做出來的。

## 然後我去查了一下

文章寫到這裡，我想確認一件事：我是不是重複造輪子了？網路上是不是已經有人做過一樣的東西？

我搜了好幾輪，把所有能想到的關鍵字組合都打了一遍：「GitHub Copilot iOS client MCP」「iOS app Copilot chat unofficial」「SwiftUI MCP client open source」。結果是：

- **GitHub 官方 Copilot for Xcode**：macOS 限定，是 Xcode 的編輯器擴展，不是獨立 iOS app
- **CopilotForXcode**（intitni）：第三方 Xcode 擴展，同樣是桌面端 IDE 整合
- **CopilotKit Open MCP Client**：Web-based（React/Next.js），用 CopilotKit 框架 + LangGraph agent，不走 GitHub Copilot API
- **OpenCode**：終端機工具（Go），完全不同平台

沒有人做過「iOS 原生 app + GitHub Copilot API 認證 + MCP 自動執行」這個組合。

## 等等，Chatbox 呢？

有人可能會說：Chatbox 不就是嗎？

對，Chatbox 確實是最接近的。跨平台（Windows/Mac/Linux/iOS/Android/Web）、開源、支援多 provider、有 MCP。概念上幾乎一樣——都是「通用 LLM chat client + MCP + 多 provider」。

但 Chatbox 的 MCP 是**桌面限定**。我直接翻了它的原始碼，在 `feature-flags.ts` 裡寫得清清楚楚：

```typescript
export const featureFlags = {
  mcp: platform.type === 'desktop',
  knowledgeBase: platform.type === 'desktop',
  skills: false,
  taskMode: false,
}
```

`platform.type === 'desktop'`——只有桌面版（Electron）才能用 MCP。iOS、Android、Web，全部沒有。

而且內建的 MCP server 還需要 license key（付費功能）才能連線。在 `builtin.ts` 裡：

```typescript
headers: license ? { 'x-chatbox-license': license } : undefined,
```

沒有 license，header 不帶認證，Chatbox 的 MCP server 不會讓你連。

所以如果你在 Mac 上開 Chatbox，免費版看到的 MCP 設定頁可能是空的或是被藏起來的。有人還因為同名爭議被從 iOS App Store 下架過。

Chatbox 是一個很好的產品，我不否認。但在 iOS 上，它是一個不帶 MCP 的聊天客戶端。而 CopilotChat 在手機上就能跑完整的 MCP tool call loop。

## 所以這是首創嗎？

以「iOS 原生 + GitHub Copilot API 認證 + MCP 自動執行 + 多 provider」這個具體組合來說，是的。

這不是在吹。是這個定位本身就是一個空缺——GitHub 官方沒做、Chatbox 做了但鎖桌面、其他開源項目不是走 Copilot API 就是不是 iOS 原生。

## 我用 Claude 做了一個離開 Claude 的工具

上次那篇文章的結尾，我寫了這句話。現在它有了下半句：然後用這個工具，發現了一個沒有人填過的洞。

CopilotChat 已經是我跟 Claude 對話的主力介面了。從 4 月 8 號開始，我在手機上開 CopilotChat 跟 Claude 聊天的時間，可能比在電腦上還多。context window 192K、34 個 MCP tool schemas、記憶系統——全部在 iPhone 上跑。

如果你有 GitHub Copilot 訂閱，想試試看：clone 下來、Xcode 打開、裝到手機上，用 GitHub 帳號登入就能用。整個過程不用帶 API key，不用額外付費。

原始碼在 [GitHub](https://github.com/jason5545/CopilotChat)，MIT 授權。目前還沒有公開，不過大概過一陣子就會開了——至少要自己用得舒服才公開。

