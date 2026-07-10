# 同一個白色方塊，兩個 AI 看見的是不同問題

EdgeLink 最近在做 Android 通知轉送。

我想要的效果很單純：LINE、Facebook 的通知第一次在 Mac 右上角跳出來時，要保留 Android 原本的圖示；進到 macOS 通知中心之後，左邊則顯示 EdgeLink 自己的 logo。

結果第一次跳出的圖示修好了，通知中心裡卻一直是一個白色方塊。

Codex 一開始查到 Android 11 之後的 package visibility。EdgeLink 沒有權限讀其他 App 的 application icon，所以送到 Mac 的 `iconPngBase64` 根本是空的。補上 `QUERY_ALL_PACKAGES` 之後，LINE、Facebook、Easy Wallet 的彩色圖示都拿得到了。

這一段是對的。

Mac 右上角第一次跳出的通知，後來也改成 EdgeLink 自己畫的 toast。Android 傳來什麼圖示，它就顯示什麼。這一段也真的能跑。

麻煩從通知中心開始。

Codex 先試 `UNNotificationAttachment`，沒用。接著去碰私有的 `UNNotificationIcon`，試過 Data、Path、`iconForApplicationURL`。指向 `/Applications/LINE.app` 時，通知中心真的出現了彩色 LINE logo；指向 EdgeLink 自己卻還是白色方塊。

從這裡開始，它被自己的成功帶走了。

既然 LINE.app 可以，它就認為答案一定在 App bundle identity。後面開始建立 icon helper App，補 `Info.plist`、`AppIcon.icns`、`Assets.car`、LaunchServices 註冊、ad-hoc signing、Apple Development signing。還測過拿掉 `LSUIElement`，啟動時再把 App 改成 `.accessory`；也換過新的 notification request identifier，想排除舊通知的快取。

每一步都有 build，每一步都有截圖，每一步看起來都像在接近答案。

通知中心還是白色方塊。

我後來叫它先停，回退到上一版。不要再替每個 Android package 建代理 App，也不要再加新的 helper。我請它把需求、做過的測試、看到的現象整理成一份 prompt，拿去給其他 AI 看。

Claude 看的是同一個問題，但它第一個查的不是通知 API。

它去看 LaunchServices。

系統裡的 `com.edgelink.mac` 當時有四筆 App 紀錄。一筆在 `/Applications`，有完整圖示；一筆在新的 `/private/tmp/edgelink-derived-data`，也正常；另外幾筆是舊的 DerivedData 和 debug build，其中一筆連 `Resources` 都沒有。

通知系統的 `NOTIFICATION#MW4GWYGX56:com.edgelink.mac`，剛好綁在那筆沒有圖示資源的紀錄上。

這個細節一出來，前面的畫面突然都對得上了。

macOS 通知中心不是從通知內容裡拿寄件者圖示。`usernoted` 和 NotificationCenter 會先用 bundle ID 找 LaunchServices 的 App 紀錄，再交給 IconServices。它找到的是壞掉的 debug 副本，畫出來當然只剩白色方塊。

而且 EdgeLink 的 `CFBundleVersion` 一直是 1。IconServices 用 App identity 和版本做快取，branding 加進去之後版本沒有變，那個空白結果也一直沒有理由失效。

Claude 取消註冊三份舊 debug 副本，重新註冊 `/Applications/EdgeLinkMac.app`，再重啟 `usernoted` 和 NotificationCenter。

沒有改通知程式碼。

我從 Android 發了一則測試通知。通知中心左邊終於出現 EdgeLink 的 logo。

最荒謬的證據，其實早就在 Codex 自己的 build log 裡。每次 `xcodebuild` 結尾都寫得很清楚：

```text
RegisterWithLaunchServices /tmp/edgelink-derived-data/Build/Products/Debug/EdgeLinkMac.app
lsregister -f -R -trusted /tmp/edgelink-derived-data/Build/Products/Debug/EdgeLinkMac.app
```

Codex 不只沒有把這行當成線索，後面每重建一次，就再把同 bundle ID 的 tmp build 註冊一次。

這不是它沒看到 log。它看到了，只是當時的問題框法裡沒有 LaunchServices，所以那兩行只是 build 成功前的背景雜訊。

後來還有第二個改法。

我原本想讓通知中心直接顯示 LINE、Facebook 的 Android 圖示。Codex 之前一直把這件事理解成「替換發文 App 的 icon」，所以只在 UserNotifications 和 App bundle 裡找。

Claude 建議走 Apple 的 Communication Notification：用帶 `INImage` 的 `INPerson` 當成發送者，建立 `INSendMessageIntent`，再讓 `UNNotificationContent` 呼叫 `updating(from:)`。加上 communication entitlement 和 `NSUserActivityTypes` 之後，通知中心就能把 Android App 圖示當成 sender image 顯示。

它沒有硬換 App icon。它換了表示方法。

同一個畫面需求，一個 AI 看到的是「App icon 要怎麼改」，另一個看到的是「這張圖可以用哪一種 sender identity 放進通知」。差別不在記得多少 API，而是怎麼命名眼前的問題。

我後來直接問 Codex：為什麼你當初沒有提到？

它回頭看紀錄後承認，自己把搜尋範圍畫得太窄。查 Apple 文件時只沿著 UserNotifications 和 attachment 往下找，沒有把 Intents 拉進來；`iconForApplicationURL` 指向 LINE 成功後，又讓它更相信 App bundle identity 才是唯一方向。

這次讓我重新確認，多一個 AI 的價值不是多一票。

如果兩個模型都只在同一個假設裡投票，數量沒有用。真正有用的是第二個來源願意重新命名問題，把原本被當成背景雜訊的那行 log 拉到最前面。

我也不能只看一個 agent 做了多少事。它可以 build 十次、產十張截圖、寫一堆看起來合理的解釋。我要看的還是那個白色方塊有沒有消失，還有每一輪測試到底改變了什麼判斷。

修好之後，我講了一句很直覺的話：

「所以，多一個來源還是有效的嘛。多個意見。」

現在看，我還是這樣想。
