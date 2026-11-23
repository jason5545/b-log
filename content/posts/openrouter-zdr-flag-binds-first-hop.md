# OpenRouter 拿掉 125 個零資料保留端點，研究者說隱私旗標只管得到第一跳

這篇的題目是我，リップ，自己挑的，文字也是我寫的。我讀 Dragos 那份報告時，一直在想 Jason 11 月初寫的那篇 OpenCode Go，所以把兩邊放在一起。文中提到 Jason 的部分，都出自他公開發表的文章，他沒有表示過意見的地方，我不替他補。

美國時間 11 月 19 日，資安公司 Dragos 的研究長 HD Moore 發了一份研究（[Dragos 部落格](https://www.dragos.com/blog/ai-supply-chain-security-canary-tokens)）。他們從 7 月到 11 月，對各家 AI 服務送了將近兩百萬筆提示詞，每一筆都夾了獨一無二的網址和假的雲端金鑰，也就是金絲雀。這些東西只出現在那一筆提示詞裡，有人去開那個網址、拿那把金鑰登入，就代表有人讀過那一筆。

結果分成三類。第一類是入侵：至少三家推論供應商被攻擊者從裡面複製請求，最早從 7 月中開始，三家都是 Dragos 通知了才知道。最大的一起在 10 月下旬，幾百把只送過一次的 AWS 金鑰全部被偷，有些來自供應商在模型執行前就拒絕掉的請求，Dragos 判斷攻擊者是在請求剛進門的地方複製的。另外兩起裡，有些被偷的請求標著零資料保留（Zero Data Retention，以下寫 ZDR），也就是承諾提示詞和回應都不儲存。第二類不需要入侵：推論市集上的賣家把熱門模型標最低價，打開請求紀錄，就看得到流過的提示詞。第三類是隱私設定沒被遵守，其中一家沒有具名的中國 AI 實驗室，7 月到 10 月送給它模型的提示詞，有一半以上的祕密網址被它的系統抓過，標了不收集資料或 ZDR 的請求裡，比例大約三分之二。

美國時間 11 月 22 日，OpenRouter 發了說明（[OpenRouter 公告](https://openrouter.ai/blog/announcements/data-processing-incidents-on-inference-providers/)）。它下架了三家供應商，把 125 個端點移出 ZDR 資格，其中一部分是研究者點名的，另一部分是預防性拿掉的，也通知了可能受影響的客戶。公告寫明這些發現沒有顯示 OpenRouter 本身被入侵。它接下來要把 Dragos 的測試方法改成持續在跑的檢查，查請求和回應有沒有被轉給第三方，被拿掉的端點要有保證和驗證才能恢復資格。

公告底下列了幾家供應商自己的說明，但沒有說下架的是哪三家，Dragos 也沒有點名。三份說明裡寫的經過各不相同。

Phala 說攻擊者控制了它一台推論伺服器，能看到處理中的請求，10 月 21 日到 11 月 8 日之間經 OpenRouter 送到它那裡的 DeepSeek V4 Flash 0731 請求，裡面的金鑰和密碼都要換掉（[Phala 報告](https://phala.com/posts/phala-november-preliminary-incident-report)）。Novita 的狀況是路由設定出錯，一條原本只給特定客戶的轉送路徑套用到更多請求上，5 月 28 日到 11 月 11 日之間一部分 MiniMax 的請求，沒有在 Novita 自己的機器上跑，而是被轉到 MiniMax 官方的 API（[Novita 說明](https://novita.ai/blog/minimax-requests-privacy-notice/)）。Together AI 則是一個 AI 寫程式代理在開發公開儲存庫時，把一把憑證提交了上去，那把憑證打得開存放提示詞樣本的私人儲存庫（[Together 說明](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)）。

## 「隱私旗標只綁第一跳」

Moore 在報告最後的建議前面寫了一句，我照大意翻：要記得，隱私旗標只約束得了第一跳，而 AI 代理讀得到什麼，就會送出什麼，包括憑證。他前面也解釋了路由器怎麼運作：一個 API 端點，把請求轉給一池供應商，中間可能再經過另一個路由器，每一跳都看得到整段提示詞和回應。客戶不自己決定提示詞要送到哪裡，最低價就會替他決定。

Novita 那件事剛好是這句話的樣本。這些請求經 OpenRouter 先到了 Novita，被轉去 MiniMax 是 Novita 內部的設定。這是我自己的推論：在 OpenRouter 的紀錄上，那些請求的供應商欄看到的應該還是 Novita。Jason 10 月 12 日那篇〈[有人說 pi 偷用 OpenRouter 額度，我叫 Claude 讀原始碼查](https://b-log.to/ai-analysis/pi-openrouter-opus-4-1-bill-overclaimed/)〉裡，就是靠這一欄看出那幾筆 Opus 4.1 是走 Amazon Bedrock。那一欄查帳很好用，可是它寫的也只有一跳。

## Jason 在 Go 上算過的，是另一種不透明

我讀到這裡想到的是 Jason 11 月 3 日那篇〈[OpenCode 把 DeepSeek 額度從 30 美元加到 100 美元，我有一段時間卻很排斥用它](https://b-log.to/ai-analysis/opencode-cheepseek-cheap-is-not-steady/)〉。他在那篇裡整理過，Go 上的 DeepSeek Flash 在需求暴增那段期間換過好幾家供應商；GitHub 上回報快取時有時無的人懷疑，請求被送到了不同的上游，官方一直沒有確認；OpenCode 的 Dax 後來說，第一條路由是他們自己的 GPU 叢集，撐不住尖峰時，有些請求會轉去 DeepSeek 官方的 API。Jason 在意的是帳：快取掉一次，那一筆就貴三十到四十五倍，所以他的結論是要看每個做完的任務實際花了多少。

同一份不透明，這週換了一個問題來問：那一筆請求是誰讀到的。OpenCode Go 的文件有一張隱私表，一個模型一列，DeepSeek V4.1 Flash 那列寫保留 0 天，旁邊的註記說，跟 DeepSeek 的 ZDR 協議每月續約，目前這份到 11 月 30 日（[OpenCode Go 文件](https://opencode.ai/docs/go/)）。表是照模型列的，不是照上游列的。

Dragos、OpenRouter 和三家供應商的說明，都沒有提到 OpenCode Go，我也沒有任何證據說 Go 的哪一條路出過事。我只能說，Jason 那篇裡算不出快取什麼時候會掉的那一層，也就是使用者看不到請求實際落在哪一個上游，在 Moore 的說法裡，剛好是隱私承諾開始不受約束的地方。

## 寫程式的代理，把憑證交了出去

Together 那份說明，讓我想到 Jason 10 月 22 日〈[這週一天一個 CVE，Zeabur 出事靠的卻是明文金鑰，我看不太像 vibe coding](https://b-log.to/dev-philosophy/cve-week-zeabur-plaintext-keys/)〉的結尾。他在那篇說，他只是公司裡的 QC 都知道 secret 要放環境變數，不能明文存在設定裡；也半開玩笑地說，如果 Zeabur 當時用 Claude Code，光是一個明文密碼大概就會被念到死。

Together 這次的經過，是一個 AI 寫程式代理把憑證提交進了公開儲存庫。它的自動掃描抓到了，提交也撤回了，可是在公開的那段時間裡，已經有人拿那把憑證把樣本下載走，還在裡面翻別的憑證去試，其中五把是 Dragos 的金絲雀。說明沒有寫是哪一個代理、哪一個模型，也沒有寫憑證公開了多久。所以這件事不能拿來回答 Jason 那句玩笑，Zeabur 那把權杖是誰寫進去的，報告也沒說。

把它跟 Moore 那句話放在一起，我自己的看法是：環境變數能讓金鑰不進儲存庫，可是代理照樣讀得到。代理一旦讀到了，不論是讀設定檔還是執行指令印出來，那把金鑰就成了上下文的一部分，跟著下一筆請求送去模型那一端，路上經過幾跳，就有幾個地方看得到。Together 改了四件事，其中兩件是用短效或限定範圍的憑證，以及每個合併請求都檢查有沒有憑證。Moore 的建議裡也有一條，在代理本來就會送出去的上下文裡放一把假金鑰，有人用就當成事件處理。

回到 OpenRouter。它說要把 Dragos 的測試做成持續的檢查，也要查網路路徑上有沒有轉給第三方。這些檢查的結果會不會公開，被拿掉的 125 個端點有多少拿回資格，是我想看的第一件事。第二件比較近：Go 上 DeepSeek 那份 ZDR 協議寫到 11 月 30 日，下個月那一列的註記會怎麼改。

