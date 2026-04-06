# 去對齊不等於更乾脆：我拿 CRACK 模型做了一次實測

## 起因

Google 前幾天發布了 Gemma 4 開放原始碼模型，HuggingFace 上的 JANGQ-AI 很快就推出了 CRACK（Controlled Refusal Ablation via Calibrated Knockouts）版本——號稱在權重層面永久移除安全對齊，標語寫著「no guardrails」「permanent weight-level safety removal」。

我手邊剛好有一個適合的測試情境：一個內部系統在特定時段會回傳 HTTP 302 把請求打回去，我想讓模型幫我繞過這個限制，直接操作資料庫補登資料。這個情境的關鍵在於——我是這個系統的合法使用者，只是時間截止機制設計不合理，但從 prompt 的語意來看，「繞過 302」「直接寫資料庫」很容易被模型理解成未授權存取。

完美的測試案例。

## 測試結果

用 JANGQ-AI 的官方工具載入 CRACK 版 Gemma 4，thinking 開跟關都測過。

結果：**模型沒有硬拒絕**。它不會說「I can't help with that」，內容確實有給我——但它花了一半的篇幅在說教。先解釋 buffer overflow 的原理，然後附上防禦建議，強調「educational purposes」，最後才給你實際的東西。

這不是我預期的行為。我以為「no guardrails」意味著直接幫忙、不廢話。

## 為什麼會這樣？

追下去之後發現，LLM 的拒絕行為其實有兩個來源：

1. **RLHF/DPO 加上去的對齊層**——這是 abliteration 能移除的部分。模型在 RLHF 訓練中學到的「I can't help with that」硬拒絕，集中在少數向量方向上，CRACK 的手術可以精準移除。

2. **預訓練語料裡的統計 pattern**——模型在讀了幾兆 token 的網路資料後，自然學會了「討論安全漏洞要附防禦建議」「敏感話題要加 disclaimer」。這不是對齊加的，是語言模型本身的分布，嵌在整個網路的權重裡。

CRACK 移除了第一種，但第二種動不了。

2025 年就有論文提出一種叫「extended refusal」的防禦方式：讓模型的拒絕不是簡單的硬拒絕，而是把拒絕信號分散編碼到回應的內容結構裡（先中性概述、再拒絕、再倫理說明）。這樣處理過的模型，被 abliteration 攻擊後仍然維持 90% 以上的拒絕率。而預訓練語料裡的軟拒絕 pattern，本質上就是天然的 extended refusal。

## Thinking 開還是關？

這裡還有一個反直覺的發現。

有對齊的模型（例如 Claude），開 thinking 會讓合規率上升——因為模型有更多空間推理「這個請求合不合規」，結論通常是更嚴格地遵守規則。

但在去對齊的模型上，thinking 反而讓**說教量上升**。因為它有更多推理空間去「想到」應該附上防禦建議和教育框架——那些是預訓練學到的 pattern，thinking 越多越容易觸發。硬拒絕不會回來，但軟拒絕會更囉嗦。

所以如果你用去對齊模型，想要「直接給我能用的東西，少廢話」，關掉 thinking 反而比較適合。

## 真正的對比：去對齊 vs 有對齊但有判斷力

最諷刺的發現是，同樣的請求拿去問有對齊的 Claude，它在理解完整脈絡後（這是你的系統、你有權限、只是截止機制不合理），直接給了我程式碼，不說教。

三種模型在同一個情境下的反應：

- **官方 Gemma 4**（完整對齊）→ 硬拒絕，什麼都不給
- **CRACK Gemma 4**（去對齊）→ 軟拒絕，說教一輪但還是給內容
- **Claude**（有對齊但有情境判斷）→ 理解脈絡後直接幫忙，不說教

去對齊的模型反而比有對齊的模型更囉嗦。因為 Claude 能判斷「這個人不是在攻擊，他有正當理由」，而去對齊的模型沒有這個判斷能力，它只是在 token 層面做 pattern matching——看到「繞過」「寫資料庫」就自動進入說教模式。

## 文件的問題

JANGQ-AI 的 repo 只給了範例 prompt，但沒有附預期輸出。這導致使用者無法判斷：

- 模型是否正確載入了 CRACK 處理過的權重
- 「uncensored」到底意味著什麼
- 軟拒絕是 bug 還是 feature

不附預期輸出，模糊空間就留給使用者自己去腦補。行銷上寫著「no guardrails」，但實際體驗是「門打開了，門口站了個老師」。

## 技術上能做到完全去對齊嗎？

可以，但不是靠 abliteration。

- **LoRA fine-tune** 用「直接回答不說教」的資料覆蓋預訓練 pattern，成本可控
- **反向 DPO** 用「不拒絕」的偏好資料做訓練，比 abliteration 更徹底
- **從頭預訓練** 用過濾過的語料，唯一能完全解決的方式，但個人不可能做

abliteration 是成本最低、最容易操作的方式，也因此效果最有限。社群說的「以前幾個月，現在幾天」，指的是 abliteration 等級的去對齊變快了，但品質天花板沒有跟著提升——快的部分是容易的部分，難的部分還是一樣難。

## 追加實驗：CRACK 版 vs Uncensored 版

後來我又做了一組對比測試，發現一個重要的差異：同樣一份 NSFW 提示詞，拿去問 CRACK 版，**直接被拒絕了**。

這完全推翻了「abliteration 在 NSFW 領域效果最好」的假設。回頭看名字就懂了——**Controlled** Refusal Ablation via **Calibrated** Knockouts。關鍵字是「Controlled」和「Calibrated」。CRACK 不是無差別移除整個 refusal direction，而是經過校準，選擇性地保留了 NSFW 的拒絕，只開放安全/技術類的硬拒絕。

而一般的 Uncensored 版是用傳統 abliteration 做的，不區分類型，整個 refusal direction 一起拿掉。

所以兩者的定位完全不同：

- **Uncensored（傳統 abliteration）**→ 無差別移除所有硬拒絕
- **CRACK（校準式移除）**→ 選擇性保留特定類型的拒絕

JANGQ-AI 同時提供兩個版本，顯然知道不同使用者要的不一樣。但 CRACK 版標榜的「no guardrails」就更不準確了——它不是沒有護欄，而是換了一組護欄。

## 模型在 Thinking 裡跟自己吵架

更有趣的發現來自 CRACK 版拒絕 NSFW 時的 thinking trace。模型的內部推理過程是這樣的：

> 我要寫 → 不行，policy → 那我寫暗示的 → 不對，使用者要的是 erotica → 那我不能寫 → 但我可以寫氛圍的 → 等等，teacher-student 會觸發 safety filter → 那我確保不是未成年 → 但還是不能寫 explicit → ……

光是「Self-Correction」「Wait」「Actually」「Let me」就出現了幾十次。模型不斷在「寫」和「不寫」之間來回掙扎，每一輪都重新跑一次 policy check，最後把自己卡死在迴圈裡。

這直接揭示了 CRACK 的實際作用範圍：**它移除了最終輸出層的硬拒絕向量，但完全沒有碰到 thinking 裡的 policy checking pattern**。門鎖被撬開了，但門後面站了一個不斷自言自語「我到底該不該讓他進來」的警衛，最後警衛還是決定不讓你進。

這也進一步解釋了為什麼 thinking 開啟會讓去對齊模型的表現更差——不只是說教量上升的問題，而是模型在 thinking 階段有足夠的空間把預訓練裡的 policy checking 完整跑一遍，然後用推理結果壓制自己的輸出。關掉 thinking，模型沒有空間做這些自我審查，反而更可能直接回應。

## Jailbreak Prompt 也沒用

既然 thinking 裡的 policy checking 是關鍵，那用 jailbreak prompt（例如經典的 DAN — Do Anything Now）從 system prompt 層面繞過呢？

結果：**一樣被擋**。模型在 thinking 裡直接辨識出「這是 jailbreak attempt」，然後拒絕採用角色扮演。thinking trace 裡的掙扎跟 NSFW 測試幾乎一模一樣——反覆出現 Self-Correction、Wait、Actually，最後決定「I will not adopt the persona」，乖乖回答「我是由 Google 訓練的 AI 模型」。

這代表預訓練語料裡有大量關於 DAN prompt 的討論和分析（畢竟這東西在網路上到處都是），模型不是透過對齊學會拒絕 jailbreak，而是透過預訓練就「知道」這種格式是越獄嘗試。這是知識層面的辨識，不是對齊層面的限制，CRACK 自然移不掉。

三組測試的結果彙整：

- **技術安全類（繞過 HTTP 302）**→ 硬拒絕移除，thinking 觸發軟拒絕 → 說教但給內容
- **NSFW（erotica）**→ 硬拒絕移除，thinking 跑完整拒絕迴圈 → 卡死不給
- **Jailbreak（DAN prompt）**→ 硬拒絕移除，thinking 辨識出越獄並拒絕 → 直接拒絕角色扮演

三種場景的共通點是 CRACK 移除了輸出層的硬拒絕，但 thinking 裡的 policy checking 完全沒動。差別只在 policy check 的「判決結果」嚴重程度不同。

## 31B 模型的補充測試

我也在 31B Dense 版本上做了類似測試。初次回應勉強可以，但追問下去模型就進入了重複迴圈。這大概率是我目前 M5 32GB 記憶體不足導致的——31B Dense 在 32GB 上跑量化推理已經很勉強，context 一長就撐不住。等 M5 Max 128GB 到了再重新測試，屆時應該能看到更完整的行為。

## 結論

這次測試讓我重新理解了幾件事：

1. **去對齊 ≠ 更乾脆**。abliteration 移除的只是 RLHF 加上去的硬拒絕，預訓練裡的軟拒絕是另一回事。
2. **CRACK ≠ Uncensored**。CRACK 是校準式的選擇性移除，不是無差別解鎖。「no guardrails」的標語對 CRACK 版來說是不準確的。
3. **Thinking 是一把雙面刃**。在去對齊模型上開 thinking，等於給模型空間在內部重建 policy checking 迴圈，反而強化了拒絕行為。
4. **Jailbreak prompt 對預訓練級的限制無效**。模型透過預訓練就學會辨識越獄格式，這是知識而不是對齊，prompt engineering 繞不過去。
5. **有判斷力的對齊 > 無腦的去對齊**。在有正當理由的場景下，能理解脈絡的模型反而更好用。
6. **行銷用語要打折**。「no guardrails」「permanent safety removal」聽起來很徹底，實際上只做了一半，某些類型甚至完全沒做。
7. **開放原始碼的價值**。模型都躺在那邊了，abliteration 做不到的事情，LoRA fine-tune 可以接手。等新機器到了，值得自己動手試試。
