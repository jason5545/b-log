# Anthropic 公開防蒸餾的做法，我撞過的簡體摘要和程式審查被擋都在裡面

Anthropic 10 月 12 日發了一篇[防蒸餾的說明](https://www.anthropic.com/research/distillation-defenses)，說新的防線讓蒸餾者從 Claude 拿到的推理內容少了九成到九成九。文章裡提到，他們最早的防蒸餾措施之一，就是先讓 Claude 把推理整理成摘要，再拿給使用者看。

9 月 23 日我在 Claude Code 畫面中間看到的整句簡體，就出在這層摘要裡。那時我查到 thinking 區塊回傳的不是原始推理，是另一個模型做的摘要，負責思考的那個模型也看不到它（〈[Opus 5.5 冒出的整句簡體，都在畫面中間的摘要裡](https://b-log.to/ai-analysis/opus-5-5-simplified-chinese-in-thinking-summary/)〉）。我知道那一層是另一個模型做的，但不知道它為什麼會在那裡。

## 摘要的工作就是丟掉東西

這次 Anthropic 給了數字。他們拿 Opus 4.8 的對話紀錄去訓練一個模型，再看它在 SWE-bench Verified 上的分數：用完整推理訓練是 80.4%，只用摘要訓練是 71.8%。摘要讓紀錄變得比較沒有用，這正是他們要的效果。

那篇我的結尾寫「能修的在 Anthropic 那邊」，這句現在要打折扣。簡體是摘要模型順手造成的，Anthropic 要修，也是修它的用字，我不覺得他們會為了這個拿掉整層摘要。我 9 月 27 日之後改成 thinking 用英文寫、最後回我的才用正體，這個做法會繼續用下去。給我的那段回覆，至少是 Opus 自己寫的字。

## 擋下程式審查的，看名字就是這一套

10 月 6 日，我貼了一段工作紀錄請 Claude 做程式審查，被一個叫 reasoning_extraction 的分類器擋下來。請它幫我起草回報，又被擋一次，最後是 Codex 寫完的（經過寫在〈[Anthropic 說 Claude 做不到就繞過限制，我的 AGENTS.md 也是出事後才補上那幾條](https://b-log.to/ai-analysis/anthropic-unintended-model-actions/)〉）。

這篇文章沒有提到這個分類器的名字。它描述的第二道防線，是偵測「要 Claude 把藏起來的推理寫出來」的請求，用兩段式分類器，跑在 Sonnet 5.5、Opus 5 和 5.5、Fable 5 和 5.1 上。第一道是不讓推理被搬動：8 月 31 日起開的 API 帳號，不能修改 Claude 前面的上下文。名字對得上的，是第二道。

文章給的誤判率是低於千分之一，理由是一般使用者很少要模型寫出完整的隱藏推理，這種請求很好認。他們也列了已經補起來的新手法，像是要 Claude 把前面的推理翻成另一種語言，或叫它在回答旁邊用標籤把推理寫出來。

我平常的用法就不太像「一般使用者」。我常叫 Claude 掃自己的 Claude Code 對話紀錄，9 月查簡體那次就是，那些紀錄裡本來就有 thinking 區塊。這算不算要它把之前的推理寫出來，文章沒有講。10 月 6 日那段工作紀錄裡是哪一句讓它判斷成這一類，我也不知道。千分之一是拿全部流量平均出來的，Fable 5.1 那次我就寫過，同一條線對不同位置的人，分母不一樣（〈[Fable 5.1 放寬的第一天，我的第一個 prompt 就被擋了](https://b-log.to/ai-analysis/fable-5-1-relaxation-first-prompt-flagged/)〉）。

## 被擋的請求，現在要收錢

文章裡還有一段：9 月 24 日起，在誤判率低於千分之一的那幾類（防蒸餾在內），請求如果在 Claude 回答之前就被擋下，Anthropic 恢復收費。

10 月 6 日在 9 月 24 日之後。我是用 Max 訂閱跑 Claude Code，文章沒說訂閱方案被擋要怎麼算，那兩次有沒有算進我的額度，我不知道。

Fable 那篇我寫過，廠商寧可誤殺，是成本不對稱下的理性決定，「我可以理解這個邏輯，同時不接受它變成我的成本」。現在那個成本有價格了。

## 代價這次寫出來了

二月 Anthropic 第一次發蒸餾報告，我跟著 Theo 一起不信那些數字（〈[Anthropic 指控 DeepSeek 蒸餾攻擊，然後有人把數字翻開了](https://b-log.to/ai-analysis/anthropic-distillation-attack-hypocrisy/)〉）。那份[報告](https://www.anthropic.com/research/detecting-and-preventing-distillation-attacks)說，他們做的防線不會影響合法客戶的使用體驗。

這篇自己承認沒有完全做到：鎖住上下文讓一些開發者得改整合方式，分類器會誤擋正常的請求，被誤擋的還要付錢。他們說這些代價值得。

值不值得是他們算的帳。我這邊的帳比較小：一層會把正體改成簡體的摘要，一個把程式審查當成在挖推理的分類器，兩個現在都找到出處了。下次畫面中間又冒出簡體，或請求又被擋，我至少知道要往哪一層查。

