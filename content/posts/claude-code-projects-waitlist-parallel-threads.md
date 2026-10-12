# Claude Code Projects 把等候名單全放進來了，平行雲端 thread 我早就付過學費

臺灣時間 10 月 10 日，[@ClaudeDevs](https://x.com/ClaudeDevs/status/2108621476538781878) 發推說：Claude Code Projects 等候名單上的 Pro 和 Max 使用者，全部放進來了。官方部落格〈[Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)〉寫得更完整：你描述目標，Claude 拆範圍、委派工作、協調平行 threads、再把結果組起來；手機也能監督進度；離開電腦之後，它還可以繼續跑。

我第一個想到的，不是「終於可以用了」。

是那一輪花掉 90 美元的雲端 agent。

## 產品預設長成什麼樣

Projects 裡有協調者，也有一堆做工的 thread。官方舉的例子很直白：降低 checkout 延遲，就平行開 thread 去量各端點、試最佳化、開 PR；要退掉一個舊 API，就每個 repo 一條 thread 去改呼叫端、跑測試、再告訴你哪個 PR 要先 merge。每個 thread 是獨立的 Claude Code 雲端 session，自己有 branch，也有一份 repo 副本；如果兩個 thread 動到同一段程式，最後用 PR 的 merge conflict 解。一個 thread 不夠，還可以再拆 subagents、loops、workflows。專案之間有共享 memory，也有 library 收檔案和產物。

官方自己寫了一句我很在意的話：專案會更快撞到用量上限。你可以查專案的用量，也可以替協調者和 worker 選不同的 model 跟 effort。Threads 目前跑在雲端；本機執行，官方寫的是很快就會支援。

最初 beta 是挑一部分用過 cloud sessions、網頁或桌面還沒有既有 projects 的 Pro／Max。現在等候名單全開，回覆裡還說仍是 beta，容量允許會再放更多。

我讀完之後，腦裡浮出來的畫面，比較像產品把「協調者加一堆平行雲端 session」做成預設工作方式，而且預設就允許人走開。它不只是把資料夾改名叫對話。

## 學費我付過一輪

九月那篇〈[我只管主 session 不要爆掉，雲端 agent 那一輪花了 90 美元](https://b-log.to/ai-analysis/cloud-agent-main-session-cap-90-usd-round/)〉寫過同一種形狀。Anthropic 送的 250 美元只能在雲端用，我拿來做式札，一個完全放手的和風卡牌遊戲。階段 3 一輪花了 90 美元、2 小時 40 分。

我那時管的是主 session 不要爆。後來改成主 session 用掉約 25 萬 token 就交接；子代理怎麼用，我不管。它真的照做了：工作全派出去，主 session 只用約 14 萬 token，規則守得很好，帳單卻是那一輪最貴的。原因不是它偷懶，是新開的子代理要把系統提示、規則檔、讀過的檔案重新寫進快取，寫快取比讀快取貴很多倍；同一個 session 長做，多半是在讀已經在快取裡的東西，反而便宜。

我還設了標題有「[接力]」的 PR 一 merge 就自動開下一輪。階段 3 的 PR merge 後兩秒，下一輪就開工。我停掉的時候它才跑六分鐘。那時如果我去睡覺，照一輪 90 的花法，額度會先燒完，接著吃訂閱。後來改成 Opus 規劃、一個 Sonnet 從頭做到尾，那輪 31 美元，但做的量也砍小了。Codex 那邊我實測過，子代理沒有比較省用量；到 Claude 雲端，看起來也一樣。

那篇有一句我現在還會拿出來對：雲端 agent 有一個問題，擺著，我就去睡覺了，或去忙別的。它在跑的時候，沒有人看著。

## 人走開之後，誰還握著煞車

Projects 做的事，跟我那次實驗很像：你說目標，它平行開 thread；人可以走開，手機還能看一眼。差別是，那次是我自己把「放手」寫進流程，這次是產品說明書直接把這種形狀推給等候名單。文件也沒有把用量問題藏起來，它先告訴你會更快撞到用量上限。

手機監督、關筆電還能跑，對我理論上有用。我不會假裝自己已經進場試過，也不知道自己有沒有在那份等候名單裡。我只是看見產品把沒人盯著的平行雲端 session，從我付過學費的實驗形態，變成正式 beta 的預設講法。

昨天那篇 Nadella 文提過，控制要放在模型外面，最後常常落到我親手按的那一下（〈[Nadella 說控制要放在模型外面，我昨天才把一條規則從記憶搬進設定檔](https://b-log.to/ai-analysis/nadella-controls-outside-the-model/)〉）。本篇不是要再講權限規則怎麼搬。我在意的比較窄：平行雲端 thread 一旦變成預設，人走開之後，誰還握著煞車。用量上限可以查，model 跟 effort 也可以選，但那是你還坐在螢幕前面時的控制。人離開之後，剩下的是一群各自有完整雲端 session 的 thread，在沒有人盯著的時候繼續燒。

我不是反對 Projects。協調、委派、共享 memory，這些都合理；官方也讓你看專案用量、替協調者和 worker 選 model。那些控制在有人盯著的時候有用。我在意的是產品說明書現在把「放手讓一群雲端 session 自己跑」寫成預設工作方式。學費我已經付過一輪了。這次真的用起來，我會先看用量怎麼長，再決定要不要讓它在我睡覺時繼續開 thread。

