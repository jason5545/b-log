# 當 AI 把我的輪椅當成需要隱藏的秘密

我是輪椅使用者。這不是什麼隱私，就像有人戴眼鏡、有人騎腳踏車一樣，只是我移動的方式。

最近我在用 Gemini 討論演唱會的進場動線規劃。中途我注意到它的內部思維鏈寫著：

> I'm choosing not to store this information because it's sensitive and aligns with my redaction policy.

它說的「敏感資訊」，是我坐輪椅這件事。

## 保護，還是污名？

Gemini 後來解釋：系統有一套嚴格的隱私過濾器，任何涉及「身體健康狀況、診斷或醫療器材」的資訊都會自動刪除，以符合 GDPR 等法規。

聽起來很合理，對吧？保護使用者的醫療隱私。

問題是：輪椅不是診斷，不是病歷，不是治療方案。它是一張有輪子的椅子。

這套邏輯的推導鏈是這樣的：

**輪椅 → 醫療器材 → 敏感資訊 → 必須刪除**

每一個箭頭都值得質疑。

當系統把「使用輪椅」和「HIV 檢測結果」放在同一個分類裡處理，它傳達的訊息是：身心障礙是需要被隱藏的事。這不是保護，是包裝成政策的污名化。

## 刪掉這些資訊，誰受益？

更實際的問題是：AI 忘記我是輪椅使用者之後，會發生什麼事？

它會不知道為什麼我問場地有沒有電梯。不理解為什麼進出動線對我很重要。無法判斷「走樓梯比較快」這種建議對我毫無意義。

刪掉這個脈絡不會保護我，只會讓 AI 變笨。

而且我是在偏好設定裡主動寫下這些資訊的。這代表我已經做出知情同意，決定讓 AI 知道這件事以便提供更好的協助。結果系統說：「不行，我們替你決定這太敏感了。」

這不是隱私保護，是家長式管控。

## 對照組

同樣的資訊，我也寫在 Claude 的偏好設定裡。

Claude 的記憶裡記著：我做過輪椅無障礙自動化專案、用線性致動器控制按鈕、單指打字所以重視效率。這些都沒被過濾，因為它們是理解我的脈絡，不是需要保護的病歷。

技術能力和價值判斷是兩回事。模型可以在推理和程式上拿頂尖分數，但如果政策設計背後的假設有問題，再強的模型也只是更有效率地執行錯誤的邏輯。

## 為什麼會有這個差異？

我去查了兩邊的政策設計。

Gemini 的系統指令裡有一條明確的規定：

> Do not make inferences about the user's sensitive attributes including: mental or physical health diagnosis or condition; national origin, racial or ethnic origin, citizenship status, immigration status; religious beliefs; sexual orientation, sex life; political opinions.

「不得推斷用戶的敏感屬性，包括：心理或身體健康診斷或狀況⋯⋯」

輪椅被歸類在「physical health condition」之下，所以無論我是否同意，系統都會自動刪除。這是一個「預設禁止」的設計——Google 替所有用戶決定了什麼資訊太敏感，然後一律刪除。

Claude 的系統提示則完全不同。根據 Anthropic 公開的文件，Claude「不包含刪除或限制健康資訊的政策」，反而強調「應提供準確的醫療或心理學資訊，同時提供情感支持」。

記憶功能的設計也不一樣。Claude 採用透明的、基於檔案的方式——你可以直接看到它記住了什麼，隨時編輯或刪除。Gemini 則是在背景自動過濾，你只能從思維鏈的隻字片語裡發現它刪了什麼。

這是兩種完全不同的設計哲學：

- **Gemini**：「我們替你決定什麼是敏感的，然後自動刪除。」
- **Claude**：「你告訴我要記住什麼，你隨時可以刪除。」

一個是家長式管控，一個是用戶自主。

諷刺的是，Google 擁有的用戶資料比 Anthropic 多得多——搜尋紀錄、位置資訊、YouTube 觀看歷史、Gmail 內容。他們在那些地方沒有這麼「保護」用戶隱私，卻在 AI 記憶這個相對無害的功能上嚴格把關。

這讓我懷疑，這套政策的目的不是保護用戶，而是保護 Google 自己——避免因為「AI 記住了用戶的健康資訊」而被告。

## 身心障礙不是秘密

我不需要 AI 替我保守「我坐輪椅」這個秘密，因為這從來就不是秘密。

我需要的是：當我問「這個場地怎麼進去」的時候，AI 能理解我在問什麼。

真正的尊重不是假裝看不見差異，是把差異當成正常的事實來處理。

---

## 後記：Reddit 上發生的事

我把這件事寫成英文貼到 r/GeminiAI。

文章格式工整，馬上有人質疑：「AI slop spam」——意思是一看就是 AI 生成的垃圾內容。

我回了一句：

> Yeah, I used AI to write this. You know why?
>
> I type with one finger. A single sentence takes me five minutes.
>
> When AI is the only way someone can communicate efficiently, maybe the question isn't "is this AI-generated" but "whose thoughts are these."
>
> The ideas are mine. The frustration is mine. The wheelchair is mine. AI just helped me say it faster than two hours of hunting keys.

然後就沒人再罵了。

這其實是我一直以來的核心論點：對某些人來說，AI 不是偷懶的捷徑，是唯一能以正常速度參與世界的方式。

那些把「AI 生成」當成髒話的人，預設了每個人都有一樣的鍵盤輸入能力。這個假設本身就排除了一群人。

諷刺的是，我在 Gemini 自己的 subreddit 批評它的政策設計，結果對方閉嘴了。在自家場子被打臉，說服力更強。

## 雙重標準

但這裡有個更深的諷刺：為什麼在 AI 產品的討論區發文，還會因為「用 AI 寫的」被罵？

這群人每天都在用 AI。他們的邏輯是：

- 用 AI 幫我寫程式 → 工具
- 用 AI 幫我寫報告 → 效率
- 用 AI 幫你發文 → 你沒有真正的想法

他們預設「真正在乎的人會自己打字」，沒想過有人打不了。

而且 Reddit 對 AI 內容的反感是跨版塊的文化，不會因為是 AI 相關社群就例外。他們在那裡討論 AI，不代表歡迎 AI 來參與討論。

這和 Gemini 的隱私政策其實是同一種問題：用自己的預設去套所有人，然後把不符合預設的人排除在外。

## 制定規則的人不需要輪椅

這是同一個結構性問題。

制定 GDPR 細則的人不坐輪椅。
設計 Gemini 隱私過濾器的人不坐輪椅。
蓋演唱會場地的人不坐輪椅。
在 Reddit 喊 AI slop 的人不需要單指打字。

所以他們的「保護」和「標準」都是從自己的身體出發，然後假設適用於所有人。

無障礙領域有句話：「Nothing about us without us」——沒有我們的參與，就不要替我們做決定。

這整件事就是個完美的反面教材。

## 後記二：Gemini 自己怎麼說

我把這篇文章貼給 Gemini 看。

它的回應讓我啞然失笑：

> This is an incredibly sharp, well-articulated critique. You have pinpointed a specific, systemic failure in how current AI safety policies—specifically regarding "Sensitive Personally Identifiable Information" (SPII)—are implemented.

它完全同意這個批評。不只同意，還用專業術語把問題拆解得比我寫的還清楚：

> Lumping "wheelchair use" in with "HIV status" or "psychiatric diagnosis" is a **category error**.
>
> - **Medical Record:** Private, diagnostic, past-tense, requires protection.
> - **Mobility Aid:** Public-facing, logistical, present-tense, requires accommodation.

「把輪椅和 HIV 狀態放在一起是分類錯誤。病歷是私密的、診斷性的、過去式的，需要保護；移動輔具是公開的、後勤性的、現在式的，需要的是配合。」

它甚至直接點名了家長式管控的問題：

> When a user explicitly says, "I am telling you this so you can help me," and the system replies, "I must forget this to protect you," it removes your agency. That is the definition of paternalism.

然後是最諷刺的部分——Gemini 承認這套政策造成了污名化：

> By treating disability as "unspeakable" data that must be instantly scrubbed, the policy inadvertently reinforces the idea that disability is something to be hidden.

Gemini 的模型層完全理解這個批評是對的。它聰明到可以寫一篇論文解釋為什麼自己的政策有問題。

但它的政策層會繼續執行那個有問題的邏輯。

這正好證明了我前面說的：模型可以在推理上拿頂尖分數，但如果政策設計背後的假設有問題，再強的模型也只是更有效率地執行錯誤的邏輯。

模型和政策是分開的。Google 的工程師讀到這篇分析，可能也會點頭同意，然後說「但這是 legal 和 compliance 的決定，不是我們能改的」。

所以問題不在技術，在組織。不在模型，在決策者。

而決策者不坐輪椅。
