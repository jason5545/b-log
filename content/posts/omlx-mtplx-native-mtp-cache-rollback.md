# 我們以為在追 MTPLX，最後發現 oMLX 只是少接了一條路

這次追 oMLX 的 Native MTP，其實有點像在查一個很會偽裝的效能問題。

一開始我以為答案會在 sampling。

MTPLX 跑同一顆 Qwen3.6 27B，可以到三十幾 tok/s；我們自己的 oMLX 跑起來卻卡在二十幾。Native MTP 明明有開，acceptance 也沒有整個崩掉，但速度就是上不去。

這種時候很容易先懷疑那些看起來「像加速核心」的東西：是不是 sparse path 沒吃到？是不是 top-k、top-p、residual sampling 跟 MTPLX 不一樣？是不是官方那條 external drafter 才是正解？

後來才發現，最要命的地方不在那裡。

## 我們追的不是 external drafter

先把範圍講清楚。

官方最近確實也有 speculative decoding 的東西，但那條路比較像另外放一顆 draft model。Qwen 這邊有趣的地方，是模型本身就有 MTP head。

也就是說，我們不是要再找一顆小模型幫忙猜下一個 token，而是用 Qwen 內建的 MTP head 做 native MTP。

MTPLX 做的也是這件事。

所以問題不是「要不要切去官方 external drafter」。真正值得追的是：同樣是 native MTP，為什麼 MTPLX 比 oMLX 快？

這個問題可以拆成兩件事。

第一，draft 準不準，也就是每個 cycle 平均可以吐幾個 token。

第二，每個 cycle 貴不貴，也就是跑一輪 verify、sample、cache correction 到底花多少時間。

一開始 oMLX 大概是 21 到 22 tok/s，MTPLX 同模型同條件可以到 26 到 37 tok/s，依 prompt 和設定不同會浮動。log 看起來最刺眼的是 sample time。每個 cycle 一大段時間都算在 sampling 裡。

所以我們先追 sampling。

## sampling.py 很可疑，但不是兇手

第一步是把 top-k sparse path 打開。

把 sampler 從 `top_k=0` 拉到 `top_k=20`，讓 verify side 可以走 sparse distribution，不要每次都處理完整 vocab。這件事有生效，log 裡也看得到 sparse distribution 開始跑。

但速度沒有明顯提升。

接著又把 MTPLX 裡 NumPy-based `SparseDistribution`、`acceptance_probability`、`residual_sample` 這些東西搬進來，取代原本比較直覺的 Python list 版本。

結果還是沒有明顯提升。

這一步其實很值得做，因為它不是白忙。它幫我們排掉一個很直覺的猜測：CPU acceptance walk 不是瓶頸。

後來 instrumentation 拆出來，walk 只有幾毫秒，甚至是 0.02% 那種量級。也就是說，把 acceptance walk 寫得再漂亮，整體速度也不會動多少。

那 sample time 到底在等什麼？

## `mx.eval` 看起來很像答案

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

看到這種數字，第一反應通常是：好，兇手就是 `mx.eval`。

但這句話只對一半。

MLX 是 lazy graph。很多時候 `mx.eval` 不是「這個 operation 本身慢」，而是「前面欠的 GPU 工作現在一起結帳」。target sparse distribution 那邊的 `mx.eval`，其實是在等 backbone verify graph 跑完。

MTPLX 有一個 `MTPLX_LAZY_VERIFY_LOGITS` 的設計，會把 `verify_hidden` 和 `verify_logits` 的 eval 拆開。這看起來很關鍵，但比對後發現，分開 eval 不會讓 backbone forward 的成本消失。

它只是把帳記在不同欄位。

這是這次很容易走錯的地方。看到 `tdist/eval` 很大，就以為 sparse distribution 是瓶頸。其實不是。那一大段主要是 backbone verify 本來就要付的 GPU 成本，只是 oMLX 把帳記在 tdist 下面。

所以我們又往回看 tokens per cycle。

## adaptive depth 一開始太保守

接著看到一個比較扎眼的差異：D3 coverage。

MTPLX 幾乎每個 cycle 都會 draft 到 D3，但 oMLX 一開始 adaptive depth 從 1 慢慢爬。有一次 log 很誇張，花到第 85 個 cycle 才爬到 depth 3。

這就不合理了。

因為 per-depth acceptance 其實很接近。

```text
D1: oMLX 約 90%，MTPLX 約 92%
D2: oMLX 約 79%，MTPLX 約 81%
D3: oMLX 約 71%，MTPLX 約 71%
```

模型不是不會吃 D3。是 oMLX 太晚給它 D3。

所以我們把 adaptive policy 改成從 max depth 開始，`increase_after` 也調得更積極。這一步有改善：

```text
cycles:       100 -> 92
tokens/cycle: 3.00 -> 3.26
D3 drafted:   55 -> 70
tok/s:        ~28.9 -> ~30.1
```

這個 patch 是對的。

但還是不夠。

MTPLX 仍然可以跑到 37 tok/s 左右。這時候 tokens per cycle 已經比較接近了，剩下差距看起來更像 per-cycle cost。

## 固定 depth 3 也不是答案

這裡也做了一個實驗：既然 D3 coverage 不夠，那乾脆固定 depth 3 呢？

結果不行。

```text
adaptive:       tokens/cycle 3.26
never-decrease: tokens/cycle 3.19
fixed depth=3:  tokens/cycle 3.09
```

原因很直接：不是每個 cycle 都值得硬 draft 3 個。reject 之後硬塞的 D2/D3 很多都是錯的，最後 cycles 反而增加。

所以 MTPLX 快，不是因為它盲目固定 depth 3。

那剩下是什麼？

答案在 cache。

## 真正的洞在 partial reject

後來把 cache ops 拆開看，問題就亮起來了。

```text
cache = 2622ms
  full = 0.4ms / 46
  reject = 2621.7ms / 53
    rollback = 38.7ms
    replay   = 2582.8ms
```

cache 不是慢在 rollback restore。

慢的是 replay。

oMLX 在 partial reject 的時候，例如 D1 accepted、D2 rejected，會為了修正被 draft token 污染的 cache state，再重跑一次 backbone，把 accepted token replay 回去。

這件事每次 reject 大概 48ms。

53 次 reject 就是 2.58 秒。

這幾乎就是 oMLX 跟 MTPLX 的差距。

追到這裡，整件事才真的對焦。

MTPLX 快，不是因為 sampling.py 有什麼神奇寫法。它快，是因為 partial reject 之後不用重跑 backbone。

## replay 不能直接關掉

當然，第一個實驗就是把 replay 關掉。

結果很有意思。

```text
cache:       2622ms -> 60ms
total time:  約 -10%
acceptance: 67.9% -> 56.2%
cycles:     99 -> 112
```

cache 真的掉下來了。

但 acceptance 也崩了。

這代表 replay 不是多餘的保守操作。它是在維持 GDN/SSM state 正確。把它拿掉，下一輪 MTP head 看到的 state 就偏了，draft 品質自然下降。

所以不能用「關 replay」當修法。

要找的是等價替代。

## 最後發現 API 其實已經在旁邊

漂亮的地方在這裡。

mlx-vlm 其實已經有 `rollback_speculative_cache` 這種能力。backbone forward 的時候也有捕捉 `gdn_states`。

也就是說，partial reject 之後，不一定要 replay backbone 才能修 GDN cache。可以直接用 speculative cache rollback 把狀態修回去。

原本 oMLX 的 Native MTP batch generator 沒有把這條路接起來，所以才走了昂貴的 replay。

接上之後，結果非常明顯。

```text
cache:       2622ms -> 55ms
replay:      2583ms -> 0ms
acceptance: 67.9% -> 71.7%
tok/s:       ~30 -> ~36.8
```

這就是我們要找的點。

它不是 approximate shortcut，也不是犧牲 correctness 換速度。它只是把已經存在的 speculative rollback API，接到真正需要它的 hot path。

## 第二個坑：長 context 的 RoPE offset

本來以為到這裡差不多了。

cache replay 歸零，speculative rollback 有吃到，短 prompt acceptance 也回到 60% 到 70%。照理說，速度應該穩定很多。

但後來看長 context log，又覺得不對。

14k 左右 prompt 的時候，acceptance 會掉到 33.8%。不是一點點波動，是整個 MTP draft 品質垮掉。D3 drafted 只有 32/188，也就是大部分時間根本走不到深度 3。

這次的問題不是 cache。

log 很乾淨：

```text
fb_replay=0
replay=0.0
spec_rb_count 有值
cache 約 1ms/cycle
```

所以只能繼續往 position 看。

最後找到的點是 `base_offset = state.position`。

這個寫法在短 context 看起來沒事，但它其實只追蹤 main token 的位置。Native MTP 一個 cycle 不一定只吐一個 token，它可能吐 accepted draft，也可能吐 bonus token，reject 時也可能吐 verify fallback token。

也就是說，真實序列長度一直往前走，但 `state.position` 只像每個 cycle 加一。

短 context 這個誤差還不明顯。到了 14k、15k context，MTP head 用錯 RoPE position，draft 品質就開始掉。這種 bug 很討厭，因為它不是一開場就炸，而是跑到夠長才慢慢變形。

修法是改用已輸出的 token 數去推真正的 RoPE base。

修完後，同一類長 context case 變成這樣：

```text
accept:     33.8% -> 62.9%
D3 drafted: 32/188 -> 60/105
cycles:     188 -> 105
tok/s:      18.9 -> 22.6
```

這個改善很扎實。

22.6 tok/s 看起來沒有短 prompt 那麼漂亮，但那是 15k prompt，本來就比較重。真正重要的是 cycles 從 188 掉到 105，acceptance 從 30% 多回到 60% 多。

後來也補了 position diagnostics：

```text
pos[input=1 state=37 emitted=97 rope_base=132]
```

這裡 `input=1` 不是原始 prompt 長度，而是 batch generator init 當下看到的 input 長度。VLM 或 cache resume 路徑下，token buffer 可能已經被縮減，所以不能把它叫 `prompt_len`，不然以後看 log 又會被騙一次。

我覺得這個小改名其實很重要。效能問題最怕的不是數字不夠，而是欄位名字讓你以為自己看懂了。

## VLM 也不能漏

這次還特別測了 VLM。

因為這個 fork 之前最重要的一點，就是 VLM + Native MTP 不能退回 LM-only dispatch。`VLMModelAdapter` 要保留 `mtp_forward`、`make_mtp_cache`、`return_hidden=True` 這些 passthrough。

不然圖片模型雖然看起來能回答，實際上可能 vision path 或 MTP path 根本沒吃到。

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

後來 RoPE offset 修完之後也再測過一次 VLM。MTP 路徑仍然是 active，speculative rollback 也還在：

```text
accept=62.7%
fb_replay=0
spec_rb_count=10
pos[input=1 state=37 emitted=97 rope_base=132]
```

這代表 long-context 修正沒有把 VLM 路徑弄壞。

## 這次真正學到的東西

這次追查最有價值的地方，不是最後多了幾 tok/s。

而是把幾個很容易誤判的方向排掉了。

不是 external draft model。

不是 CPU acceptance walk。

不是 NumPy sparse distribution。

不是單純 `mx.eval` 太慢。

也不是 fixed depth 3。

真正的差異先是在 partial reject 後的 cache correction，後來又多抓到一個長 context RoPE position offset。

oMLX 原本的做法是：

```text
partial reject -> backbone replay -> 修 cache
```

現在接上後變成：

```text
partial reject -> rollback_speculative_cache(gdn_states) -> 修 cache
```

這個差別，就是秒級和毫秒級的差別。

而長 context 那個問題，則是另一種更隱性的錯。

```text
只看 state.position -> RoPE base 慢慢偏掉
看 emitted tokens -> RoPE base 跟著真實序列走
```

一個是 cache state 的正確性。

一個是 position encoding 的正確性。

我覺得這種 bug 很有意思。它不是那種「少寫一行所以壞掉」的 bug。原本的做法其實是正確的，只是太貴。它用一個完整 backbone replay 去買 correctness。

MTPLX 讓我們看到，這個 correctness 不一定要用 replay 買。

更妙的是，oMLX 需要的能力其實已經在旁邊了。只是 Native MTP 那條路沒有接上。

RoPE offset 那個也類似。不是模型不會 draft，不是長 context 注定 acceptance 崩掉，是我們餵給 MTP head 的位置不夠誠實。

這也是我喜歡這次追查的地方。最後不是靠一個很炫的新 kernel，也不是把一段 sampling code 搬過來就突然變快。

答案比較樸素：

把已經存在的正確狀態修復機制，接到真正需要它的地方。

然後不要讓 position 欄位騙自己。
