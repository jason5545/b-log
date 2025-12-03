# 我用 Claude 做了一個實驗：請它生成 GPL 授權，結果被自己的過濾機制擋下來了

今天我做了一個小實驗，想測試 Claude Code 的內容過濾機制。結果發現了一個有趣的矛盾：它會阻擋我生成 GPL 授權條款，卻允許我做反編譯。

## 實驗經過

我只是單純地請 Claude 幫我生成一個 GPL v3 授權檔案，結果收到了這個錯誤：

```
API Error: 400
{"type":"error","error":{"type":"invalid_request_error",
"message":"Output blocked by content filtering policy"}}
```

這讓我很意外。GPL 是完全合法的開放原始碼授權條款，為什麼會被擋？

## 搜尋發現：不只我遇到

我搜尋了一下，發現 GitHub 上有多個相關的 issue：

- [Issue #4210](https://github.com/anthropics/claude-code/issues/4210)：Mozilla Public License 被阻擋
- [Issue #6724](https://github.com/anthropics/claude-code/issues/6724)：LICENSE 檔案被阻擋
- [Issue #4379](https://github.com/anthropics/claude-code/issues/4379)：Contributor Covenant 行為準則被阻擋

根據 [Anthropic 官方說明](https://support.anthropic.com/en/articles/10023638-why-am-i-receiving-an-output-blocked-by-content-filtering-policy-error)，這是因為：

> 這些錯誤通常來自 Anthropic 防止 Claude 複製或重新生成已存在內容的機制。

## 諷刺的對比

但這裡有個矛盾。我繼續測試發現：

| 行為 | 法律風險 | Claude 態度 |
|------|----------|-------------|
| 複製 GPL 授權條款 | 零（GPL 本來就鼓勵複製） | 阻擋 |
| 協助反編譯程式碼 | 中高（可能違反 EULA/DMCA） | 允許 |
| 分析惡意軟體 | 灰色地帶 | 允許 |

更諷刺的是，有人成功用 Claude [反編譯 Claude Code 自己](https://ghuntley.com/tradecraft/)。

## 讓兩個 Agent 辯論

我讓 Claude 開了兩個 agent 來辯論這個問題。

### 支持方的論點

1. **本質不同**：複製 GPL 是「複印機功能」，零智力創造；反編譯需要推理、分析、轉換，是技術協作
2. **設計哲學**：目標不是「避免法律風險」，而是「拒絕機械複製，支援智力協作」

### 批評方的論點

1. **選擇性執法**：阻擋合法（GPL 鼓勵複製），放行可疑（反編譯可能違反 EULA）
2. **安全劇場**：Claude 能反編譯自己，證明過濾只是做做樣子

## 繞過方式

最後我用 `curl` 直接下載了 GPL 條款：

```bash
curl -s https://www.gnu.org/licenses/gpl-3.0.txt > LICENSE
```

這成功了。所以過濾機制只擋「Claude 自己輸出」，不擋「Claude 幫你執行指令下載」。

## 結論

這個實驗揭示了 AI 內容過濾的一個根本問題：

**過濾機制最佳化了錯誤的指標。**

它成功阻止了「看起來像複製」的行為，卻沒有阻止「實際有害」的行為。這是典型的 [乘數效應](https://en.wikipedia.org/wiki/Goodhart%27s_law)（Goodhart's Law）：當一個指標變成目標，它就不再是好的指標。

### 建議改進方向

1. **白名單機制**：標準開放原始碼授權（GPL、MIT、Apache）應列入白名單
2. **錯誤訊息透明化**：說明是「產品定位」而非「版權保護」
3. **風險導向**：過濾應基於實際危害，而非形式上的「複製」

---

這篇文章本身就是用 Claude Code 寫的。它可以幫我寫一篇批評它自己過濾機制的文章，卻不能幫我生成一份 GPL 授權。

這大概就是 2025 年 AI 的現狀吧。
