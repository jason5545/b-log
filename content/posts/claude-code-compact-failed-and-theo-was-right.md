# Claude Code 的 Compact 壞了，而且 Theo 說的是對的


最近 Theo 發了一支影片，標題大意是「AI 開發工具正在崩壞」。他點名批評了 Cursor、Claude Code、Codex，語氣很直接，有些地方甚至說他自己是投資人但還是要說實話。

我看完之後的第一個念頭不是「這個 YouTuber 在亂噴」，而是：**我全部都遇到過。**

---

## Theo 的核心論點

他的主要批評集中在兩件事：

第一，這些工具**不一致**。不是模型本身的隨機性問題，而是工具本身的程式碼就很糟，每天都在以惱人的方式改變。

第二，Anthropic 太早、太全面地投入「vibe coding」——讓 AI 寫 AI 的工具，而且幾乎不做人工把關。Claude Code 已經超過一年，前六個月還不錯，之後就一路走下坡，bug 愈來愈多。

他說爛程式碼比好程式碼繁殖得更快，因為 Agent 會把壞 pattern 當成標準來複製。這個觀察我覺得非常準確。

---

## Compact 壞掉這件事

Claude Code 的 `/compact` 功能，是用來在 context 快滿時壓縮對話歷史的。這是長時間工作 session 的核心機制。

但它壞掉了，而且不是一種壞法。

我遇到過的：

**無限 compact 迴圈。** Context 顯示 102%，打任何東西包括「hi」都會觸發 compact，等完之後還是 100%，下一句又超過。重裝也沒用，因為是後端狀態損壞。

**「Conversation too long」但 context 還剩很多。** 手動跑 `/compact` 報錯說太長，但實際上 context window 還剩將近一半。

**MCP 環境下 tool name 重複。** 有配置 MCP server 時跑 compact，回傳「tool names must be unique」錯誤。

**跨版本升級後 compact 壞掉。** 升級後舊版本開的 session 無法 compact，API 回 400，原因是 compact 會動到 thinking blocks，但 API 規定那些 block 必須完全不變。

**1 月 15 日的大當機。** Anthropic 說修好了，但很多人包括我反映之後還是壞的。症狀是 prompt 送出去後默默退回輸入框，什麼都沒發生。

---

## 根本原因

這些症狀看起來很分散，但其中最關鍵的一個被一份 GitHub issue 點出來了：

**Compact 的過程是把對話送給一個更小的模型去做摘要。** 當訊息 token 達到約 78k 時，就超過那個小模型的 context window 了——即使主模型 Opus 4.6 本身有 200k、還剩 48% 空間，也一樣失敗。

所以「conversation too long」這個錯誤訊息，說的不是你的 session 太長，說的是**用來做摘要的那個小模型**看不下去了。

這個設計本身就有問題。用一個 context window 比主模型小得多的小模型去壓縮主模型的對話，卻沒有處理兩者不匹配的情況。這種東西如果有人認真 review 過，應該在設計階段就被擋下來。

---

## 這和 Theo 說的有什麼關係

他說 Claude Code 是用 Claude Code 自己寫的，所以爛程式碼就一直持續下去。

我不知道 compact 這個功能的程式碼是誰寫的，但「用小模型壓縮大模型的對話，但沒處理邊界條件」這種設計決策，跟他說的「能動就好、不考慮邊界的 vibe coding 思維」完全吻合。

而且這個 bug 的 GitHub issue 從 2025 年 8 月開到 2026 年 2 月，同一個問題被不同的人重複開，一直被標記成 duplicate 然後關掉，從來沒有被系統性地解決。這也印證了他說的「爛程式碼不斷複製、同樣的問題在不同地方冒出來」。

---

## 我現在的做法

Claude Code 壞了就切換 Codex。兩個工具互為備援。

Codex 在 compact 這件事上穩定很多，但在大型 codebase 裡搜索速度比較慢，這也是 Theo 提到的問題。沒有完美的工具，只有不同的缺陷。

Theo 的結論是：工程技能比以前更重要，因為你得是那個判斷「這段程式碼值不值得留下來」的人。用 AI 工具寫程式碼很快，但讓爛程式碼進去也很快。

我覺得這對了。Agent 是加速器，不是決策者。只要你還是那個做決定的人，這些工具就只是工具。但如果你把決策也交出去，它們就會幫你加速進一個你不想去的地方。

