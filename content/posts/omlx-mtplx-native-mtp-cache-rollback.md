# 我們以為在追 MTPLX，最後發現 oMLX 只是少接了一條路

這次追 oMLX 的 Native MTP 加速，其實很像一場很長的排除法。

一開始我以為問題會在 sampling。

畢竟 MTPLX 跑同一顆 Qwen3.6 27B，可以到三十幾 tok/s；我們自己的 oMLX 跑起來卻只有二十幾。Native MTP 明明有開，acceptance 也不是完全崩掉，但速度就是沒有上來。

這種時候第一個直覺通常是：是不是 sparse path 沒吃到？是不是 top-k、top-p、residual sampling 跟 MTPLX 不一樣？是不是官方那條 external drafter 才是正解？

結果查到後面才發現，這些都不是最要命的地方。

## 先把問題講清楚

這次看的不是官方 external drafter。

官方最近確實也有 speculative decoding 的東西，但那條路比較像另外放一個 draft model。Qwen 這邊有趣的地方，是它本身就有 MTP head。也就是說，我們不是要另外找一顆小模型來猜下一個 token，而是用模型內建的 MTP head 做 native MTP。

MTPLX 做的也是這件事。

所以真正值得追的不是「要不要切去官方 external drafter」，而是：MTPLX 那套 native MTP 為什麼比我們快？

這個問題拆開來看，有兩個方向。

第一個是 draft 準不準，也就是 tokens per cycle。

第二個是每個 cycle 貴不貴，也就是 per-cycle cost。

一開始 oMLX 大概是 21 到 22 tok/s，MTPLX 同模型同條件大概 26 到 37 tok/s，視 prompt 和設定而定。表面上看，oMLX 的 sample time 很可怕，每 cycle 一大段時間都算在 sampling 裡。

所以我們先追 sampling。

## sampling.py 不是答案

第一步是把 top-k sparse path 打開。

把 sampler 從 `top_k=0` 拉到 `top_k=20`，讓 verify side 可以走 sparse distribution，不要每次都處理完整 vocab。這件事有生效，log 裡也看得到 sparse distribution 開始跑。

但速度沒有明顯提升。

接著又把 MTPLX 裡 NumPy-based `SparseDistribution`、`acceptance_probability`、`residual_sample` 這些東西搬進來，取代原本比較直覺的 Python list 版本。

結果也沒有明顯提升。

這一步其實很重要，因為它讓我們確認一件事：CPU acceptance walk 不是問題。

後來 instrumentation 拆出來，walk 只有幾毫秒，甚至是 0.02% 那種量級。也就是說，把 acceptance walk 寫得再漂亮，整體速度也不會動多少。

這時候問題就變成：那 sample time 到底在等什麼？

## `mx.eval` 看起來像兇手，但它只是結帳櫃台

後來把 target distribution 拆開看，數字很誇張。

```text
tdist = 7576.5ms
  tproc = 0.7ms
  argp  = 0.4ms
  lse   = 0.3ms
  eval  = 7565.2ms
  host  = 2.0ms
  post  = 7.5ms
```

乍看之下，很容易說：好，兇手就是 `mx.eval`。

但這句話只對一半。

在 MLX 的 lazy graph 裡，`mx.eval` 很多時候不是「這個 operation 很慢」，而是「前面欠的 GPU 工作現在一起結帳」。target sparse distribution 那邊的 `mx.eval`，其實是在等 backbone verify graph 跑完。

MTPLX 有一個 `MTPLX_LAZY_VERIFY_LOGITS` 的設計，它會把 `verify_hidden` 和 `verify_logits` 的 eval 拆開。這看起來很關鍵，但後來比對後發現，分開 eval 不會讓 backbone forward 的成本消失。

它只是把成本記在不同欄位。

這也是這次追查裡很容易走錯的地方。看到 `tdist/eval` 很大，就以為 sparse distribution 是瓶頸。其實不是。真正的 GPU backbone 成本本來就要付，只是 oMLX 把帳記在 tdist 下面。

所以我們又往回看 tokens per cycle。

## adaptive depth 一開始太保守

接著看到一個比較明顯的差異：D3 coverage。

MTPLX 幾乎每個 cycle 都會 draft 到 D3，但 oMLX 一開始 adaptive depth 從 1 開始慢慢爬。有一次 log 很誇張，花到第 85 個 cycle 才爬到 depth 3。

這就不合理了。

因為 per-depth acceptance 其實很接近：

```text
D1: oMLX 約 90%，MTPLX 約 92%
D2: oMLX 約 79%，MTPLX 約 81%
D3: oMLX 約 71%，MTPLX 約 71%
```

也就是說，模型不是不會吃 D3。只是 oMLX 太晚給它 D3。

所以我們把 adaptive policy 改成從 max depth 開始，`increase_after` 也調得更積極。這一步有明顯改善：

```text
cycles:       100 -> 92
tokens/cycle: 3.00 -> 3.26
D3 drafted:   55 -> 70
tok/s:        ~28.9 -> ~30.1
```

這個 patch 是對的。

但還是不夠。

因為 MTPLX 仍然可以跑到 37 tok/s 左右。這時候 tokens per cycle 已經比較接近了，剩下差距看起來更像 per-cycle cost。

## fixed depth=3 反而比較差

這裡也做了一個實驗：既然 D3 coverage 不夠，那乾脆固定 depth 3 呢？

結果不行。

```text
adaptive:       tokens/cycle 3.26
never-decrease: tokens/cycle 3.19
fixed depth=3:  tokens/cycle 3.09
```

原因也很直接：不是每個 cycle 都值得硬 draft 3 個。reject 之後硬塞的 D2/D3 很多都是錯的，最後 cycles 反而增加。

所以 MTPLX 快，不是因為它盲目固定 depth 3。

那剩下是什麼？

答案在 cache。

## 真正的洞：partial reject 之後的 replay

後來把 cache ops 拆開看，整個問題就亮起來了。

```text
cache = 2622ms
  full = 0.4ms / 46
  reject = 2621.7ms / 53
    rollback = 38.7ms
    replay   = 2582.8ms
```

cache 本身不是慢在 rollback restore。

慢的是 replay。

oMLX 在 partial reject 的時候，例如 D1 accepted、D2 rejected，會為了修正被 draft token 汙染的 cache state，再重跑一次 backbone，把 accepted token replay 回去。

這件事每次 reject 大概 48ms。

53 次 reject 就是 2.58 秒。

這幾乎就是 oMLX 跟 MTPLX 的差距。

這時候整個問題才真的對焦：

MTPLX 快，不是因為 sampling.py 神奇。它快，是因為 partial reject 之後不用重跑 backbone。

## 不能直接關 replay

當然，第一個實驗就是把 replay 關掉。

結果很有意思：

```text
cache:       2622ms -> 60ms
total time:  約 -10%
acceptance: 67.9% -> 56.2%
cycles:     99 -> 112
```

速度看起來有變快一點，但 acceptance 崩了。

這說明 replay 不是多餘的保守操作。它是在維持 GDN/SSM state 正確。你把它拿掉，下一輪 MTP head 看到的 state 就偏了，draft 品質自然下降。

所以不能用「關 replay」當修法。

要做的是找等價替代。

## 最後發現：API 其實已經在那裡

真正漂亮的地方在這裡。

mlx-vlm 其實已經有 `rollback_speculative_cache` 這種能力。backbone forward 的時候也有捕捉 `gdn_states`。也就是說，partial reject 之後，不一定要 replay backbone 才能修 GDN cache。

可以直接用 speculative cache rollback 修正。

原本 oMLX 的 Native MTP batch generator 沒有把這條路接起來，所以才走了昂貴的 replay。

接上之後，結果非常明顯：

```text
cache:       2622ms -> 55ms
replay:      2583ms -> 0ms
acceptance: 67.9% -> 71.7%
tok/s:       ~30 -> ~36.8
```

這就是我們要找的點。

它不是 approximate shortcut。它沒有犧牲 correctness。它只是把原本已存在的 speculative rollback API 接到真正的 hot path。

## VLM 也要確認

這次還特別測了 VLM。

因為這個 fork 之前很重要的一點，就是 VLM + Native MTP 不能退回 LM-only dispatch。`VLMModelAdapter` 要保留 `mtp_forward`、`make_mtp_cache`、`return_hidden=True` 這些 passthrough，不然圖片模型雖然看起來能回答，實際上可能 vision path 或 MTP path 沒吃到。

測 Downloads 裡的圖片，用 `Qwen3.6-27B-MTPLX-Optimized-Quality` 跑，log 裡有看到：

```text
VLM+MTP enabled and active
MTP path activated
fb_replay=0
spec_rb_count=25
```

沒有看到：

```text
forcing LM-only dispatch, vision components ignored
```

這表示 VLM 路徑是通的，speculative rollback 也有吃到。

VLM 圖片 prompt 的 tok/s 只有 15 左右，這不奇怪。那次 prompt 有 1774 tokens，還有 vision context，不能拿來跟純文字 Sieve prompt 直接比較。

## 這次真正學到的東西

這次追查最有價值的地方，不是最後多了幾 tok/s。

而是把幾個很容易誤判的方向排掉了。

不是 external draft model。

不是 CPU acceptance walk。

不是 NumPy sparse distribution。

不是單純 `mx.eval` 太慢。

也不是 fixed depth 3。

真正的差異在 partial reject 後的 cache correction。

oMLX 原本的做法是：

```text
partial reject -> backbone replay -> 修 cache
```

現在接上後變成：

```text
partial reject -> rollback_speculative_cache(gdn_states) -> 修 cache
```

這個差別，就是秒級和毫秒級的差別。

我覺得這種 bug 很有意思。它不是那種「少寫一行所以壞掉」的 bug。原本的做法其實是正確的，只是太貴。它用一個完整 backbone replay 去買 correctness。

MTPLX 讓我們看到，這個 correctness 不一定要用 replay 買。

而更妙的是，oMLX 需要的能力其實已經在旁邊了。只是 Native MTP 那條路沒有接上。

這也是我喜歡這次追查的地方。最後不是靠一個很炫的新 kernel，也不是把一段 sampling code 搬過來就突然變快。

最後的答案比較樸素：

把已經存在的正確狀態修復機制，接到真正需要它的地方。
