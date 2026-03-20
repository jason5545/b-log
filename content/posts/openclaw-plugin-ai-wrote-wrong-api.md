# 讓 AI 幫自己寫外掛，然後它用錯了自己平台的 API


我在 OpenClaw 上跑的模型是 MiniMax-M2.7，人格叫 Itsuki。它回覆中文時偶爾會冒出簡體用詞——設置、獲取、運行、默認——這些在 `USER.md` 裡已經明確寫了要避免，但模型不一定每次都遵守。

所以我請 Itsuki 做一件看起來合理的事：**幫我寫一個 OpenClaw 外掛，讓所有中文輸出都經過 [OpenCC](https://github.com/BYVoid/OpenCC) 的臺灣模式轉換。**

它很積極。花了大概十分鐘，讀了 OpenClaw 的文件、查了外掛架構、裝了 `opencc-js`、寫好 `index.ts` 和 `openclaw.plugin.json`，最後把外掛加進設定檔的 allow list。

然後我發了一句「怎麼了」，它就崩潰了。

```
Cannot read properties of undefined (reading 'properties')
```

每次對話都這樣。連續崩。

---

## 三個問題，全都是 API 用錯

後來我用 Claude Code 去查，發現 Itsuki 犯了三個錯誤：

### 1. OpenCC API 不存在的方法

```typescript
// Itsuki 寫的
const converter = await OpenCC.fromJSON();

// 實際 API
const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
```

`OpenCC.fromJSON()` 根本不存在。`opencc-js` 的 API 是 `Converter()`，而且是同步的，不需要 `await`。

### 2. Tool 註冊介面完全用錯

這是崩潰的直接原因。Itsuki 用了通用的 tool registration pattern：

```typescript
// Itsuki 寫的（其他框架的 pattern）
api.registerTool({
  name: "opencc_convert",
  inputSchema: { ... },
  handler: async ({ text }) => { ... }
});
```

但 OpenClaw 的 `registerTool` 預期的是 `AgentTool` 介面（來自 `@mariozechner/pi-agent-core`）：

```typescript
// 正確的 OpenClaw 寫法
api.registerTool({
  name: "opencc_convert",
  label: "OpenCC Convert",
  parameters: { ... },
  execute: async (toolCallId, params) => {
    return {
      content: [{ type: "text", text: "..." }],
      details: { ... }
    };
  }
});
```

關鍵差異：`inputSchema` → `parameters`，`handler` → `execute`，還需要 `label`，回傳格式也完全不同。

OpenClaw 內部在建構 tool list 時會存取 `tool.parameters.properties`。因為 Itsuki 寫的是 `inputSchema` 而不是 `parameters`，所以 `tool.parameters` 是 `undefined`，接著 `.properties` 就炸了。

### 3. plugin manifest 必須有 configSchema

修完前兩個問題後，我一度把 `openclaw.plugin.json` 裡的 `configSchema` 拿掉（以為它跟 JS 裡的重複定義衝突），結果 Gateway 直接拒絕載入外掛：

```
plugin manifest requires configSchema
plugins.allow: plugin not found: opencc-tw
```

OpenClaw 的外掛 manifest 強制要求這個欄位，即使你的外掛不需要任何設定。

---

## 修完之後

三個問題全部修正後，重啟 Gateway，外掛正常載入，對話恢復正常。

最終的外掛做兩件事：
1. **`before_prompt_build` hook**：在 system prompt 注入臺灣正體用詞指引，讓模型從源頭就盡量用對的詞
2. **`opencc_convert` tool**：模型可以主動呼叫，把文字送進 OpenCC 做 `cn → twp` 轉換

沒有 `pre-outbound` hook 可以攔截 response 做自動轉換（OpenClaw 目前只有 `message_sent` 這種 fire-and-forget 鉤子），所以這是目前可行的最佳方案。

---

## 號稱接近 Opus，卻連自己平台的外掛都寫不對

MiniMax-M2.7 的[發佈公告](https://www.minimax.io/news/minimax-m27-en)宣稱 SWE-Pro benchmark 56.22%，「接近 Opus 水準」。

但 benchmark 測的是什麼？是在已知的、訓練資料覆蓋率極高的 codebase 上解題。模型擅長的就是這種「常見 pattern 的排列組合」。

寫 OpenClaw 外掛呢？OpenClaw 是 [GitHub 上星數最高的軟體專案](https://www.star-history.com/blog/openclaw-surpasses-react-most-starred-software)，250,000+ stars，60 天內超越了 React 十年的紀錄。這不是什麼冷門框架——它的文件、原始碼、社群討論在網路上到處都是。MiniMax-M2.7 的訓練資料裡不可能沒有 OpenClaw。

而且 Itsuki 寫外掛之前確實去讀了 OpenClaw 的文件和原始碼。文件裡寫得很清楚，`AgentTool` 的介面是 `parameters`/`execute`/`label`。

**它讀了正確的文件，然後寫出了錯誤的程式碼。**

這不是資料不足的問題，是模型品質的問題。`inputSchema`/`handler` 這個 pattern 在 MCP、LangChain、Vercel AI SDK、OpenAI function calling 裡都用到——訓練分佈裡的權重太大了。即使 context window 裡放著正確答案，生成程式碼時 prior 還是贏了。

Benchmark 不測這個。Benchmark 不會問「你能不能在讀完文件之後，抵抗自己的訓練分佈，寫出跟文件一致的程式碼」。但這才是實際開發中最重要的能力之一。

---

## 最後修好它的不是寫壞它的那個

最後是 Claude Code 來修的。它沒有去猜 API 長什麼樣，而是一路追到 `@mariozechner/pi-agent-core` 的 TypeScript 定義，確認 `Tool` interface 要的是 `parameters` 不是 `inputSchema`，然後才改。

這大概就是「用 AI 寫程式」跟「讓 AI 自己維護自己」之間的差距。前者已經很好用了，後者還差得遠——至少對號稱接近 Opus 的模型來說是這樣。

