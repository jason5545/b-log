# 每一關都是綠的，Google 錢包還是說我 Root：兇手是 recovery 順手弄丟的 AVB footer

裝置是 myron，POCO F8 Ultra / Redmi K90 Pro Max（25102PCBEG），Snapdragon 8 Elite Gen 5。ROM 是 xiaomi.eu，從 OS3.0.306 升到 OS3.0.308，bootloader 用 ABL 的手段回鎖，KSU Next 是偽裝版本。

症狀只有一個：Google 錢包加卡，最後一步跳出「這部裝置無法設定感應支付功能」，理由是「裝置已啟用 Root 權限，或執行了未經認證的軟體」。

問題是，其他每一關都是綠的：

- Play 商店裝置認證：通過
- Play Integrity：STRONG
- Key integrity：STRONG
- Bootloader 狀態：系統判定已回鎖，verified boot green
- 各種 root 偵測軟體：全 clean

如果某一關不過，我還知道要去哪裡修。每關都過、只有錢包不過，這才是最煩的。

## 錢包根本不看 Play Integrity

先把錢包和 Play services 從手機拉出來拆。

Wallet APK（`com.google.android.apps.walletnfcrel`）裡面跟 attestation 有關的東西其實很少，只有 `GetLastAttestationResultRequest` / `GetLastAttestationResultResponse` 這種 IPC stub。它只是跟 GMS 要結果，自己不做偵測。

真正的偵測在 GMS（`com.google.android.gms` 26.26.34）的 tapandpay 模組。加卡的流程是：

1. GMS 先向 Google server 拿一個 nonce
2. 呼叫 DroidGuard，flow 名稱 `tapandpay_attestation`
3. DroidGuard 的 native 引擎在 GMS 自己的 process 裡掃描環境，產生加密的 snapshot
4. snapshot 連同 `Build.FINGERPRINT` 送 server，server 回 verdict
5. verdict 是 fail 就 log `Device fails attestation`，並把結果快取在 `TapAndPayServiceStorage.xml` 的 `last_attestation_result=false`

關鍵在第二步。這條路跟 Play Integrity API 是完全獨立的兩條線。Play 商店那個「裝置認證通過」走的是 Play Integrity；錢包加卡走的是 DroidGuard 的支付級 attestation。兩邊的 verdict 互不參考。

所以「Play Integrity 都 STRONG 了為什麼錢包還說我 root」這個問題，本身就是問錯的。錢包從來沒看過那個 STRONG。

## 排除法：不是快取、不是帳號、不是 ROM

接下來是一連串排除。

**不是快取。** 把 GMS 的 `last_attestation_result` 刪掉、force-stop GMS，它重啟後自動重跑一次 attestation，幾秒鐘內 server 又回 fail，新的失敗結果馬上寫回快取。完全可重現。

**不是帳號。** 306 的時候我也遇過一次類似的狀況，那時候換個 Google 帳號就好了。這次換了沒用。

**不是 ROM。** 手邊剛好有 306 和 308 的 ROM，把兩邊的 super 解開、各 partition 的 build.prop 抽出來對。結果兩版結構完全一樣：system 都是 missi 通用映像、vendor 都是 mivendor、build id 都是 `BQ2A.250705.001-BP2A.250605.031.A3` 這種兩個平台版本串在一起的寫法，build.host 都是 xiaomi.eu。只有版本號不同。306 能過的結構，308 沒有道理不能過。

到這裡，裝置端「看起來」能查的都乾淨。當時下的結論是：server 端風控，可能是這台裝置被標記了，只能等。

這個結論是錯的。

## 修好之後，才有資格找根本原因

後來我自己想到一件事：KSU 當初不是用官方 APK patch 的，是刷機的時候順手用 OrangeFox Recovery 內建的 KernelSU Next 選項裝的。

而且官方管理器 APK 裝完之後，其實警告過「這個 IMG 有問題」。我當時只按了「重新修補」，修補完介面一切正常，就沒再管。

這次從 ROM 裡提取原版 init_boot，用官方 APK 重新 patch，再刷一次。

錢包馬上就好了。

好了之後回頭拆，才看到根本原因。把原版 init_boot.img 拆開：

```text
magic ANDROID!, header_version 4
kernel_size = 0
ramdisk_size = 2917002
ramdisk 結尾對齊後 offset 2924544: "AVB0"   ← vbmeta header
檔案最後 64 bytes: "AVBf"                   ← AVB footer
```

myron 的原版 init_boot 不是單純的 boot image。ramdisk 後面還接著一段 AVB 的 vbmeta 和 footer，是 chained 結構，整個映像鋪到 8MB。

再看 OrangeFox 那個安裝選項做了什麼。它的 `KernelSU_Next_Installer.zip` 裡的腳本很簡單，就是呼叫 recovery 內建的 ksud：

```sh
ksud boot-patch --module $FNAME --flash
```

問題在這個 ksud。它是 `3.2.1-mm-cn-z`，不是官方版本。翻它的字串，boot-patch 的實作是走外部 magiskboot：

```text
magiskboot unpack failed
magiskboot repack failed
```

而且整支二進位裡找不到任何 `AVBf` 的處理。

magiskboot 的 repack 只輸出 header + kernel + ramdisk。原版映像後面那段 vbmeta 和 footer，它根本不認得，也不會寫回去。

所以 OrangeFox patch 出來的 init_boot，AVB footer 整段被丟掉。

官方 KernelSU-Next 走的是另一條路。它的 boot_patch 用的是 `android_bootimg` 這個 Rust crate，parser 會讀出 avb_info，patcher 在重打包時會把 vbmeta 和 footer 寫回去，順便更新裡面的 size 欄位（patcher.rs 312-339）。

這也解釋了為什麼官方 APK 的「重新修補」救不了。官方的修補是「parse 當前的 image → 換 ramdisk → repack」。footer 已經被 magiskboot 丟掉了，parse 的時候就沒有這個東西，repack 當然也不會憑空長回來。介面顯示正常，是因為 ramdisk 裡的 init 和 kernelsu.ko 換成官方的了；但 image 尾部的結構缺損，修補不會碰。

只有從原版 image 重新 patch，footer 才會被完整保留下來。

## 為什麼能開機、為什麼全綠

這裡是整件事最陰險的地方。

footer 被丟掉的 init_boot，照理說 locked bootloader 應該拒絕開機。但我這台的回鎖方式不會強制驗證 init_boot 那條鏈，所以照開。

Play Integrity 也照過，因為它檢查的是 vbmeta 層的簽章和 locked 狀態，那層是好的。

於是形成一個很詭異的狀態：bootloader 說 green、Play Integrity 說 STRONG、手機正常開機正常使用，但 init_boot 的 chained 結構其實是缺的。Google 的支付級 attestation 看的就是這種東西。

能開機，不代表結構完整。每一盞綠燈，只證明它負責檢查的那一層沒問題。

## 為什麼 AI 查了那麼久，沒想到這一邊

最後這段值得記。

這次排查大半是我跟 AI 一起做的。它拆 APK 很快、實驗設計也合理，但結論卡在「server 端風控」。事後我問它為什麼沒想到 boot image 這邊，它的回答整理起來是四個失誤：

一是過早接受「server 是黑箱」。追到 DroidGuard 就認定本地無從驗證，停止挖裝置端的證據。但 server 判的是本地送出去的東西，它沒有去檢查送出去的東西本身。

二是錯誤消去。306 和 308 的 ROM 同構，它就直接跳到「ROM 無罪，所以是裝置標記」。消去的是錯的變數。真正的變數不是 ROM，是 boot chain 的結構。

三是把綠燈當完整。locked + green 只證明 vbmeta 層驗證通過，不證明 init_boot 結構完整。它把「驗證通過」誤讀成「沒被動過」。

四是沒有早點問安裝方式。「KSU 怎麼裝的？」這個問題如果第一輪就問，OrangeFox 內建 patch、magiskboot、footer 丟失這條鏈會直接浮現。

還有一個它不知道的：官方 APK 早就警告過「IMG 有問題」。那個警告就是結構異常的直接證據，我當時按了修補就放著了。

所以這次真正的教訓不是「不要用 recovery 內建 patch」。是當 attestation 全過、但某一關死都不過的時候，該懷疑的是「過的那些關，檢查的是不是同一個東西」，然後去拆 artifact 本身，而不是繼續在 runtime 狀態裡打轉。

runtime 會說謊。image 不會。
