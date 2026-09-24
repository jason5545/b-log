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

現在要開實作端，是協調端跑一行指令。工具會把畫面上的權限模式和模型讀出來給協調端核對，我不用按任何東西。

旗標還是關的。
