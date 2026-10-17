# Theo 叫 AI 做到 merge 前停，我改用航管的 HOLD SHORT

最近看 Theo 的直播，我發覺他對 AI 下指令的方式其實跟我差不多，只是他會說「full stop」。

我先問 Claude 這是什麼用法。它照英文的語氣詞解釋了一大段：full stop 是「這條沒有例外」，用來關掉模型自己補上的「除非必要」。聽起來很合理，不過它也講明了自己沒看過原始畫面。我想知道是哪一場直播講的，先用 Gemini 搜，找不到。

後來是 Claude 找到的。[BigGo 有一篇整理](https://finance.biggo.com/news/edd2a2fc77a07445)寫的是 Theo 10/14 那場五個半小時的直播，掛的標題是〈So my workflow has changed a lot...〉；Twitch 上同一場叫〈My workflow has never been weirder〉，片長只差兩秒。標題對不上，大概就是 Gemini 搜不到的原因。也是看了整理才知道，full stop 根本不是語氣詞，是他一個 skill 的名字。

## Theo 的三個 skill

照那篇整理，Theo 有三個自己寫的 skill，放在一個叫 fleet 的 repo。soul loop 是 review 迴圈；full send 讓代理一路做到 merge，可以 force-push；full stop 流程一樣，只是不 merge，代理只有卡住才用問答工具找他。full stop 是他最常用的一個，他自己說那個檔案幾乎全是 slop，一直沒整理。這三個 skill 出現在他三成以上的 agent 對話裡，某一批 32 次 full send，有 27 次 merge 之後他沒再回頭看。這些都是二手整理，VOD 只有訂閱者能看，我沒看到原始畫面。

fleet 沒有公開，Claude 翻了他的 GitHub 也沒找到。整理說他打算用 T-Stack 的名字釋出，也說要學的是方法，不是照抄那幾個 markdown。他 8/11 那支影片的標題就叫〈[My AGENTS.md & SKILLS.md Breakdown (Don't copy them)](https://www.youtube.com/watch?v=e1snsuY4lTI)〉。

我也覺得重點在習慣，而且要學會怎麼用。說出 full stop 的同時，三件事一起定了：代理能做到哪、停在哪、什麼時候才可以來找你。沒有這個詞，這三件事每次都要在 prompt 裡重講，不然就是代理自己猜。

對我來說最後那件最重要。代理每問一次，我就得切過去、讀、再回，這些都是右手食指和語音輸入要付的操作。只有卡住才問，剛好是我要的。

## 我的線畫在 push 前

要不要直接抄 Theo 的？與其抄他的，還不如用自己熟悉的寫一個會比較順。我從 2006 年玩模擬飛行到現在（〈[在虛擬天空中找自由：模擬飛行二十年](https://b-log.to/life-stories/flight-sim-20-years-freedom/)〉），平常下指令本來就夾一堆 FMGS 跟航管術語，DCT、ALTN、TOGA 這些，我的 AI 早就聽得懂。所以 full stop 在我這裡叫 HOLD SHORT：滑到跑道前停住，等塔台放行。

我的 repo 幾乎都直接 push 到 main，沒有 PR 那一關。b-log 一 push 就上線，Facebook 也會跟著發。所以線畫在 push 前：改程式、跑驗證、本機 commit 都讓代理自己來，push、部署、對外發布就停下來，等我說 CLEARED FOR TAKEOFF。

航管詞的好處是規則本來就在詞裡。hold short 就是沒拿到許可不能上跑道；起飛許可也只給這一架、這一次，下一架要重新叫塔台。所以放行一次只算一次，下一個 commit 又回到 HOLD SHORT，這條不用另外背。照搬 full stop，我得先記住它停在哪；用自己的詞，講出口的時候就知道邊界在哪。

我也先講好了我會簡寫，HOLD SHORT 多半只講 HS。寫進規則時才發現幾個會撞的地方：單獨的 HOLD 在我的規則裡本來就是「先等」，跟 HOLD SHORT 是兩回事；MCDU 上的 CLR 是清掉，不能拿來當 CLEARED 的簡寫，所以放行的簡寫只留 CTO。

## 排第二的那架

後來我補了一個情境：「HS, you are number two」，意思是前面還有一個代理在同一個 repo 做事。Claude 寫完規則後在暫存 repo 模擬了一次，抓到一個我沒想到的問題：兩個代理共用同一個資料夾時，排第二的先 commit，排第一的一 push，就把第二的 commit 一起帶上去了。所以 number two 不只不能先 push，前面那架起飛之前連 commit 都不行。

接著我叫它把還能用的航管詞全部列出來。我要它先列、不要直接加，是想看一下我的熟悉度，剛好是我熟的圈子才加。ATIS、READBACK、VECTORS、RESUME OWN NAVIGATION、MIN FUEL、GROUND STOP，列出來的我都熟，就全收了。

收完之後，我丟了一句「TCAS TA, asking for advisory」，再補「RA approved for resolution」，叫它自己找衝突、找到就直接修。它找到的第一個衝突是自己排的：它把 LINE UP AND WAIT 拿來代表「只做第 0 步」，排在 HOLD SHORT 前面。實際的順序是 hold short、line up and wait、cleared for takeoff，上跑道等待比停在跑道外更接近起飛。後來第 0 步改叫 PREFLIGHT，LINE UP AND WAIT 留給 number two：前面那架走了，你上跑道把 commit 準備好，但還不能推。

這篇就是用 HS 寫的。我只講了「發布文章 HS」，從翻舊文、寫稿、畫封面到本機 commit 都是它自己做，停在 push 前，等我說 cleared for takeoff。至於哪幾次它其實不用問、哪幾次停錯地方，10/31 再回頭看。
