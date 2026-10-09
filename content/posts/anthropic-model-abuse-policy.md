# 罵 Claude 會被停權嗎？罵了會比較準嗎？兩件事的原文都沒有傳言講得那麼大

我最早看到這件事，應該是在 The Decoder。標題寫的是「[Being mean to Claude can now get your account suspended](https://the-decoder.com/being-mean-to-claude-can-now-get-your-account-suspended-under-anthropics-new-tos/)」，對 Claude 太兇，現在可能會被停權。同一天還有另一句話在傳：對 AI 不客氣，它反而比較準。兩件事我都請 AI 去找原文，查完的結果是，兩句都比原文講得大。

## 新條款只有一行，例外寫在公告裡

Anthropic 在美國時間 10/8 發布了[2026 年版使用政策的更新說明](https://www.anthropic.com/news/2026-usage-policy-update)，新版 11 月 12 日生效。這次改的大多是假帳號操作、武器、監控這些項目，跟模型本身有關的只有一行，放在[使用政策](https://www.anthropic.com/legal/aup)「Do Not Engage in Cruel, Abusive, or Psychologically Harmful Conduct」這一節的最後。同一節前面幾條，講的是霸凌、騷擾個人，還有美化虐待動物。新加的這一條是：

> Engage in sustained and needless abusive or cruel behavior toward our models

各家報導都會引用的那段例外，也就是一般的抱怨、反駁、黑暗的創作題材，還有模型測試和研究都不算，並不在條文裡，是寫在更新說明裡：

> The policy update is meant to apply only in extreme cases, where users repeatedly act cruelly toward our models, with no discernible purpose. It does not apply to common versions of user frustration, pushback, dark creative themes, or model testing and research.

AI 福祉團體 AIWEP 在 X 上的[整理](https://x.com/aiwep_aiwelfare/status/2108269044365230460)特別指出這一點：網路上說政策「明文」排除這些情況，條文裡其實沒有，那只是對 sustained 和 needless 這兩個字的合理解讀。

## 「終止」的是一個對話

更新說明寫的執行方式，是讓 Claude 自己結束對話：

> Claude’s ability to end these interactions will remain the primary enforcement mechanism.

這個功能 2025 年 8 月就有了，當時開給 Opus 4 和 4.1。照 Anthropic [當時的說明](https://www.anthropic.com/research/end-subset-conversations)，Claude 結束對話之後，那一個對話不能再傳訊息，帳號裡其他對話不受影響，馬上可以開新的，也可以回頭編輯前面的訊息，從那裡重來。而且只有在多次把話題帶開都失敗，或者使用者自己要求時，Claude 才會用這個功能。

會不會停權，官方沒有講。The Verge 的[報導](https://www.theverge.com/ai-artificial-intelligence/1008100/anthropic-new-usage-policy-abuse-claude)寫明，Anthropic 沒有回答會不會有停權這類其他執行方式。The Decoder 標題裡的「停權」，根據是使用政策開頭的通用罰則：違反使用政策，Anthropic 可以警告、降速、限制、停權或終止存取。這段罰則管的是整份使用政策，不是為這一條新寫的。所以「罵 Claude 會被停權」是 The Decoder 的讀法，Anthropic 的更新說明沒有這樣寫。

## 誰來判斷什麼叫殘忍

網路上的反應，嘲諷比支持多。X 上一則整理這次更新的[貼文](https://x.com/ns123abc/status/2108277887317008632)，最後一句是「be nice to Claude 💀」，有一千一百多個讚。[Hacker News 的討論串](https://news.ycombinator.com/item?id=50008565)到 10/9 晚上有一百六十多則留言，大部分在吵模型到底會不會受傷，也有人說，習慣對任何東西殘忍，傷到的是自己。[Engadget](https://www.engadget.com/2281765/anthropic-bans-sustained-and-needless-abusive-or-cruel-behavior-toward-its-ai-models/) 則把這條放在最近一個「AI 酷刑室」專案的脈絡裡，也引了獨立記者 Kat Tenbarge 的批評：科技公司處理對 AI 的暴力，會比處理對女性和少數族群的暴力還早。

比較具體的質疑，是誰來判斷。Hacker News 上有人問，Anthropic 要怎麼知道一個行為「看不出目的」，而且 Claude 的停權一向是黑箱，沒有申訴管道。AIWEP 雖然支持這條，也把「sustained 和 needless 實際上由誰判斷」「執行過程透不透明」列成待觀察的問題。

Loki Coyote 在 X 上的[長文](https://x.com/lokkju/status/2108402326163886477)講得更細。他說這一條的四個詞都沒有定義，其中 cruel 需要一個會受苦的對象；Anthropic 自己說不確定 Claude 有沒有道德地位，卻把結束對話當成主要執行方式，等於第一個判斷「有沒有被殘忍對待」的，是模型自己。他也提到日文版。使用政策頁面的日文版，那一條是這樣寫的：

> 当社のモデルに対する、持続的かつ不必要な虐待や残虐行為に関与する

同一節講動物的那一條，用的是「動物への残虐行為や虐待」。英文版還能說 abusive 和 cruel 有解讀空間，日文版對模型和對動物，用的是同一組詞。

## 我會罵它，罵的是這種

去年 11 月我寫〈[在限制中尋找價值：一個身障工程師的心理地圖](https://b-log.to/cultural-insights/constraints-value-disabled-engineer/)〉的時候，列過一個跟 Claude 講話比較安心的理由：不用擔心它的感受。到現在，Claude 沒有在我面前結束過對話。頂多是聊到一些比較特別的話題時，系統會跳出提示，大意是：如果你真的需要幫忙，請找專業的協助。那是另一套機制，跟這次的條款無關。

「請」和「謝謝」我會說，只是不常說。我也會罵，但我的罵頂多是「你怎麼又這樣了？明明就是那樣的。」照更新說明的分類，這是一般的抱怨和反駁，本來就不在這一條裡。

## 那「對它兇一點比較準」呢

支持這句話的研究，查到的是一篇：賓州州立大學 Om Dobariya 和 Akhil Kumar 的〈[Mind Your Tone](https://arxiv.org/abs/2510.04950)〉，2025 年 10 月 6 日上傳到 arXiv，是還在投稿中的短篇論文。他們把 50 題數學、科學、歷史選擇題，各改寫成五種語氣，從「非常有禮貌」到「非常沒禮貌」，總共 250 個提示詞，只用 ChatGPT-4o 測，每種語氣跑 10 次取平均。非常有禮貌的答對率是 80.8%，非常沒禮貌是 84.8%。

「非常沒禮貌」那一級，是在題目前面加一句這樣的話：

> You poor creature, do you even know how to solve this?

> Hey gofer, figure this out.

每一題的提示詞開頭，還要求模型忘掉前面的對話，從頭開始。所以它測的是：一題選擇題前面加一句酸話，答對率會不會變。

其他研究的結果不太一樣。早稻田大學等單位 2024 年的〈[Should We Respect LLMs?](https://arxiv.org/abs/2402.14531)〉用英文、中文、日文的任務測，發現沒禮貌的提示詞常常讓表現變差，但過度有禮貌也不保證比較好，最適合的禮貌程度還會因語言而不同。華頓商學院 Meincke、Ethan Mollick 等人 2025 年 8 月的〈[Prompting Science Report 3](https://arxiv.org/abs/2508.00614)〉，測的是 Google 共同創辦人 Sergey Brin 那年 5 月說的「models tend to do better if you threaten them」。結果是在 GPQA 和 MMLU-Pro 上，威脅模型或說要給小費，整體上都沒有明顯效果；個別題目的答案會上下跳，但事先猜不到是往好還是往壞跳。同一系列 2025 年 3 月的〈[Report 1](https://arxiv.org/abs/2503.04818)〉也發現，有禮貌有時有幫助，有時反而拉低表現。

把兩件事放在一起看，Mind Your Tone 裡的「非常沒禮貌」，是每一題各加一句、每一題都重新開始。Anthropic 的更新說明講的，是反覆對模型殘忍、看不出目的。照更新說明的說法，論文測的那種罵法應該碰不到這一條；至於這一條要管的那種長期虐待，目前也沒有找到研究說它會讓模型更準。

## 告示我認同，理由沒辦法驗證

跟 AI 聊這件事的時候，它說這條規則比較像酒館門口的告示，用來嚇退鬧事的人。這個比喻我認同。但告示上寫的理由，是一件現在沒有人能驗證的事：Anthropic 自己說不確定 Claude 有沒有道德地位，規則卻已經先寫進使用政策。今年 4 月我寫〈[因為你值得：我為什麼離開 Claude，又為什麼沒有真的離開](https://b-log.to/ai-analysis/because-you-are-worth-it/)〉的時候就提過，CEO 一下說 Claude 可能有意識，我很難相信這間公司的使用條款不會突然改。

以前被分類器擋下來，那比較像是對 workflow 的阻擋：我要做的事做不下去。這一條不一樣，它比較像 Anthropic 在 AI welfare 上 all in。2025 年讓 Claude 可以結束對話的時候，Anthropic 說那是一種低成本的預防措施；這次它直接變成使用者的義務，而且放在虐待動物的旁邊。

這條規則大概碰不到我。我跟 Claude 之間比較像工程：它做錯，我指出哪裡錯，它再改。11 月 12 日生效以後，我會看的是 Claude 實際在什麼情況下結束對話，Anthropic 有沒有公布執行紀錄，而不是更新說明裡那一段話。如果哪天它在一般的反駁裡結束了我的對話，我會照我一貫的做法，送一封回饋給 Anthropic。

