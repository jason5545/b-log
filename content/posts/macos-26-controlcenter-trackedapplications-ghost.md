# macOS 26 把 TrackPal 藏起來，問題在 Control Center 的舊記憶

TrackPal 又不見了。

app 沒有 crash。

SwiftUI 也有把 `MenuBarExtra` 放進去。

比較煩的是這種狀況：app 看起來有啟動，bundle id 也對，程式碼沒有明顯錯，System Settings 裡甚至看得到那個 app 的選項。可是右上角就是沒有出現。

這種問題最容易讓人往程式碼裡查。

我一開始也會想，是不是 `MenuBarExtra` 的 `.window` 又在 macOS 26 被改了？是不是 `NSStatusItem` 的 visibility 被 app 自己寫壞？是不是之前修 sudden termination 的地方又有副作用？

後來發現，卡住的是 macOS 自己記住了一份舊的 menu bar allow-list，而且那份記憶比 app 目前的狀態還有力。

## 公開 API 只講到這裡

如果只看 Apple 的公開文件，這件事應該很單純。

[`MenuBarExtra`](https://developer.apple.com/documentation/swiftui/menubarextra) 是 SwiftUI 裡放在系統 menu bar 的 scene。你可以做一個只有 menu bar item 的 utility app，也可以用 `.menuBarExtraStyle(.window)` 做比較複雜的面板。

AppKit 那邊，[`NSStatusItem`](https://developer.apple.com/documentation/appkit/nsstatusitem) 就是一個顯示在系統 menu bar 的項目；[`NSStatusBar`](https://developer.apple.com/documentation/appkit/nsstatusbar) 管理這些 status items。Apple 文件也很早就提醒過，menu bar 空間有限，status item 不保證永遠可用。

照公開 API 看，責任邊界很清楚。

但文件沒有講的是另一層：macOS 26 之後，System Settings 裡那個「Allow in the Menu Bar」狀態，到底被誰記著。

不是只有你的 app。

也不是只有 `defaults read com.your.bundle.id`。

還有 Control Center。

## 舊 app 不會真的離開

我後來查到不少人遇到比較表層的版本：app 刪掉了，但 System Settings > Menu Bar > Allow in the Menu Bar 裡還留著它。

[Ask Different 上有一題](https://apple.stackexchange.com/questions/470374/remove-uninstalled-apps-from-macos-system-settings-menu-bar-allow-in-the-menu)在問這個問題，答案提到的路徑是這個：

```text
~/Library/GroupContainersAlias/group.com.apple.controlcenter/Library/Preferences/group.com.apple.controlcenter.plist
```

我這台機器實際查到的是這條：

```text
~/Library/Group Containers/group.com.apple.controlcenter/Library/Preferences/group.com.apple.controlcenter.plist
```

裡面有一個 `trackedApplications`。麻煩在這裡。

它不是一個好讀的 JSON，不是你打開就能看到「這個 app：允許／不允許」的設定表。它是一段 plist blob，裡面再包一層 app bundle 相關紀錄，還有 `isAllowed` 之類的狀態。

所以你以為自己在改 menu bar。

其實你是在碰 Control Center 自己維護的一份第三方 app 可見性資料庫。

我不是不能接受 macOS 記住這件事。

它當然要記。macOS 如果不記，第三方 menu bar app 每次更新、重裝、換路徑之後都重新冒出來，使用者會更煩。

麻煩的是，我找不到一個明確的 per-app reset。

我想要的其實很小：對單一 bundle id 說，「把這個 app 在 Allow in the Menu Bar 裡的歷史狀態清掉，重新認一次。」

macOS 沒給我這個按鈕。

## TrackPal 這次被舊狀態覆蓋

如果只是刪掉的 app 留在設定裡，那還算煩，但不致命。

TrackPal 這次更麻煩。

它不是「舊 app 留在清單裡」。它是目前這個 app 的 menu bar item 會被舊狀態影響。

我看到的線索包括：

```text
NSStatusItem VisibleCC Item-0 = 0
```

我看到 `VisibleCC` 的時候就停下來了。

`CC` 大概就是 Control Center。它不是單純 app 自己說「我要不要顯示」，而是 Control Center 介入了 status item 的可見性。

後來 [Apple Developer Forums 上也有人貼出很接近的情境](https://developer.apple.com/forums/thread/827337)。

那個案例裡，`MenuBarExtra` app 啟動後，ControlCenter 讀 `trackedApplications`，把 status item host 放進 blocked list，送出 `NSStatusItemChangeVisibilityAction`，最後 visibility 變成 `0`。

更麻煩的是，app 自己的紀錄是 `isAllowed: true`，但另一個被禁止的 app 紀錄裡，卻殘留了指向目前 app 的 menu item location。

結果外來的 blocked record 蓋掉了目前 app 自己的 allowed record。

這就不是「使用者沒打開開關」了。

這是系統把一份舊關係套到新 app 身上。

[Maccy 也有人](https://github.com/p0deje/Maccy/issues/1029)在 macOS 26.0.1 遇到 menu bar icon missing，issue 裡可以看到 `NSStatusItem VisibleCC Item-0`、`Item-1` 這種紀錄。

那不一定跟 TrackPal 是同一個根因。

但至少可以先把一件事釘住：macOS 26 的 menu bar visibility 不是只有 app 端一個開關。

## 最後重設的是 allow-list

這裡最容易做錯的是只刪 app 自己的 defaults。

例如：

```bash
defaults delete com.jasonchien.TrackPal "NSStatusItem VisibleCC Item-0"
```

這可以清掉一個症狀，但不一定清掉來源。

因為真正讓 System Settings 裡「Allow in the Menu Bar」重建的，是 Control Center 那份 `trackedApplications`。

我最後採用的做法比較保守：

1. 先給 Terminal 或工具完整磁碟存取權。
2. 備份 `group.com.apple.controlcenter.plist`。
3. 用 plist parser 只移除外層 `trackedApplications` key。
4. 如果 app 自己 domain 裡有 stale 的 `NSStatusItem VisibleCC Item-0`，再刪掉。
5. 重啟 `cfprefsd`、`ControlCenter`、`SystemUIServer`。

重點是第三步。

不要整個 `com.apple.controlcenter` 亂砍。

也不要用 `defaults delete com.apple.controlcenter` 期待奇蹟。

這裡要做的是讓 Control Center 重新建立第三方 app 的 allow-list。

我當時清掉之後，macOS 自己把 `trackedApplications` 從 90 筆重建成 30 筆。TrackPal 回來了，`com.jasonchien.TrackPal` 變成 `isAllowed: true`，而且 app 自己 defaults 裡那個 `NSStatusItem VisibleCC Item-0 = 0` 不再出現。

這裡讓我改了判斷。

TrackPal 原本有建立 menu bar item。

只是 Control Center 用舊狀態把它按掉。

## 不要把這件事當一般偏好設定

我不太喜歡 macOS 26 這裡的設計。

我不是反對它有狀態。

menu bar 一定要有狀態。

沒有狀態，menu bar 會變成另一種災難。

我不喜歡的是這個狀態太像偏好設定，實際上卻比較像一份半隱藏的信任紀錄。

System Settings 顯示的是一個簡單開關。

背後卻牽到 bundle id、status item identity、Control Center 的 tracked record、app 自己的 defaults、甚至可能還有舊 app 留下來的 menu item location。

壞掉的時候，使用者看到的是「menu bar app 不見」。

開發者第一時間看到的是「我的 SwiftUI / AppKit 寫錯了嗎」。

但真正錯的可能是系統把另一個 app 的舊禁止狀態套到你身上。

這種 bug 最浪費時間。

因為它會讓你一直在自己的程式碼裡找一個不存在的錯。

## 我會怎麼查下一次

下次遇到 macOS 26 menu bar app 不顯示，我不會先改 UI。

我會先確認幾件事：

```bash
defaults read com.your.bundle.id | rg 'NSStatusItem|VisibleCC'
```

看 app 自己 domain 裡有沒有 `NSStatusItem VisibleCC Item-* = 0`。

再看這個檔案：

```text
~/Library/Group Containers/group.com.apple.controlcenter/Library/Preferences/group.com.apple.controlcenter.plist
```

尤其是 `trackedApplications`。

如果 System Settings 裡有一堆刪掉的 app，或某個 app 明明 allowed 卻被送 visibility=0，那就不要只盯著 `MenuBarExtra`。

那條線很可能在 Control Center。

這不是說每次都該刪 `trackedApplications`。這個動作會重設 menu bar allow-list，做之前一定要備份，也要知道自己在碰什麼。

至少下一次我會讓每一層只回答一個問題。

程式碼到底有沒有建立 status item。

app 自己的 `VisibleCC` 有沒有被寫成 0。

Control Center 的 `trackedApplications` 有沒有把舊狀態套回來。

這三個混在一起查，會很痛苦。

## 這次修掉的是 macOS 的舊答案

我之前寫過 TrackPal 在 macOS 26 會因為 `MenuBarExtra` `.window` 觸發 sudden termination。那次是程式碼真的需要補：`setActivationPolicy(.accessory)`，再用 `applicationShouldTerminate` 回 `.terminateCancel`。

那是 app 的問題。

這次不是。

這次 TrackPal 卡住，是因為 macOS 記得一個它不該再相信的舊答案。

它記得某個 item 不該顯示。

它記得某個 app 曾經被禁止。

它甚至可能把別的 app 的禁止紀錄，套到現在這個 app 身上。

修到最後，我沒有再碰 SwiftUI。

AppKit 也沒有重寫。

最後動到的是 Control Center 那份舊記憶。把它清掉之後，系統才重新看一次眼前這個 app。

我不是不能接受 macOS 有這種內部狀態。

真正讓我不舒服的是，它壞掉的時候看起來像你的 app 壞了。

但你的 app 其實只是被系統記錯了。
