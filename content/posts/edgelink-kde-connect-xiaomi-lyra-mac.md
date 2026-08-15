# 來電在 Mac 接、鏡像用 Touch ID 解鎖：我花了五週寫一個會說小米 Lyra 的 KDE Connect

手機丟在房間另一頭充電。電話響了，Mac 螢幕上跳出通話視窗，戴上耳機直接接，講完繼續打字。要傳檔案給手機，選單列點一下；要看手機畫面，鏡像開起來，畫面是活的，可以直接操作，鎖定了就按 Touch ID 遠端解鎖。Mac 上跳出的通知，手機那邊也有一份。剪貼簿兩邊是同一個。

這些都不是小米官方 Mac app 在做的事。是我過去五個星期自己寫的。

專案叫 EdgeLink。

## 為什麼要自己寫

起點很實際。我除了頭部以上和右手食指，其他部位沒辦法當成穩定的輸入來源。我大部分時間在 Mac 前，手機不一定在我伸手可及的地方。這對多數人是偶爾的不方便，對我不是多伸一次手而已，是工作流真的會斷。

KDE Connect 那種「電腦和手機互相接住」的概念我喜歡很久了，但它進不了小米的生態；小米自己的互聯服務在 Mac 上能做的有限，而且有些功能是被協議層擋死的，不是還沒做。

最具體的例子是通話。官方 Mac app 對手機登記的裝置類型是 14，而手機 TeleService 的 `RelayServiceFilterUtils` 會把 type 14 直接過濾掉。也就是說，官方 Mac 端永遠等不到電話接力，這是寫死在小米手機裡的規則。

EdgeLink 的解法很直接：登記成 type 4（Windows PC），電話就來了。

## Lyra：乾淨房間裡問出來的協議

整個專案是 clean-room 實作。沒有抄任何小米或 KDE Connect 的原始碼，反組譯的產物只留在本機研究目錄，不進 repo。協議是用三種方式問出來的：tcpdump 抓 pcap、jadx 反編譯手機裡的系統 app，加上一次一次的實機實驗。每一個主張都要有證據，密碼學行為另外寫成可重現的 test vectors 放在文件裡。

系統分三塊：Mac 選單列 app、Android 端、一個 Cloudflare Worker。Worker 用 Durable Objects 做配對 rendezvous 和轉送，它是盲的，看不到任何內容，因為每條 transport 上面都是自己的端對端加密（P-256 key agreement、HKDF-SHA256、AES-256-GCM）。同一個網段走 LAN 直連，不在同網段就走 relay，功能不變。

小米裝置之間的互聯協議，內部叫 Lyra。從 mDNS（`_lyra-mdns._udp.local.`）找到彼此之後，下面是 KCP over UDP 的 mesh transport，往上是實體連線、邏輯連線、keepalive、服務宣告，再上面還有 miexpress 的 TLV framing 和通道加密。檔案快傳的 request、response、completion、file stream 就住在這層通道裡，雙向都通了。

最花時間的是信任層。Mac 按 Touch ID 之後往下送 562 事件，手機跑自己的 mitrust ceremony，中間有 `auth_token_A`（TLV 打包、per-peer 的 RSA-2048 簽章）、TDIF 配對狀態、KeyAgree fallback。這一段我 debug 最久，同一個「解鎖失敗 code=1」至少挖出四種不同根本原因：relay 斷線殺掉 in-flight 的 auth wait、閒置自動釋放留下的 zombie channel、手機把通道建立在錯的 transport 上，還有 redial 卡死後 authEvent 落空。每一種都修到有 pcap 或 log 證據才動手，修完就變成測試案例。

鏡像是 HEVC 一路從手機 encoder 到 Mac 的 VideoToolbox。卡頓修過好幾輪，最後幾個根本原因都不在顯眼的地方：自寫 KCP 在 sender 來得及補洞前就宣告 loss，還有重建風暴。我也查過 HyperOS 在亮度 0 和 1 停編碼這條路，後來確認它不是根本原因，只是一路走過的坑。通話音訊後來也走通 native 路徑，DTMF、IVR 都驗過。

通知和剪貼簿是另外兩塊拼圖。macOS 沒有跨 app 的通知 listener，這是系統邊界；我用 non-sandbox helper 讀 usernoted 的 SQLite DB，代價是要給 Full Disk Access，然後只鏡射真正顯示過的通知，用 UUID 去重。剪貼簿做到歷史視窗、縮圖、大檔分塊傳送，SQLite 加 LRU 回收。

## 五週 380 個 commit

從 7 月 8 日第一個 commit 到今天，380 個。能這樣推進，是因為測試在前面擋：Mac 端有完整測試套件，Android 端跑 `gradlew test`，鏡像另外有 E2E harness，用 mock 的手機角色重現各種怪行為：channel 建錯 transport、authEvent 逾時、redial 卡死。每個修掉的 bug 都留下對應的測試。沒有這層，五週只能寫 demo，寫不出能每天用的東西。

現在這整套是我的日常。手機在不在身邊，不影響我接到電話、傳檔、看畫面。

最大的收穫其實很具體：市面上每個互聯工具對我來說都是黑箱，這一個不是。每個 byte 走哪條路、誰看得到、誰看不到，我都有答案。封閉協議的牆沒有想像中那麼高，一個 packet 一個 packet 問它問題，它最後會回答。
