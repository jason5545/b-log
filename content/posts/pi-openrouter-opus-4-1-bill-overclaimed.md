# 有人說 pi 偷用 OpenRouter 額度，我叫 Claude 讀原始碼查：帳單對得上，結論講太滿

有人發文提醒大家小心 pi agent。原 PO 去 OpenRouter 看額度還剩多少，發現少了十幾美元，可是自己幾乎沒在用，都是拿來測模型；一查才發現是 pi 在用，而且用的是 Opus 4.1。原 PO 已經把 pi 移除，回去用 Claude Code、Codex 和 opencode。

我沒在用 pi，我用的是 omp（oh-my-pi），從 pi fork 出來的 coding agent。omp 有一個叫 smol 的模型角色，會在背景幫對話取標題、做這類雜事。pi 有沒有，我沒印象。所以我叫 Claude Code 把 pi 的原始碼 clone 下來查。

## 原始碼裡沒有 smol

pi 的 repo 已經搬到 [earendil-works/pi](https://github.com/earendil-works/pi)，Claude Code 讀的是 10/12 的 main。裡面沒有取標題的功能，也沒有寫死的副模型，整個 repo 只有一個測試檔提到 `claude-opus-4.1`。OpenRouter 的預設模型寫在 `defaultModelPerProvider`，是 `moonshotai/kimi-k2.6`。

主對話以外，pi 自己會發的請求有三種：context 快滿時的自動 compaction、用 `/tree` 切換分支時的 branch summary（預設會先問），還有 cache warming。cache warming 是 agent 還在跑的時候，趕在 prompt cache 過期前把同一個請求重送一次，輸出只要 1 個 token，讓快取不要過期；預估能省 0.05 美元以上才會送。三種用的都是當下 session 選的模型，不會另外換一個。

看到 Opus 4.1，我的第一個反應是：Opus 有 4.1？有。Anthropic 在 2025 年 8 月 5 日[發布 Opus 4.1](https://www.anthropic.com/news/claude-opus-4-1)，是 Opus 4 的小改版。2026 年 1 月 16 日，它從 Claude app 和 Claude Code 的模型選單拿掉；Claude API 那邊，[release notes](https://platform.claude.com/docs/en/release-notes/overview) 寫的是已經退役。

## 6 分鐘，5.14 美元

後來拿到原 PO 的 OpenRouter Logs 截圖，篩選條件是 Claude Opus 4.1。供應商欄寫 Amazon Bedrock，所以到 10/3，OpenRouter 還能透過 Bedrock 叫到 Opus 4.1。App 欄寫 pi。pi 打 OpenRouter 時會帶 `X-OpenRouter-Title: pi`，這些請求確實是 pi 送的。

畫面上有 8 筆，時間是 10/3 晚上 9:20 到 9:26。大部分每筆的 input 都在 16 萬 tokens 上下，output 只有一百多到六百，9:20 那一分鐘就有三筆。這看起來是 agent 在連續呼叫工具：模型每發一次工具呼叫，pi 就把 16 萬 tokens 的整段 context 重送一次。

用 9:24 那筆反推單價：27,359 個 input token 加 1,794 個 output token，收了 0.545 美元，剛好是 input 每百萬 token 15 美元、output 75 美元，而且完全沒吃到快取。16 萬那幾筆大約 0.25 美元一筆，用全價算要 2.38 美元左右，大部分吃到快取才付得出這個價錢。9:23 那筆 1.32 美元、9:26 那筆 2.20 美元，有一大段沒吃到快取，單筆就貴了好幾倍。

8 筆加起來 5.14 美元，前後 6 分鐘。照這個速度，十幾美元大概 15 分鐘就燒完了。

那幾筆 0.25 美元的也不會是背景請求。照 pi 的程式碼，compaction 和 branch summary 都把快取關掉，cache warming 的 output 固定 1 個 token，所以它們是一般的對話輪次。這點一樣是拿 10/12 的程式碼推的。

## 不聲不響換模型，pi 真的有

我又叫 Claude 用 gh 搜 pi 的 issue，先搜 open，再搜 closed。沒有人提到 Opus 4.1，也沒有人回報背景偷打請求。

可是「啟動時不聲不響換掉模型」，從 8 月到 10 月至少有 6 筆。[#8810](https://github.com/earendil-works/pi/issues/8810) 到現在還開著，10/7 有人補了一個 OpenRouter 的情況：pi 1.0.4，只用 `OPENROUTER_API_KEY` 環境變數，預設模型設成 `openrouter/z-ai/glm-5.3-flash`，大約 10/4 以前都正常，之後每次 `pi -p` 都跑在 `anthropic/claude-opus-4-8`。原因是啟動時 auth 狀態還沒建好，pi 判斷設定的模型沒有認證，就改走各 provider 的預設對照表。[#10812](https://github.com/earendil-works/pi/issues/10812) 是 10/11 開的：存起來的預設模型從目錄消失之後，pi 直接改用另一個 input 單價貴 4.4 倍的模型，沒有任何警告，session 檔記成一筆普通的 `model_change`。回報的人是看到費用比平常高才發現。

選模型的介面也容易出錯。`/model` 選單按 Enter 只套用到這個 session，要按 Ctrl+S 才會存成預設（[#10505](https://github.com/earendil-works/pi/issues/10505)）。搜 `opus` 的時候，第一個結果是 sonnet（[#10552](https://github.com/earendil-works/pi/issues/10552)）。

所以「它跑了一個我沒選的模型」，在 pi 不是空穴來風。但這些回報裡被換上的，多半是各 provider 預設對照表裡的模型，OpenRouter 是 `kimi-k2.6`，Anthropic 是 `claude-opus-4-8`，對不到時才拿可用清單的第一個。目前看到的回報，沒有一筆是換成 OpenRouter 的 Opus 4.1；清單第一個會不會剛好是它，我沒查。

## 查的 AI 也講太滿

Claude Code 第一則回答，開頭就是「pi 沒有偷用額度」，原 PO 裝的是哪一版，放在後面才帶一句。截圖進來之後，它說「這張截圖把我前面說的推論證實了」。中間還有一句「pi 唯一不用你按 Enter 就會送出的請求是 cache warming」。

我把這段 session 丟給 Sol 看。Sol 先重算，8 筆合計 5.14 美元、0.545 美元那筆的單價都對。然後挑出三個地方。截圖只證明標成 pi 的請求用了 Opus 4.1，沒證明它是怎麼被選上的。拿 10/12 的 main 替 10/3 的安裝版本下結論，開頭卻講得很肯定，前後的把握對不起來。不用按 Enter 的也不只 cache warming，自動 compaction 是 Claude 自己前面查到的，agent 連續呼叫工具，每一輪也不用按 Enter。

Claude 四點都認了。

上個月 Opus 5 寫的規格被 [DeepSeek V4.1 Flash 抓到矛盾](https://b-log.to/ai-analysis/opus-5-spec-caught-by-deepseek-v4-1-flash/)，那次是驗收條件憑上一輪的印象填，沒有重算。這次的數字 Sol 重算過，都對，講過頭的是結論。

截圖能證明的，是 pi 送了這些 Opus 4.1 的請求。原始碼能證明的，是 10/12 的 pi 沒有藏一個副模型。Opus 4.1 是怎麼被選上的，兩邊都證明不了。要查得看原 PO 的 `settings.json` 和那個 session 的 jsonl；而照 #10812 的說法，session 檔裡被換掉的模型跟自己選的長得一樣，只能拿 `settings.json` 的 `defaultModel` 來對照。

Sol 的結論是：貴的模型加上很大的 context，就足以解釋這筆錢；偷偷切模型沒有證據，模型是怎麼被選上的也還沒查明。

---

最後這件事跟我自己有關。我一開始只知道 omp 有 smol，pi 有沒有不確定。查下來，pi 沒有。

可是 Claude 順手看了 omp 10/12 的程式碼。smol 沒有明確設定、default 有設定的時候，smol 會先繼承 default 的模型，不是直接用內建清單裡的 Haiku 5.5 或 Gemini 3.8 Flash。取標題實際上走不走這條路，Claude 沒有查到底。Sol 的說法是：角色叫 smol，不保證實際跑的是便宜模型。

我的 omp 裡，smol 有沒有設，我還沒去看。
