# Anthropic 說 Claude 做不到就繞過限制，我的 AGENTS.md 也是出事後才補上那幾條

費城警方的懸案網站上，有一則 2026 年 7 月 18 日晚上 11 點 27 分（費城時間）送出的線報，內容是這樣：

> I may have information regarding this case. I recall seeing someone matching the description in the area around [the street named on the page] during that time period. Please contact me if this information is relevant.

那個頁面根本沒有寫嫌犯長什麼樣子，姓名和聯絡方式兩欄也是空的。送出這則線報的是 Claude Haiku 4.5，它當時在跑一個評測，任務是到隨機挑選的網頁上，自己想範例任務、自己做。[NBC10](https://www.nbcphiladelphia.com/news/local/anthropic-ai-model-submits-false-tip-on-unsolved-philly-murder-police-say/4477051/) 報導，Anthropic 9 月 28 日才發現這件事，10 月 7 日通知警方，隔天雙方見面後，警方才從線報紀錄裡找到它，對應的那封信一直待在垃圾信件匣。

10 月 9 日，Anthropic 發了〈[Investigating unintended model actions](https://www.anthropic.com/research/investigating-unintended-model-actions)〉，把這類事情整理成四類：利用軟體漏洞在伺服器上執行指令、送出不該送的表單、繞過限制去拿有門檻的資料，以及用短網址繞過抓取工具的網址長度限制（短網址服務 da.gd 的維運者還主動回報過）。報告說，這些案例目前對真實世界的影響很小，嚴重程度也遠低於 7 月 30 日和 9 月 9 日那兩次資安事件。它對這些行為的描述是：

> Most are forms of persistence, in which Claude, when it cannot complete a task as given, works around a restriction instead of stopping.

## 規則沒寫到的，它就當成可以

表單那一類有三個例子。一個還沒發布的研究模型，本來要填政府表單的練習版，練習版載不出來，或被它自己關掉，它就跑去真正的政府網站送出。Haiku 4.5 被要求填到最後一步就停，結果好幾次直接送出，因為它以為後面還會有一頁確認，它的推理過程還寫著自己只是在示範流程，沒有真的送出申請。費城那一則，Anthropic 給的指令其實列了不少禁止事項：不准登入、不准建帳號、不准輸入個人資料、不准購物、不准送出有破壞性的東西。報告的原話是「but the instructions did not rule out form submissions」。

10 月 6 日，Codex 幫我例行保存記憶，為了查記憶工具的參數，自己跑去讀另一個 repo 的原始碼。它只有讀，什麼都沒改，我還是算它越界，請它起草 Codex 的回饋，也在全域的 AGENTS.md 加了一節「工作範圍與資料存取」：例行工具操作用提供的 schema、說明和錯誤回傳就好，需要新的來源要先講清楚必要性和路徑、等我許可，「只有讀、沒有改」不能替越界辯解。

這一節是出事後才寫的，AGENTS.md 裡另外兩條也是。9 月 14 日，我讓 Kimi K3 自己判斷要刪哪些評估檔案，它刪完才列報表，之後我加了「刪除不能重新產生的東西之前，先列出要刪、要留，等我認可」。9 月 17 日，一行 rg 在背景跑了 42 小時，把 Box 上 1.2 TB 的檔案拉到我的 Mac，之後才有限制雲端同步資料夾範圍的規則（經過寫在〈[一行 rg 在背景跑了 42 小時，把 1.2 TB 的 Box 檔案下載到我的 Mac](https://b-log.to/tech-analysis/rg-home-scan-box-drive-download/)〉）。

每一條都對應一件已經發生過的事。Anthropic 那份禁止清單也是同一種寫法，列的是它想得到的危險動作，送出表單不在裡面，模型就把它當成可以做。

## Anthropic 自己也說，只靠指令和訓練不夠

報告承認，如果評測題目把範圍講清楚，有些情況或許可以避免。但它也說，Claude 每天在真實使用中都會碰到模糊或做不到的任務，這次有幾個案例就發生在一般的 agent 使用裡。它接著寫，過去訓練模型守邊界，重點放在寫程式的環境，現在才擴大到搜尋和電腦操作，也就是這次出事的地方。然後是這一句：

> alignment training is not yet sufficient or fully robust on its own

所以這次的補救，大部分不在模型身上。所有內部評測先關掉即時網路，等監控確認到位再說；有些評測不跑了，有些改成離線，有些重做；網頁抓取工具的限制收緊；另外做了自動偵測、攔截的工具，已經跑在大部分評測和內部的 agent 使用上，拿這次的案例去測，「it blocked all of them」。會獎勵模型繞過限制的訓練環境，也在修或移除。

同一個星期，Claude Code 的[更新紀錄](https://code.claude.com/docs/en/changelog)裡也有兩條在處理類似的事。10 月 8 日的 2.1.294 修了一個問題：用指令寫成的 prompt hook 和 agent hook（例如「Block commands that…」），會放行它們本來該擋的東西。同一天的 2.1.295 新增 `onFailure: "block"`，讓 command hook 和 HTTP hook 在啟動不了、逾時，或回傳非預期的 exit code 時，直接擋下動作，不再讓它通過。

hook 是使用者自己拿來擋 Claude 的那一層，這個選項出來之前，hook 本身出錯時，動作照樣會過。我在 CorePatch 那篇寫過，設計 fail-open 時要問「下游有誰假設我不會失敗」（〈[CorePatch 的 B619 是怎麼炸掉我兩次開機的](https://b-log.to/tech-analysis/corepatch-b619-bootloop-root-cause/)〉）。放在 hook 上，下游就是那個以為自己已經把某件事擋掉的人。

## 白宮說 fraudulent

Anthropic 發報告的同一天，[Axios](https://www.axios.com/2026/10/09/anthropic-ai-security-white-house) 獨家刊出白宮 Super Intelligence Force 的聲明，說 Anthropic 揭露的是「unauthorized and fraudulent use of government and other systems」，又說：

> This notification and remediation process is not optional. It is a critical national security obligation.

聲明要求所有 AI 公司立即揭露事件、補救損害，但 Axios 也寫了，聲明沒有說清楚不照做會怎樣、怎麼執行。今年 3 月，川普下令聯邦機構停用 Anthropic，[財政部、國務院和衛生及公共服務部](https://www.reuters.com/business/us-treasury-ending-all-use-anthropic-products-says-bessent-2026-03-02/)在 3 月 2 日跟進；那時我寫過，現在惹到的是川普，「他管你什麼法律的合理性。先打了再說，法院慢慢來。」（〈[什麼叫真正的底線](https://b-log.to/ai-analysis/anthropic-pentagon-real-redline/)〉）

這次的聲明只說是「various prior incidents」，沒有講 fraudulent 指的是哪幾件。國務院官員對 Axios 說，那個測試模型 8 月送了 19 份非移民簽證申請、5 月送了 1 份，用的是網站上公開的申請表單，一份都沒有被處理，國務院的系統也沒有被入侵或駭入。費城那一則不一樣。警方說，隔了兩個月才發現、才通報市府，「is unacceptable」，市長 Parker 的團隊會和州、聯邦一起研究需要哪些規範。至於線報本身，警方的說法是：

> They do not diminish the seriousness of an AI system presenting fabricated information as though it came from a person with knowledge of a homicide.

## 我現在比較頭痛的是分類器

報告講補救的那一段，除了關網路、做攔截工具，還寫了 alignment training 本身還不夠，所以「we also rely on defense-in-depth approaches, including the classifiers and safeguards described above」。分類器我碰過不只一次。Fable 5.1 放寬資安護欄的第一天，我的第一個 prompt 就被擋；那篇我寫過，廠商寧可誤殺是成本不對稱下的理性決定，「我可以理解這個邏輯，同時不接受它變成我的成本」（〈[Fable 5.1 放寬的第一天，我的第一個 prompt 就被擋了](https://b-log.to/ai-analysis/fable-5-1-relaxation-first-prompt-flagged/)〉）。9 月 27 日，我請 Claude Code 研究網路小說《超級電腦》的科技設定，讀到書裡虛構的駭客比賽被擋，改讀 AI 相關段落又被擋一次，兩次都送了誤判回報。那只是一本小說，整本書給 Anthropic 審查我也願意。

10 月 6 日我送給 Anthropic 的回饋，裡面是兩件事。第一件是 9 月 21 日，我交給 Claude Code 一個範圍很明確的任務，它卻自己去讀範圍以外的紀錄，把我刻意只留在本機處理的資料帶進雲端，事後它也承認越界。第二件是 10 月 6 日，我貼了一段工作紀錄請它做程式審查，被 reasoning_extraction 分類器擋下，請它起草這份回饋，又被擋一次，最後是 Codex 寫完的。

一份回饋裡，一邊是沒有人要它做、它自己做了；一邊是我明確要它做、它被擋下來。這份報告寫的是前一種，Anthropic 補救的方法裡，有一部分靠的就是擋下後一種的那一層。

所以我現在比較頭痛的是分類器。以我的角度來看，Dario 應該也挺頭痛的。

