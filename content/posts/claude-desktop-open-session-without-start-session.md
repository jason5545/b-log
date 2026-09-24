# 沒等到 start_session，我讓 Claude 自己開 session：資料夾明明顯示對的，還是開錯地方

今天早上要把工作交給另一個 Claude Code session，我又得自己開一個新的。開之前還先問了 Claude：要開在哪個 workspace？

我最近的做法是一個 session 當協調端，另一個 session 動手。協調端已經很長，裝著計畫和審查要用的脈絡。實作的大量工具輸出放到另一邊，協調端只看 diff 和驗證輸出。

Claude 桌面版其實有開 session 的工具，叫 `start_session`。但它受桌面版的功能旗標控制，我的帳號還沒推送到。

所以每次都是我自己開。開的時候要講清楚四件事：資料夾、要不要 worktree、權限模式、模型。

我主要靠右手食指操作電腦（[前因在這篇](https://b-log.to/tech-development/agentic-coding-mac-assistive-workflow/)）。開新 session、找資料夾、切模式，每一下都是實際的操作量。

今天我問 Claude：既然還沒有旗標，桌面版的輔助使用介面（AX tree）完不完整？有沒有 AppleScript？

## 查到的東西

AppleScript 沒有。Claude.app 沒有腳本字典，`sdef` 直接回錯誤。能做的只有透過 System Events 點選單，File → New Session。

AX tree 是完整的。新 session 頁面上，資料夾、worktree 勾選框、權限模式、模型、effort、Send 按鈕，全都是有標籤的控制項。

Claude 另外翻了 app 的程式碼，找到一個 deep link：

```
claude://code/new?folder=<資料夾>&q=<第一句話>
```

桌面版自己選單裡的「在某個資料夾開新 session」，用的就是它。

## 第一個 Enter 是我按的

Claude 打開這個連結，畫面出現「You said: …」，它回報說連結會自動送出。

其實是我按的 Enter。

deep link 只會把資料夾和文字帶進輸入框，不會送出。session 要按下 Send 才會建立。

少的就是這一下。Claude 寫了一個小工具，從 AX tree 找到帶著那段文字的輸入框，按下同一個輸入框裡的 Send。

session 開出來了，但開在一個新的暫存資料夾，app 顯示「No folder」。

它推測是按太快，資料夾還沒套上，改成等輸入框上的資料夾標籤出現、再等 1.5 秒才按。下一次成功了，我就叫它包進 skill。

## 只成功一次

我跟它說，這只成功一次，再測。

它又送了兩次。git 的資料夾又開到 No folder，非 git 的那個開對了。

算上前面幾次，真的送出的五次是：對、錯、對、錯、對。

第二次失敗時，工具已經確認資料夾標籤是對的，worktree 勾選框也載入了。畫面上看不出差別。

## app 自己的 log 寫著

Claude 去讀了桌面版的 `main.log`。

打開 deep link 後幾秒內，log 會出現一行 `Saved workspace trust for <資料夾>`。只帶入、沒有按 Send 的那兩次測試，也有這一行。這是頁面自己在存資料夾信任，跟 Send 無關。

照時間推算，失敗的兩次，Send 都是在這行出現之前按的。過了 10 秒，log 才出現 `createScratchWorkspace`，session 開在新的暫存資料夾。

成功的幾次，大多是在這行之後按的。有一次疑似按早了也成功，所以這還只是最可能的原因，不是定論。

工具改成兩件事：

- 按 Send 之前，先等 log 出現這個資料夾的信任紀錄。
- 按完之後，從 log 找新 session 的啟動紀錄 `Starting local session <id> in <路徑>`。路徑不對就報錯，把那個 session 的 id 一起交出來。

改完連送三次，三次都開在指定的資料夾。

## 交接也跑一次

最後用 SendMessage 送一個唯讀的小任務給新開的 session：列出資料夾內容，做完回報。

它跑了，也回報了。回報要等協調端那一輪結束才會送到。

內容跟協調端自己跑的一樣，差別只在 `@`。`ls -la` 權限欄後面的 `@`，被它改成全形的 `＠`，而它標的是「原始輸出」。要精確比對，還是要自己重跑。

開 session 的時候，主畫面會被切到新 session。打開協調端自己的連結就能切回來，這一步也放進工具裡。

到這裡，開實作端已經變成協調端跑一行指令。工具會把畫面上的權限模式和模型讀出來給協調端核對，我不用按任何東西。

## 其實 chip 就能開

這篇發出去的時候，Facebook 的預覽抓取失敗。Claude 丟了一個 chip，讓我另開 session 去修。我按下去，看到那個 session 的上下文是乾淨的。

這個 chip 來自 Claude Code 的 `spawn_task`，用途是提議一件可以另外做的事。旗標關著的帳號拿到的正好是它，旗標開了反而沒有。

skill 裡原本寫著「spawn_task 會開新的 worktree」，所以一開始就沒考慮它。其實那只是預設按鈕，旁邊的選單裡還有 Start locally，開在主資料夾。

我叫 Claude 試試看：chip 出來之後，從 AX tree 按 Start locally。

按下去 1 秒，session 就開好了，在 b-log 的主資料夾，回了「待命」。

比 deep link 好的地方有三個：

- chip 的內容原封不動變成第一句話。deep link 帶進去的文字會被正規化，全形冒號、逗號都變半形，所以之前只敢放「待命」，交接另外送。現在整份交接可以直接放進 chip。
- 主畫面不會跳走，新 session 出現在側欄，標著未讀。
- 不用等資料夾信任那一行 log。

## 兩邊都是 Opus

測完我問：兩個 session 是同一個模型？那這只適合把上下文分開，不適合拿來省額度？

我的分工有兩種用途。一種是 Opus 指揮 Opus，只是把上下文分開。另一種是 Fable 指揮、Opus 動手，省 Fable 的週額度。

chip 開出來的確實是 Opus 5.5，跟協調端一樣。但我的預設模型也是 Opus 5.5，看不出它是跟著協調端，還是用預設。

Claude 把那個測試 session 切成 Sonnet 5，再傳一句話過去，它回自己是 Sonnet 5。開好之後可以換模型。

卡的是第一輪。chip 按下去就開始跑，來不及先切。所以 Fable 指揮的時候，chip 裡只放「待命」，切成 Opus 之後再把交接傳過去。Fable 開出來的 chip 第一輪用什麼模型，要等我真的用 Fable 指揮才知道。

## 我不在那個畫面上

第二次測試，Claude 說找不到按鈕。

那時候我在看別的 session。chip 的啟動按鈕只在協調端自己的畫面上，我一切走，它就不在 AX tree 裡。Claude 唯一的辦法是把我的主畫面切回來，但我可能正在別的 session 打字，所以它停下來跟我說。

我切回來之後重跑，這次整條跑完。

另外，chip 開的 session 結束時會通知協調端。實際上這個結束指的是封存，不是做完一輪。實作端做完，還是要自己傳訊息回報。

## 換資料夾還是要 deep link

chip 只能開在協調端自己的 repo。Start locally 開在主資料夾，Start with worktree 也是從同一個 repo 開，沒有地方可以換資料夾。

同一天稍晚就碰到了。b-log 這邊的協調端要把工作交給另一個 repo（cptwin）的實作端，chip 開不過去。改跑 deep link 那支 script，一次就開在 cptwin，模型和權限模式都跟協調端一樣。

所以兩條都留著。同一個資料夾用 chip，換資料夾用 deep link。chip 也看不到新 session 的權限模式，要確認權限模式的時候，一樣走 deep link。

旗標還是關的。
