# Activity Monitor 明明正常，Codex Desktop 卻把整台 Mac 卡死

第一次發生的時候，我還能替它找理由。

那時候用的是基本版 M5。工作量大、thread 很長，loading 太重，卡住雖然不合理，但至少還有一個可以說服自己的方向：硬體撐不住。

後來我換成 M5 Max，18 核心 CPU、40 核心 GPU、128GB 記憶體。這已經不是「再升級一點看看」的問題了。往上沒有東西可以換。

結果同樣的事情又發生一次。

畫面完全不動，滑鼠不動，鍵盤不動，連 Caps Lock 指示燈都沒有反應。Moonlight 也一起斷掉。不是某個 App 顯示彩球，也不是桌面還活著、只有視窗點不動。

整台 Mac 像是被直接按住。

最怪的是，事件發生前 Activity Monitor 看起來正常。

沒有記憶體壓力衝紅，沒有哪個 process 明顯吃完整台機器，也沒有 macOS 常見的「系統已耗盡應用程式記憶體」提示。它沒有給我任何資源即將用完的訊號，然後就直接死掉。

這才是我最不能理解的地方。

## 我們先查了所有看起來比較合理的東西

一開始沒有人會直接把責任丟給 Codex Desktop。

Moonlight 斷線，看起來像網路。於是我們重啟 Wi-Fi、升級路由器韌體、查轉發、查 Tailscale、查 Windows VM，也查過影像串流那條資料路徑有沒有問題。

這些方向都不是亂猜。之前 Moonlight 的本地 IP 黑畫面，最後真的查到 Windows VM 的 VirtIO／NIC offload 路徑。網路、VM、UDP 串流，本來就可能讓遠端桌面看起來像整台機器掛掉。

但這次不一樣。

遠端畫面斷掉的同時，本機滑鼠和鍵盤也死了。Caps Lock 沒反應，代表問題已經不是 Moonlight 能解釋的範圍。

而且只要關掉 Codex Desktop，其他東西就恢復正常。

這個對照開始讓前面那些網路檢查變得很尷尬。我們繞了那麼大一圈，升韌體、查 route、查 VM、查串流，最後真正會改變結果的動作，是不要開官方 App。

## T3 Code 讓責任範圍變小了

我後來先改用 T3 Code。

它不是另一套模型，也不是把 Codex 整個換掉。它仍然透過 `codex app-server` 工作，只是沒有走官方 Desktop 的同一套介面、renderer 與 Computer Use helper 路徑。

用了幾天之後，問題沒有再出現。

這個結果不能直接證明官方 App 裡哪一行 code 有問題，但它至少排除了一個很大的範圍：Codex 後端本身不是只要跑久就一定會把 Mac 卡死。

同一台 Mac、同一套工作、同一個 app-server，換掉官方 Desktop shell 之後就穩定。問題比較像是官方 App 額外帶進來的 renderer、長 thread 狀態、Computer Use helper，或它們跟 macOS 圖形與輸入系統互動的方式。

我原本只是想找一個暫時能用的替代 UI，結果它變成最有價值的 A/B test。

## Activity Monitor 為什麼會看起來正常

現在最合理的解釋，是這次不是一般的「資源總量用完」。

如果真的只是記憶體不夠，128GB 被吃完以前，Activity Monitor 應該會看到記憶體壓力、swap 或單一 process 的明顯變化。macOS 通常也會跳出資源耗盡提示。

但鎖死 renderer、WindowServer、輸入事件或某個系統服務，不一定需要把所有 CPU 和記憶體吃滿。

一條 event loop 忙等、一段高頻 IPC、一個 process 不斷留下 helper、或圖形與輸入路徑互相等住，都可能讓「使用者能不能操作」先壞掉。Activity Monitor 顯示的是取樣到的 CPU、記憶體與 process 狀態，它不會直接告訴你滑鼠事件是不是還能走到桌面，也不會替你證明 WindowServer 與 HID 路徑沒有卡住。

所以「Activity Monitor 正常」和「整台機器不能操作」並不矛盾。

它只證明這不像單純的記憶體耗盡。

## 後來又多了一個線索：heartbeat 一直叫醒同一條長 thread

原本我們把 10 小時以上的 CPU 與 lag 全部算在 Codex Desktop 身上。

後來整理 CWP09 的監控流程時，才發現還有一個很可能的放大器。

那個監控原本是一個 heartbeat automation。它每小時叫醒同一條 Codex thread，檢查 Box 裡有沒有新的檔案。這個動作持續了好幾天。

那條 thread 最後的 rollout JSONL 已經大約 143MB，有 14,713 筆紀錄，裡面還出現大量 compaction 相關內容。最後一次喚醒，在幾分鐘內又產生約 3.7MB 的 log traffic。

這不是一個每小時「看一下就走」的工作。

每一次 heartbeat 都是在重新喚醒一條已經非常長、壓縮過很多次、帶著大量工具狀態的 thread。只要 Desktop 對長 thread 的 retention、renderer 更新或 log tracing 有問題，這個 automation 就會每小時再推它一次。

OpenAI 的公開 issue 也有很接近的現象：

- [#21134](https://github.com/openai/codex/issues/21134)：長時間活躍的 thread 讓 app-server CPU、記憶體與 `logs_2.sqlite` 持續增長。
- [#20735](https://github.com/openai/codex/issues/20735)：Desktop 使用一段時間後，即使沒有明顯工作，CPU 仍然維持在高點。
- [#20435](https://github.com/openai/codex/issues/20435)：renderer 持續吃 CPU，但後端 process 幾乎是 idle，重啟 renderer 後才恢復。

這三個 issue 沒有證明我的 hard freeze 就是同一個 bug，但它們把 10 小時後越來越慢的那一段解釋得很合理。

官方 App 本來就有長時間執行與長 thread 的問題。heartbeat 剛好一直餵它最容易失控的狀態。

## 採樣後，比 Activity Monitor 多看到幾件事

我們做了一個一次性採樣器，不常駐，也不再用 Codex automation 監控 Codex 自己。

在這次調查還活躍時，process list 裡有 7 個 app-server、6 組 `SkyComputerUseClient` 與 `node_repl` helper。還有一個 `turn-ended` process 已經活了超過 41 小時。

兩次取樣之間，renderer 合計 CPU 從 4.6% 跳到 24.6%；主 app-server 約 17% 到 18%。同一分鐘內，websocket response trace 寫入約 2.3MB 到 2.9MB。

這些數字沒有大到讓 128GB Mac 必然當機。

但它們證明一件事：畫面上沒有工作，不代表 Desktop 裡面沒有東西持續累積。Activity Monitor 如果只看總 CPU，很容易把 7 個 app-server、6 組 helper、renderer 波動與大量 trace 當成「還好」。

真正麻煩的是它們活多久、會不會越留越多，以及下一次 Computer Use 或長 thread wake-up 進來時，會不會把某條已經很緊的路推到不能操作。

## 現在把兩個問題分開看

我目前不會把所有現象硬塞進同一個答案。

10 小時後越來越 lag，比較像 Desktop 的長 session 問題，被每小時 heartbeat 與超長 thread 放大。

整台 Mac 的滑鼠、鍵盤、Caps Lock、Moonlight 同時失效，嚴重程度更高。它仍然比較像 Computer Use、WindowServer、HID 或圖形路徑的問題。移除 heartbeat 可以降低發生機率，但不能因此宣告 hard freeze 已經解釋完了。

這兩件事也可能互相影響。

長 thread 與 helper 累積先讓 Desktop 進入不健康狀態，下一次 Computer Use 或圖形事件再把它推過去。現在的證據還不足以把這條因果鏈寫死，但至少已經知道該分別看什麼。

## 我把 heartbeat 從 Codex thread 裡拿掉了

新的監控不再叫醒任何 Codex thread。

現在是 launchd 每小時啟動一次 Python：掃一次 Box，寫一份很小的 JSON 與文字狀態，然後退出。它不做 employer sync、不產生 package、不刪檔、不 git push，也不在記憶體裡留到下一個小時。

舊的長 thread 已經封存。

這不是正式修掉 Codex Desktop。它只是把一個確定會持續加熱的來源拿掉，讓後面的觀察有意義。

接下來看兩條線就夠了。

第一條：那條 143MB thread 不再被喚醒之後，renderer、app-server、log growth 和十小時後的 lag 有沒有穩住。

第二條：完全不碰那條 thread，Computer Use helper 是否仍然會累積，甚至再次造成整機輸入失效。

如果第一條改善，heartbeat 就是很強的放大器。

如果第二條仍然發生，責任就回到官方 Desktop 的 helper 與 macOS 整合路徑。

## 最頂硬體解決不了狀態沒有邊界

買 M5 Max 的時候，我本來就預期這類工作不該再因為硬體不夠而卡住。

現在看來，這個預期沒有錯。錯的是我一開始還把它當成可以靠更大記憶體、更快 CPU 解決的 loading 問題。

硬體可以讓同樣的錯誤晚一點出現，但它不會替長 thread 設上限，不會清掉 41 小時前該結束的 process，也不會讓一個每小時醒來的 automation 突然知道自己應該是無狀態的。

真正讓我無奈的不是 App 有 bug。

是它壞掉時，表面上看起來像 Wi-Fi、像 Moonlight、像 Windows VM、像路由器，甚至像我的硬體還不夠。等我把那些都查過一遍，最後才發現官方 App 自己一直留著沒有結束的狀態。

這次先把 heartbeat 拿掉，也把原本的長 thread 封存。

接下來如果它再卡，我不會再重啟 Wi-Fi。

我會先看是哪一個應該結束的東西，還活著。
