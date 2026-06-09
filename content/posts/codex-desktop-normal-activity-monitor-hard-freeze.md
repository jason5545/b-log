# Activity Monitor 明明正常，Codex Desktop 卻把整台 Mac 卡死

第一次發生的時候，我還能替它找理由。

那時候用的是基本版 M5。工作量大、thread 很長，loading 太重，卡住雖然不合理，但至少還有一個可以說服自己的方向：硬體撐不住。

後來我換成 M5 Max，18 核心 CPU、40 核心 GPU、128GB 記憶體。這已經不是「再升級一點看看」的問題了。往上沒有東西可以換。

結果同樣的事情又發生一次。

全部都不動，連鍵盤、連滑鼠，什麼都不動。連大小寫燈都不會動了。Moonlight 也一起斷掉。不是某個 App 顯示彩球，也不是桌面還活著、只有視窗點不動。

整台 Mac 直接死掉。

最怪的是，事件發生前 Activity Monitor 看起來正常。

macOS 應該會有個資源耗盡的提示窗吧？但是現在的情況是完全沒有，是直接卡死。沒有記憶體壓力衝紅，沒有哪個 process 明顯吃完整台機器，也沒有 macOS 常見的「系統已耗盡應用程式記憶體」提示。什麼都沒有，就直接死掉。

有的人會問我那你怎麼不換更頂的？反正要換更頂的也沒有東西可以換了。

## 我們先查了所有看起來比較合理的東西

一開始我也沒有直接把問題算在 Codex Desktop 身上。

Moonlight 斷線，看起來像網路。於是我們重啟 Wi-Fi、升級路由器韌體、查轉發、查 Tailscale、查 Windows VM，也查過影像串流那條資料路徑有沒有問題。

這些方向都不是亂猜。之前 Moonlight 的本地 IP 黑畫面，最後真的查到 Windows VM 的 VirtIO／NIC offload 路徑。網路、VM、UDP 串流，本來就可能讓遠端桌面看起來像整台機器掛掉。

但這次不一樣。

遠端畫面斷掉的同時，本機滑鼠和鍵盤也死了。Caps Lock 沒反應，代表問題已經不是 Moonlight 能解釋的範圍。

而且只要關掉 Codex Desktop，其他東西就恢復正常。

這個對照開始讓前面那些網路檢查變得很尷尬。我們繞了那麼大一圈，結果最後真正會改變結果的動作，是不要開官方 App。

我只是覺得有夠無奈。之前為了這個重啟 Wi-Fi、升級路由器韌體，查系統參數，查 Windows VM 有沒有問題，查轉發有沒有問題。繞了那麼多圈，原來問題是在你這邊。

## T3 Code 跑得穩，問題就留在官方 Desktop 這一層

我後來先改用 T3 Code。

你只是一個 app server 的 UI 而已吧？這很奇怪。T3 Code 也不是把 Codex 整個換掉。它仍然透過 `codex app-server` 工作，只是沒有走官方 Desktop 的同一套介面、renderer 與 Computer Use helper 路徑。

用了一陣子之後，問題沒有再出現。

這不能告訴我官方 App 裡到底是哪一段有問題，但範圍已經小很多了。Codex 後端照樣在跑，Mac 卻沒有再卡死。

Mac 沒換，工作內容也沒換，`app-server` 還是照常在跑。換掉官方 Desktop shell 之後就穩定了。接下來要查的，自然是官方 App 額外帶進來的 renderer、長 thread 狀態、Computer Use helper，還有它們怎麼跟 macOS 的圖形與輸入系統互動。

我原本只是想找一個暫時能用的替代 UI，結果它變成最有價值的 A/B test。

## Activity Monitor 為什麼會看起來正常

我現在比較確定的，是這次不像一般的「資源總量用完」。

如果只是記憶體不夠，我預期在 128GB 被吃完以前，Activity Monitor 會先看到記憶體壓力、swap 或單一 process 的明顯變化，macOS 也通常會跳出資源耗盡提示。這次什麼都沒有。

但鎖死 renderer、WindowServer、輸入事件或某個系統服務，不一定需要把所有 CPU 和記憶體吃滿。

一條 event loop 忙等、一段高頻 IPC、一個 process 不斷留下 helper、或圖形與輸入路徑互相等住，都可能讓「使用者能不能操作」先壞掉。Activity Monitor 顯示的是取樣到的 CPU、記憶體與 process 狀態，它不會直接告訴你滑鼠事件是不是還能走到桌面，也不會替你證明 WindowServer 與 HID 路徑沒有卡住。

所以「Activity Monitor 正常」和「整台機器不能操作」並不矛盾。

它只證明這不像單純的記憶體耗盡。

## 後來又多了一個線索：heartbeat 一直叫醒同一條長 thread

原本我們把 10 小時以上的 CPU 與 lag 全部算在 Codex Desktop 身上。

後來整理 CWP09 的監控流程時，才發現還有一個很可能的放大器。

那個監控原本是一個 heartbeat automation。它每小時叫醒同一條 Codex thread，檢查 Box 裡有沒有新的檔案。這個動作持續了好幾天。

那段期間有個很明顯的訊號：Speedometer 3.1 跑起來大概只有 1fps。瀏覽器效能測試欸，不是什麼重度 3D 渲染，1fps。

那條 thread 最後的 rollout JSONL 已經大約 143MB，有 14,713 筆紀錄，裡面還出現大量 compaction 相關內容。最後一次喚醒，在幾分鐘內又產生約 3.7MB 的 log traffic。

這不是一個每小時「看一下就走」的工作。

每一次 heartbeat 都是在重新喚醒一條已經非常長、壓縮過很多次、帶著大量工具狀態的 thread。只要 Desktop 對長 thread 的 retention、renderer 更新或 log tracing 有問題，這個 automation 就會每小時再推它一次。

OpenAI 的公開 issue 也有很接近的現象：

- [#21134](https://github.com/openai/codex/issues/21134)：長時間活躍的 thread 讓 app-server CPU、記憶體與 `logs_2.sqlite` 持續增長。
- [#20735](https://github.com/openai/codex/issues/20735)：Desktop 使用一段時間後，即使沒有明顯工作，CPU 仍然維持在高點。
- [#20435](https://github.com/openai/codex/issues/20435)：renderer 持續吃 CPU，但後端 process 幾乎是 idle，重啟 renderer 後才恢復。

這三個 issue 沒有證明我的 hard freeze 就是同一個 bug，但它們把 10 小時後越來越慢的那一段解釋得很合理。

至少可以確認，其他人也在官方 App 裡遇到長時間執行、長 thread 與 renderer 空轉。我的 heartbeat 又每小時把同一條超長 thread 叫醒一次，剛好一直把它往那個方向推。

## 採樣後，比 Activity Monitor 多看到幾件事

我們做了一個一次性採樣器，不常駐，也不再用 Codex automation 監控 Codex 自己。

在這次調查還活躍時，process list 裡有 7 個 app-server、6 組 `SkyComputerUseClient` 與 `node_repl` helper。還有一個 `turn-ended` process 已經活了超過 41 小時。

兩次取樣之間，renderer 合計 CPU 從 4.6% 跳到 24.6%；主 app-server 約 17% 到 18%。同一分鐘內，websocket response trace 寫入約 2.3MB 到 2.9MB。

這些數字沒有大到讓 128GB Mac 必然當機。

這些數字至少讓我看到：畫面上沒有工作，Desktop 裡面還是有東西持續累積。Activity Monitor 如果只看總 CPU，很容易把 7 個 app-server、6 組 helper、renderer 波動與大量 trace 當成「還好」。

我現在在意的是它們到底會活多久、會不會越留越多。下一次 Computer Use 或長 thread wake-up 進來時，renderer、helper 與 macOS 輸入路徑會不會又一起卡住，這才是要繼續抓的地方。

## 現在把兩個問題分開看

我目前不會把所有現象硬塞進同一個答案。

10 小時後越來越 lag，比較像 Desktop 的長 session 問題，被每小時 heartbeat 與超長 thread 放大。

整台 Mac 的滑鼠、鍵盤、Caps Lock、Moonlight 同時失效，嚴重程度更高。這一段比較接近 Computer Use、WindowServer、HID 或圖形路徑。移除 heartbeat 也許會降低發生機率，但還不能說 hard freeze 已經找到原因。

兩件事也可能接在一起：長 thread 與 helper 先累積，下一次 Computer Use 或圖形事件才把整台機器推到不能操作。現在沒有足夠證據把這條因果寫死，所以我會分成兩條繼續看。

## 我把 heartbeat 從 Codex thread 裡拿掉了

新的監控不再叫醒任何 Codex thread。

現在是 launchd 每小時啟動一次 Python：掃一次 Box，寫一份很小的 JSON 與文字狀態，然後退出。它不做 employer sync、不產生 package、不刪檔、不 git push，也不在記憶體裡留到下一個小時。

舊的長 thread 已經封存。

Codex Desktop 當然還沒有修好。我只是先拿掉一個確定會持續加熱的來源，讓後面的觀察有意義。

接下來看兩條線就夠了。

先看那條 143MB thread 不再被喚醒之後，renderer、app-server、log growth 和十小時後的 lag 有沒有穩住。這一段改善，heartbeat 的放大效果就很明顯。

另一條是完全不碰那條 thread，Computer Use helper 還會不會繼續累積，甚至再次造成整機輸入失效。這個現象如果還在，問題就仍然留在官方 Desktop 的 helper 與 macOS 整合路徑。

## 硬體到頂，也清不掉沒結束的 process

買 M5 Max 的時候，我本來就預期這類工作不該再因為硬體不夠而卡住。

現在看來，我一開始把方向想錯了。之前用基本版 M5，我還能說 loading 對基本版來說太重了所以才卡。但 M5 Max 也發生第二次，這已經不是 loading 太重而已。

硬體可以讓同樣的錯誤晚一點出現，但它不會替長 thread 設上限，不會清掉 41 小時前該結束的 process，也不會讓一個每小時醒來的 automation 突然知道自己應該是無狀態的。

我只是覺得有夠無奈。

我們之前為了這個重啟 Wi-Fi、升級路由器韌體，查系統參數，查 Windows VM，查轉發。結果繞了那麼多圈，原來問題是在你這邊。最後看到的卻是官方 App 裡真的留著一堆早該結束的 process，而且只要關掉 App，其他東西就恢復正常。

這次先把 heartbeat 拿掉，也把原本的長 thread 封存。

接下來如果它再卡，我不會再重啟 Wi-Fi。

我會先看是哪一個應該結束的東西，還活著。
