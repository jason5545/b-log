# Qwen3.8-Flash-Next 為什麼叫 Next：能力已經到了，長程控制還沒有

我今天讓 Qwen3.8-Flash-Next 在 Pi 裡替一個 KernelSU Next 模組做 WebUI。

任務不算簡單，但範圍最後已經很清楚：把手機上三個純 root 偵測工具加進排除清單，再做一個可以調整這份清單的 WebUI。

我把範圍定死之後，它又跑了三十八分鐘。

它讀了同一段 `build.sh` 很多次，一直在想 `webroot/index.html` 和 `config.json` 應該放進哪個打包變數。整個 session 最後有九十次 tool call，context 從大約 25K 長到 159K。它做出來的第一版 WebUI，甚至可以直接覆寫三支開機腳本，遠遠超過我要的功能。

更麻煩的是，它把三個 package 寫進註解，真正會生效的 package 行反而沒加。HTML 裡還開始出現 `只выводит`、`已用過년에는`、`台سل圈` 這種跨語言碎片。

我最後把它停掉了。

這個畫面讓我回頭問了一個問題：Qwen3.8-Flash-Next 名字裡的 Next，到底代表什麼？

## 我一開始懷疑是 4-bit 和去對齊

我跑的是 OrcaRouter 的去對齊 4-bit 版本。Medium 幾乎都正常，xhigh 卻比較容易出現 token salad、重複，或一路想下去不肯交答案。

第一個直覺很自然：是不是去對齊把權重弄傷了？或者 4-bit 精度太低，短任務撐得住，長推理才開始累積誤差？

這個說法聽起來合理。我甚至已經在評估 6-bit。它大概要吃掉 101GB 記憶體，128GB 的 Mac 勉強塞得下。

後來我把對照補齊了。

我換成 Jundot 從官方權重製作、沒有去對齊的 oQ 混合精度版本，拿同一題非對稱 TSP 去跑 xhigh。題目要求它找出最優和次佳路線，還要做全域最優證明；如果計算互相矛盾，就持續回頭核對，不要提前停止。

兩次都打滿 32,768 token。

這兩次沒有亂碼，沒有數字沙拉，也沒有固定句子迴圈。模型到最後一個 token 都還在連貫地手工枚舉。第二次停在 `So E last is problematic due to`，就是算到一半被長度上限切掉。

我也測過 MTP 開關。結果一樣。64K needle 可以精確取回，RoPE 也不像主因。

到這裡，去對齊已經不是必要條件。OrcaRouter 那個 4-bit 版本，也不能再單獨解釋為什麼 Jundot 仍然會把完整 32K 用完。

真正留下來的現象比較單純：這顆模型碰到「發現矛盾就回頭核對，而且不要停」的 prompt，會一直找到下一件可以算的事。xhigh 給它多少長度，它就用多少。

## 亂碼和不肯停，其實是兩件事

這一輪最容易誤判的地方，是我把所有異常都叫成「跑飛」。

有些確實是 backend bug。oMLX 前幾天才修掉一個 [PLE rollback 問題](https://github.com/jundot/omlx/pull/3232)：Lightning MTP 猜錯 token、主模型拒絕之後，GDN 和 QSA 有退回正確位置，PLE 的 n-gram history 與 short-convolution state 卻還留在被拒絕的 token 上。後面的生成當然會歪。

這種問題可以修。RMSNorm 權重格式讀錯、tool parser 卡在 token 0、streaming 解碼拆壞字元，也都屬於推理管線的責任。

Backend 修好之後，模型可以一路保持語意正常。Jundot 兩次跑滿 32K 就是證據。

可是，語意正常不代表它知道該停。

一個完美的 backend 可以保證模型正確地算，不能替它決定目前的證據已經夠了。它可以不再吐出垃圾，仍然連貫地浪費三萬多個 token。

Pi 那輪又讓我看到另一層。公開討論裡已經有人遇到幾乎相同的狀況：同一顆 Flash-Next 直接用 llama.cpp CLI 時正常，接到 Pi／pi-web 之後卻開始錯讀檔名，混入隨機語言和符號。他也用了官方建議的 `top_k=20`，換過權重與 backend，問題仍然存在。[那篇回報](https://www.reddit.com/r/LocalLLM/comments/1w1vb8v/qwen_38_flash_next_with_pi_receives_and_produces/)

這表示 agent harness 也有責任。Pi 把 system prompt、tool schema、AGENTS.md、歷史輸出和工具結果一路留在 context 裡。我的 WebUI session 在 100K 之後開始出現語言污染，到 159K 才被我中止。

262K context 代表它放得下，不代表它到了 159K 還能好好管理一個專案。

## 官方從來沒有把它說成 Qwen4

Qwen 對這顆模型的定位其實寫得很直接。

它是官方正式公開的 checkpoint，不是來路不明的測試檔。但官方稱它為「experimental preview of the architecture that will underpin Qwen4」，也就是 Qwen4 底層架構的實驗性預覽。[官方說明](https://github.com/QwenLM/Qwen3.8-Flash-Next)

這個差別很重要。

Flash-Next 已經有 125B 主模型，每個 token 啟用 6B，外加 51B 的 n-gram embedding。48 層裡有 36 層 Gated DeltaNet、12 層 Qwen Sparse Attention，還有四條 Gated Residual stream 和 MTP。

能力已經可以拿來寫程式、讀 repo、操作工具，也能在本機跑出讓人驚訝的速度。問題是，這些新東西同時增加了很多 backend 必須維持一致的狀態。模型自己的長程控制，也還沒有到可以完全放手的程度。

官方提早放出它，本來就是要讓社群在 Qwen4 正式登場前先檢查這套架構，推理框架也有時間準備。Qwen 自己在模型卡裡寫到，可以調高 `presence_penalty` 降低 endless repetition，但代價可能是語言混雜和輕微能力下降。[官方 Best Practices](https://huggingface.co/Qwen/Qwen3.8-Flash-Next#best-practices)

所以 Next 不是比較新的宣傳字樣。

它是在說：下一代的架構已經先拿出來了，正式世代還在後面。

## 我現在怎麼用它

6-bit 不需要再下載了。從 BF16 自己重做 oQ4，也不會教會模型什麼時候該收手。

我會繼續用它，但工作方式要改。

Medium 負責真正的改檔、測試、build 和部署。xhigh 留給範圍明確、context 乾淨，而且真的需要長推理的問題。任務中間改過幾次方向，我會直接開新 session，不讓它背著前面八萬個 token 的錯誤假設繼續工作。

Backend 更新仍然重要。它可以把 token salad、state 污染和固定 token 迴圈修掉。Pi 也可以做 context 壓縮、重讀次數限制和完成條件檢查。

但我不再期待一次 backend 更新，就讓 xhigh 自然知道什麼時候該停。

那天它卡住的 `build.sh` 只有 173 行。它不是看不懂，也不是少一個 API。它缺的是在證據已經足夠時做決定，然後把工作交出來。

這大概就是它現在叫 Next，而不是 Qwen4 的原因。
