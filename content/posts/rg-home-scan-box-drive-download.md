# 一行 rg 在背景跑了 42 小時，把 1.2 TB 的 Box 檔案下載到我的 Mac

有天早上，我發現 Box 在把整包雲端檔案同步到 Mac 上，丟給 Claude 一句：「i have some thing urgent」。

它先看 Box Drive 的狀態。Box Drive 才啟動 9 分鐘，已經下載了 1.78 GB。

它把 Box Drive 關掉，最後一筆下載完成在關掉的前一秒。

### 讀一個檔案，Box 就下載一個

Box Drive 的 log 裡，下載原因全部是 `ON_DEMAND`。沒有人把資料夾設成離線保留，是有程式在讀檔案。

Box Drive 的檔案平常只放在雲端，有程式讀取時才下載。它的同步資料夾是 `~/Library/CloudStorage/Box-Box`，就在家目錄底下。

Claude 查了哪些處理程序開著 Box 裡的檔案，找到一個 `rg`，同時開著 12 個。指令是：

```bash
rg -l "<檔名>" /private/tmp ~
```

ripgrep 要讀檔案內容才能搜尋。範圍是整個家目錄，Box 的資料夾也在裡面，所以它每讀一個檔案，Box 就得下載一個。

Claude 把它砍掉，再重開 Box Drive，看了 30 秒，沒有新的下載請求。

### Claude 說磁碟沒被塞爆，我回了一句 was 2.5tb

砍掉 rg 之後，Claude 去算下載量。它只看了最後 25 個小時左右的 log，這段就下載了約 964 GB。更早的 log 其實還在，它沒看到。

接著它說，磁碟沒被塞爆，Box 會自己清掉舊的暫存，快取只有 19 GB，磁碟還剩 615 GB，不用手動清。

我回它：「was 2.5tb」。

它才說，19 GB 只是 Box 自己的快取資料夾。下載下來的檔案存在同步資料夾裡，它沒量那邊就下了結論。

量下去是 1.2 TB，其中兩個資料夾就佔了 1,190 GB。Box 沒有自己清。

要清的是本機副本，雲端的檔案不動。這版 macOS 的 `fileproviderctl` 沒有 evict 指令，Claude 改用系統 API `FileManager.evictUbiquitousItem`。

它先拿一個檔案測，佔用的區塊從 528 變成 0，狀態變成 `dataless`。再測一個 16 個檔案、81 MB 的小資料夾，才去清那兩個大資料夾。

跑了 7 分 21 秒，可用空間從 615 GB 變成 1,807 GB。

清完之後，Claude 算出來已用 2.0 TB，跟我說的 2.5 TB 對不上。這個差距後來沒有再查。

### 等待時間到了，我也按了 Esc，rg 都沒有結束

rg 被砍掉的時候已經跑了 1 天 18 小時，父處理程序是 PID 1。原本叫它起來的那個處理程序，早就不在了。

我問 Claude：「its scheduled or a single session」。

不是排程。執行紀錄裡，這行指令只出現在兩天前的一次 Codex Desktop 工作階段。

那次工作階段在找幾個檔案。它先在 `/private/tmp` 和另一個資料夾裡找，10 秒後把範圍擴大到整個家目錄。

腳本呼叫這行指令時，設定只等 10 秒。10.2 秒後拿到空的輸出，那次工作階段就當成找不到，繼續做下一步。

但 rg 其實還沒跑完。指令沒跑完時，工具會回傳一個 `session_id`，之後可以拿它回去讀輸出。這次的腳本只印了輸出，沒有印 `session_id`。同一輪裡其他指令都有完成的紀錄，只有 rg 沒有。

rg 啟動後 1 分 55 秒，我按了 Esc，把那一輪中斷。

中斷當下，Codex 在紀錄裡留了一句：「Any running unified exec processes may still be running in the background.」這句是寫給模型看的，不是寫給我的。

當天晚上，Codex 負責執行指令的背景服務也重啟過一次。

等待時間到了、我按了 Esc、背景服務重啟，rg 都沒有被停掉。它在背景繼續跑，一路讀進 Box 的資料夾。

將近兩天，我是先看到下載流量不對，再去看硬碟空間，才發現不太妙。

我白天用的網路環境有 bucket 限速：一開始給全速，持續跑一陣子，就會被壓在一個固定速度。那兩天白天，下載量大概每小時 60 到 70 GB，很平，我猜就是被壓在那個速度。

家裡沒有這種機制。晚上回家，最快一小時差不多 100 GB，我完全沒感覺。

### Codex Desktop 上看不到它還在跑

我用過的 Claude Code、Kimi Code、pi、omp（原本叫 oh-my-pi），工作階段底下都會顯示還有工作在跑。Codex Desktop 沒有。

Codex CLI 有 `/ps` 可以看背景終端機，`/stop` 可以停掉，但我用的是 Desktop。9 月初也有人在 GitHub 開了 issue，要 Codex Desktop 列出 AI 啟動的背景處理程序：[openai/codex#42244](https://github.com/openai/codex/issues/42244)。

中斷之後讓指令留在背景，是 Codex 刻意的設計。[openai/codex#42717](https://github.com/openai/codex/issues/42717) 引用了原始碼裡的註解：處理程序存在工作階段層級，就是為了中斷那一輪時不要把它停掉。

我的認知，這屬於設計失誤。
