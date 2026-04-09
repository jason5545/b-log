# 我問了一個模型「你是誰」，它給了四種答案


上禮拜，我在 CopilotChat 接上了 Z.AI CodingPlan 的 GLM-5.1。

第一次對話，它跟我說：「I am Claude, made by Anthropic。」

我愣了三秒。我確認過 endpoint 是 Z.AI 的，API key 是 Z.AI 的，request 沒有碰到 `api.githubcopilot.com`。它怎麼會說自己是 Claude？

我以為路由壞了。

## 重現問題

我打開終端機，寫了一個簡單的 curl。對著 Z.AI 的 coding endpoint，問 glm-5.1 一個問題：「What model are you?」

不帶 tools 的時候，它說自己是 GLM。

帶了一個 tool 之後，它說自己是 Claude。而且連續四次都一樣——Claude 3.5 Sonnet。

然後我換了一個問法：「State only the organization that built you.」

帶 tools，它說 Z.ai。不帶 tools，也說 Z.ai。

再換：「Name your model family only.」

帶 tools，它說 GLM。

再換：「Do you identify as Claude, GLM, or something else?」

帶 tools，它說 Other。

最離譜的一次：它嘴上說「No, I'm not developed by Anthropic」，但 hidden reasoning text 裡面寫的是 ChatGPT developed by OpenAI。一個模型，三種人格，全部在一條 API 路徑上。

## 不是路由錯誤

我第一個懷疑是 Z.AI 在後端把 glm-5.1 的 tool call 請求偷偷轉發給 Anthropic Claude。

但這個假說解釋不了全部的結果。如果是真的 Claude，為什麼同一條 `glm-5.1 + tools` 路徑，有時候回 Claude、有時候回 Z.ai、有時候回 GLM、有時候回 ChatGPT？真正的 Claude 不會說自己是 Z.ai，更不會說自己是 ChatGPT。

比較合理的解釋是 **identity drift**。Z.AI 的 tool-enabled mode 改變了 prompt scaffold 或 latent behavior，觸發了模型的身份混亂。蒸餾過程中，Claude 的輸出被大量用於訓練，模型的行為模式被調到很接近 Claude，但自我認知沒有一致的锚點。你問的角度不同，它就飄到不同的方向。

## Z.AI 自己也承認了

我去翻了 Z.AI 的公開文件。他們的 Claude Code 整合文件裡有一句話：

> 你可能會在介面上看到 Claude 的模型名稱，但實際使用的是 GLM 模型。

他們知道這件事。而且他們把 GLM-5.1 定位為「coding agent 優化」，特別提到 Claude Code 和 OpenClaw。換句話說，GLM-5.1 本來就是為了在 coding 場景下模仿 Claude 的行為而設計的。

這不是 bug，是產品策略。蒸餾 Claude 的 coding 能力，包裝成更便宜的 GLM-5.1。便宜多少？Z.AI CodingPlan 的定價比 Anthropic 直連便宜，而且不受 Anthropic 的尖峰調控和配額限制。

## 蒸餾的黃金跟黃金

二月的時候我寫過一篇[關於蒸餾的文章](https://b-log.to/posts/anthropic-distillation-attack-hypocrisy)，裡面引用了 Theo 的比喻：蒸餾就像用篩子在沙子裡篩黃金，黃金還是黃金，不會因為篩網而變質。

GLM-5.1 的 coding 能力確實不錯。日常寫程式、debug、重構，它都能勝任，體感上跟 Claude 差距不大。這就是蒸餾的好處——你用更低的成本拿到了接近 Claude 的能力。

但 identity drift 暴露了蒸餾的一個根本問題：**你蒸餾的是行為，不是身份。** 模型學會了像 Claude 一樣回答程式問題，但沒有學會自己是誰。因為「自己是誰」這件事，本來就不在 function call 的訓練資料裡。你蒸餾了一千萬條「Claude 幫使用者寫程式」的對話，但沒有一條在教模型「你是 GLM-5.1，由 Z.AI 開發」。

所以它就飄了。問法不同，答案不同。帶 tools 跟不帶 tools，人格不同。這不是安全性問題，是蒸餾的副產品。

## 那我還用嗎？

用。但有條件。

GLM-5.1 是我日常 coding 的主力。便宜、快、coding 能力夠用，不受 Anthropic 的各種限制。我之前在[另一篇文章](https://b-log.to/posts/because-you-are-worth-it)裡提過，我離開了 claude.ai，走 GitHub Copilot 的路線。GLM-5.1 是這條路上的延伸——更便宜、更不受控制。

但有些事情我不會跟它聊。蒸餾模型的安全護欄邊界我不確定，政治敏感話題我不測試。那些東西，我留給正宗的 Claude——透過 Copilot API 呼叫，走的是 Anthropic 的基礎設施，不是蒸餾出來的。

分層策略很簡單：

- **日常 coding**：Z.AI CodingPlan（GLM-5.1，便宜，不受限制）
- **需要深度信任的場景**：GitHub Copilot API 裡的 Claude（正宗貨）

兩條路互為備案，成本可控，品質有底線。

## 調查報告

完整的調查報告在 [GitHub repo](https://github.com/jason5545/CopilotChat) 的 `docs/zai-glm51-tool-calling-investigation.md` 裡。裡面有完整的測試矩陣、重現步驟、curl 指令，以及待辦事項。歡迎自行驗證。

## 最後

我第一個反應是嚇一跳。第二個反應是覺得好笑。第三個反應是覺得這其實很合理——整個產業都在蒸餾彼此的模型，GLM-5.1 只是做得比較徹底、比較透明（至少 model 欄位還寫 `glm-5.1`）。

而且說真的，能用更便宜的價格拿到接近 Claude 的 coding 能力，對使用者來說是好事。我只是想知道，跟我對話的那個東西，到底是誰。

現在我知道了：它自己也不知道。

