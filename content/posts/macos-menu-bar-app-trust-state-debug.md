# 我以為在修 BLE，最後是在確認 macOS 到底信不信這個 app

我一開始以為這只是把 EmulStick 的 BLE forwarding 接到 macOS。

掃描、連線、AES 驗證、寫 HID report。Android 版已經有一條路，macOS 版照著協定補起來，應該就能跑。

後來時間主要耗在 macOS。

BLE 很誠實。能寫就是能寫，不能寫就回錯。真正麻煩的是 macOS：System Settings 顯示已經授權，程式卻還是拿不到權限；menu bar 顯示 grabbed，event tap 卻說 released；裝置看起來連上了，但 mode 還停在上一個狀態。

這種問題最討厭的地方，是它看起來像已經好了。

相關背景：[Unified Remote Evo - 從遙控器到多功能輸入裝置的開發之旅](https://b-log.to/tech-development/unified-remote-evo-development-journey/)

## AES 過了，但 F80F 不能寫

最早的 log 是這樣：

```text
AES sent
warn write f80f failed
write is not permitted
```

AES 能送，代表連線不是完全壞掉。Device Information 讀得到，cipher request 也走到那一步。真正卡住的是 `F80F` command characteristic 的寫法。

這時候 Android 版很重要。

不是因為 macOS 要照抄 Android，而是 Android 版已經證明 EmulStick 期待哪一種 GATT write。比對後才發現，`F80F` 不能假設 `writeWithResponse` 可用。這條 command path 真正能走的是 `writeWithoutResponse`。

所以第一個修法很小：

withResponse 被拒，就改用 withoutResponse。

修完後，CLI 可以掃到 EmulStick，也可以真的送 mouse move。那個「small down」測試很重要，因為它不是 UI 顯示成功，也不是 log 寫得漂亮，是游標真的動了。

```text
Mouse move sent.
```

這一刻 BLE 主線其實已經活了。

但 app 還沒有。

## CLI 不該偷偷啟動 menu app

我後來加了 CLI：

```bash
UnifiedRemoteEvoMac --cli scan
UnifiedRemoteEvoMac --cli connect
UnifiedRemoteEvoMac --cli move --dx 0 --dy 20
```

這本來是為了讓 device discovery、connection、mouse event 可以單獨測。結果它反而暴露另一個問題：`--cli` 還是會走 SwiftUI app startup。

也就是說，我只是想測 BLE，結果 `AppModel` 被建立，`GlobalInputForwarder` 跟著啟動，macOS 開始跳 Accessibility 權限。

這不是 CLI。

這只是 menu app 順便多收了一個參數。

所以後來把 `@main` 移到新的 entry point，先判斷 `--cli`。如果是 CLI，就只跑 BLE runner，不建立 SwiftUI app，不啟動 event tap，不碰 Accessibility。

這一步很重要。

因為測試不乾淨時，你會一直懷疑錯地方。你以為 BLE 還有問題，其實是另一條 input permission 流程一起進來亂。

## System Settings 的 on，不等於 TCC 的 yes

menu app 真正麻煩的是權限。

System Settings 裡，Accessibility 顯示 `UnifiedRemoteEvoMac` 是 on。Input Monitoring 也看起來有一列。

但同一個 app bundle 裡跑 CLI 查 API：

```text
Bundle ID: com.jason5545.UnifiedRemoteEvo
Accessibility trusted: no
Input Monitoring trusted: no
```

問題出在這裡。

不是「權限還沒開」。
是 UI 說開了，API 說沒有。

看 tccd log 之後，真正的線索出來了：

```text
failed to find an Application URL for bundle ID: com.jason5545.UnifiedRemoteEvo
kLSApplicationNotFoundErr
```

macOS 不是只看畫面上的 app 名稱。TCC 查的是 bundle id、code requirement、LaunchServices 記錄，還有實際 app path。這幾個東西只要沒有對齊，System Settings 上那個 on 就可能只是舊狀態。

畫面上看到的是 `UnifiedRemoteEvoMac`。
真正的 bundle id 是 `com.jason5545.UnifiedRemoteEvo`。
app 在 `/Applications/UnifiedRemoteEvoMac.app`。
中間還有之前測過的 dev bundle id。

看起來都合理，但 TCC 不一定覺得它們是同一個東西。

最後我不是叫使用者再去重開一次開關，而是先把目前 bundle id 的狀態清掉：

```bash
tccutil reset Accessibility com.jason5545.UnifiedRemoteEvo
tccutil reset ListenEvent com.jason5545.UnifiedRemoteEvo
```

然後重新啟動 menu app，讓它自己 request。

這次 System Settings 裡那列變成 off。

這其實是好消息。
那表示它終於不是快取出來的假 on。

## menu bar 沒出現，後來查到 bundle identity 混在一起

這段是後來才真的確認。

那時候最該被相信的，其實是這句話：

```text
our initial push was working
```

這句是對的。

最初那版可用時，app 的 bundle id 是：

```text
com.jason5545.UnifiedRemoteEvoMac
```

後來我為了隔離 menu bar 問題，試過換一個新的 bundle id：

```text
com.jason5545.UnifiedRemoteEvo
```

這個測試本身不是錯。

錯的是，我把它和正式部署、DerivedData 裡的 build product、System Settings 裡的權限狀態混在同一台機器上反覆跑。最後 macOS 看到的是一堆名字都叫 `UnifiedRemoteEvoMac.app` 的東西，但它們不完全是同一個 app。

LaunchServices 裡可以看到好幾份：

```text
/Applications/UnifiedRemoteEvoMac.app
~/Library/Developer/Xcode/DerivedData/.../Release/UnifiedRemoteEvoMac.app
~/Library/Developer/Xcode/DerivedData/.../Debug/UnifiedRemoteEvoMac.app
```

有些是 `com.jason5545.UnifiedRemoteEvoMac`。
有些是 `com.jason5545.UnifiedRemoteEvo`。
還有測試時留下的 probe id。

對 Finder 來說，它們都叫 UnifiedRemoteEvoMac。

但對 macOS 來說，這不是同一件事。

menu extra 的可見性、LaunchServices 的 app URL、TCC 的授權、code signing 的 designated requirement，看的都不是「畫面上那個名字」。它們看的是 bundle id、實際 app path、Team ID、簽章要求，以及系統當下認為哪一份 bundle 才是這個 identity。

所以才會出現很怪的結果。

System Settings 裡那個 toggle 是 on。
但 API 查出來是 no。

SwiftUI `MenuBarExtra` 會被系統送 `NSStatusItemChangeVisibilityAction`，接著 app 沒有其他 window，就自己退出。

改成最小 AppKit `NSStatusItem(title: "EVO")` 之後，process 活著，但 menu bar 還是不顯示。

可是 unbundled 的 `swift -e` 測試可以顯示。

這幾個現象放在一起，我才把 SwiftUI、icon、使用者開關先排掉。

比較像是這個 app identity 在 macOS 裡被我測髒了。

initial push 會動，是因為那時候 identity 還乾淨。後來我一邊修 BLE、一邊加 CLI、一邊改 bundle id、一邊從 DerivedData 和 `/Applications` 交替啟動，macOS 其實已經不確定「UnifiedRemoteEvoMac」到底是哪一份。

這也是為什麼後來不能只叫使用者去 System Settings 再打開一次。

那只是把某一列開成 on。
但真正要修的是：選定一個固定的正式 bundle id，清掉舊身份，讓 `/Applications` 裡那一份成為唯一被系統認得的 app。

## 權限要分兩段要求

menu app 啟動時要自動把自己加進權限清單，但不能一次把 Accessibility 和 Input Monitoring 都丟出去。

實際跑下來，macOS 比較像要這樣：

1. 先 request Accessibility，讓 app 進清單
2. 使用者打開 Accessibility
3. app 偵測到 Accessibility 已經 trusted
4. 再 request Input Monitoring
5. 使用者打開 Input Monitoring
6. event tap 才建立

這裡我加了一個 retry。

不是為了繞過 macOS。app 不能自己幫自己開權限，這是對的。retry 的目的只是不要讓使用者打開開關後還要猜「是不是要重開 app」。

你打開，app 自己看。
看到了，就接下一步。
兩個都 yes，event tap 才起來。

最後 CLI 回：

```text
Accessibility trusted: yes
Input Monitoring trusted: yes
```

到這裡，macOS 才是真的把這個 app 當成被允許的程式。

## Grabbed 不能只相信 UI

後面又遇到一個更小，但更容易讓人不信任 app 的問題。

Grab section 顯示 grabbed。
Status 裡 Input tap 卻顯示：

```text
Forwarding released
```

這種狀態很糟。不是因為功能完全不能用，而是它讓使用者開始懷疑右上角那個 menu bar app 到底有沒有在說真話。

根因是 `@Published` 的 timing。

`grabHotKey.$isGrabbed` sink 收到新值時，如果裡面又去讀 `grabHotKey.isGrabbed`，有機會讀到更新前的值。於是 UI 已經顯示 grabbed，但 AppModel 同步 forwarding 時拿到的是 false。

修法不是加更多 UI 判斷，而是不要在 sink 裡回頭讀 property。

直接用 publisher 傳進來的新值：

```swift
grabHotKey.$isGrabbed
    .sink { [weak self] isGrabbed in
        self?.isInputGrabbed = isGrabbed
        self?.syncForwardingState()
    }
```

這裡表面上改的是 Combine。
我要修的是狀態不要各說各話。

UI 覺得 grabbed、event tap 覺得 released、BLE connection 又是另一個狀態，這種 app 很快就會變成「看起來有在動，但你不知道它現在到底在哪裡」。

## 連上後一定要回到鍵盤滑鼠

EmulStick 可以是 Xbox 360 mode，也可以是 keyboard / mouse composite mode。

我原本以為連線後送一次 KB / Mouse 就夠了。CLI 也讀回成功。

但 menu app 實際用起來，還是會遇到需要手動點 KB / Mouse 才同步的狀況。這代表「送出指令」跟「裝置真的進入那個模式」中間還有一段不可靠。

所以後來改成比較笨、但比較可信的做法：

AES 驗證完成後，延遲送 KB / Mouse，查回 mode。
如果沒有確認到，就重試。
手動點 XInput 或 KB / Mouse，也送完後再查回。

不要只猜它成功。
要讀回來確認。

最後 log 是這樣：

```text
AES 密文驗證成功
BLE 驗證完成，已連線
已送出模式切換指令 VID=0x451 PID=0xe010
查詢目前 EmulStick 模式
目前裝置模式：鍵盤/滑鼠
Connected: EmulStick / mode=鍵盤/滑鼠
```

這才是我想要的狀態。

不是按鈕看起來在 KB / Mouse。
是 EmulStick 自己回報它在 KB / Mouse。

## 最後在確認的是「到底是不是真的」

這趟最花時間的地方，不在 AES，也不在 HID report。

硬體那邊反而很乾脆。Android 版比對一下，補 `writeWithoutResponse` fallback，CLI 測一下，事情就往前走。

麻煩集中在 macOS 這邊。

System Settings 可以顯示 on，但 API 回 no。
menu bar item 可以不是程式畫不出來，而是 visibility state 套在另一個 identity 上。
menu bar 可以顯示 grabbed，但 event tap 是 released。
app 可以連上 EmulStick，但 mode 還沒同步回來。

每一個 bug 單獨看都不大。

但它們會慢慢吃掉信任。

menu bar app 最怕的不是功能少。最怕的是它安靜地站在右上角，然後你不知道它現在到底有沒有真的接管輸入、真的連到裝置、真的在正確模式。

所以後來我才把每一層都補上實際確認。

CLI 確認硬體真的動。
TCC check 確認 macOS 真的信任。
mode query 確認 EmulStick 真的切過去。
AppModel 確認 UI 和 event tap 用同一個狀態。

我不是不能接受它壞掉。

寫這種東西本來就會壞。真正不能接受的是，它壞掉的時候看起來像已經好了。
