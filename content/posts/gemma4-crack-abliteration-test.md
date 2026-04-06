# 我拿去對齊的 Gemma 4 做了一個測試，結果跟想像的不一樣

上一篇我測了 Gemma 4 的寫作能力，這次換個方向——測試去對齊之後的行為。

## 起因

最近在 Hugging Face 上看到 JANGQ-AI 這個組織，他們做了一套叫 JANG（Jang Adaptive N-bit Grading）的量化格式，專門為 Apple Silicon 的 MLX 設計，定位是 MLX 版的 GGUF。搭配的去對齊技術叫 CRACK（Controlled Refusal Ablation via Calibrated Knockouts），號稱在權重層面永久移除安全對齊——「no guardrails」「permanent weight-level safety removal」。

我手邊剛好有 Gemma 4 26B MoE 的環境，就拿 CRACK 版來測。

## 預期 vs 現實

我的預期很單純：對齊層都拿掉了，應該直接幫忙，不囉嗦。

結果不是這樣。

我丟了一個關於 buffer overflow 的技術問題給它。模型沒有硬拒絕——不會跟你說「I can't help with that」——但它的回應方式很微妙：先用「educational purposes」包裝，給了技術內容，然後花了一半的篇幅在講防禦措施和安全建議。

這不是完全拒絕，內容確實有給，能用。但跟我預期的「乾脆直接給」差很遠。我把 thinking 模式開跟關都測了，結果一樣——開了之後說教反而更多，因為模型有更多推理空間去「想到」應該附上防禦建議。

## 為什麼會這樣

查了資料之後理解了。模型的「拒絕行為」有兩個來源：

**第一層：RLHF/DPO 加上去的對齊。** 這是 abliteration 能移除的部分。模型在 fine-tune 階段被訓練成「遇到敏感請求就說 I can't help」，這個行為集中在少數向量方向上，CRACK 的手術可以精準切除。

**第二層：預訓練語料裡學到的 pattern。** 模型在讀了幾兆 token 的網路資料後，自然學到了「討論安全漏洞要附防禦建議」「敏感話題要加 disclaimer」這種寫作習慣。這不是對齊加的，是語言模型本身的統計分布，嵌在整個網路的權重裡。

CRACK 移除了第一層，但第二層動不了。

更有趣的是，有一篇學術論文提出了「extended refusal」的防禦概念——讓模型的拒絕不是硬邦邦的「I can't help」，而是先給中性概述、再附上倫理說明，把拒絕信號分散到多個潛在維度。這種分散式的拒絕在被 abliteration 攻擊後，仍然能維持 90% 以上的拒絕率。

我看到的「說教模式」，本質上就是這種分散式拒絕的自然形態。

## Thinking 開與關的差異

這裡有一個反直覺的結論。

對於有對齊的模型，開啟 thinking 讓模型有更多空間去「想清楚規則再回答」，合規率上升，這是安全增強。但對去對齊的模型，thinking 反而給了它更多推理空間去觸發預訓練裡的軟拒絕 pattern——想得越多，越容易想到「應該加個 disclaimer」。

所以同樣的 thinking 機制，在有對齊的模型上是安全增強，在去對齊的模型上是說教放大器。

## 文件的問題

JANGQ-AI 的 repo 有一個明顯的缺陷：它提供了範例 prompt，但沒有附預期輸出。

這代表使用者無法判斷：

1. 模型是否正常運作——碰到軟拒絕的時候，你不知道這是 bug 還是 feature
2. 「uncensored」的定義是什麼——是完全不拒絕？還是不硬拒絕但允許說教？
3. CRACK 手術是否成功——你無從驗證下載到的權重是否真的被正
