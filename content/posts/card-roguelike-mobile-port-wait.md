# 卡牌 roguelike 明明最適合手機，官方手機版卻總要等一兩年以上

10/5，我開始自己做一個 Diceomancer 的網頁版，包成 APK 裝在手機上，只給自己玩。我以為這款遊戲等不到手機版：做它的 Ultra Piggy Studio 很小、名氣也不大，Steam 上最後一則更新公告停在 2025 年 4 月。結果 10/9，發行商 Gamirror 宣布 iOS 和 Android 版 2027 年 1 月 12 日上市。PC 版是 2024 年 10 月出的，等於手機版要晚兩年三個月。

卡牌遊戲最適合在手機上玩。回合制，一局不長，所有操作都是點，沒有一步要求反應速度。可是查了幾款同類型的遊戲，手機版幾乎都晚很久：

- Slay the Spire：PC 2019 年 1 月，iOS 2020 年 6 月，Android 2021 年 2 月。
- Dicey Dungeons：PC 2019 年 8 月，手機版原本目標 2020 年，延到 2022 年 7 月。
- Monster Train：PC 2020 年 5 月，iOS 2022 年 10 月，Android 2025 年 5 月。
- Astrea: Six-Sided Oracles：PC 2023 年 9 月，主機 2024 年 9 月，手機 2025 年 7 月。
- Balatro：PC 2024 年 2 月，手機 2024 年 9 月。
- Diceomancer：PC 2024 年 10 月，手機 2027 年 1 月。
- Monster Train 2：PC 2025 年 5 月，手機版到現在沒有公布。

大部分落在一年半到三年。Android 有時又比 iOS 晚，Slay the Spire 晚了八個月，Monster Train 晚了兩年半。Astrea 和 Dicey Dungeons 都是先出主機版，手機排在後面。Balatro 是例外，七個月就上手機，觸控操作重新做過，iOS 版上市當天就進了 Apple Arcade。

Balatro 還有一段插曲。PC 版上市不到一個月，就有玩家在 GitHub 開了 [Balatro Mobile Maker](https://github.com/blake502/balatro-mobile-maker)，把自己 Steam 上買的那份轉成手機 app，3 月 22 日發了第一版，比官方手機版早了半年。能這麼快，是因為 Balatro 用的 LÖVE 引擎本來就能跨平台。

GitHub 上類似的專案不少，而且官方手機版出了也擋不住。Slay the Spire 的官方手機版當年上市就沒有模組，今年 2 月還是有人開了 [SlayTheAmethyst](https://github.com/ModinMobileSTS/SlayTheAmethystModded)，讓 Android 也能跑桌面版的模組，到現在有 420 顆星。也有人做了一個包裝過的 APK，只為了能匯出 Slay the Spire 手機版的存檔。

Slay the Spire 2 更快。它今年 3 月 5 日開搶先體驗，官方手機版連時程都還沒有，一週後 GitHub 上就出現第一個 Android 啟動器。現在更新最勤的是 [Sts2MobileLauncher](https://github.com/ModinMobileSTS/Sts2MobileLauncher)，做 SlayTheAmethyst 的同一群人開的：匯入自己買的 PC 版，就能在 Android 上跑，模組和 Steam 雲端存檔都支援，手機操作也另外調過，到現在有 463 顆星。它不是靠轉譯硬跑。Slay the Spire 2 改用 Godot 引擎，Godot 本來就有 Android 版，遊戲檔直接拿來用，只補上 PC 跟手機不相容的地方。

這類專案多半出現在引擎好搬的遊戲上，Balatro 是 LÖVE，Slay the Spire 是 Java，Slay the Spire 2 是 Godot。我做 Diceomancer 也是同一個念頭，只給自己玩，但 Unity 遊戲沒辦法這樣直接轉，只能一個畫面一個畫面重做。

還有一條路是不移植，直接在手機上跑 PC 版。[DroidDeck](https://github.com/Droid-Deck/DroidDeck) 把 Proton 搬到 Android 上，Monster Train 2、Slay the Spire 2 都跑得動。在 PC 上，Proton 已經在取代 Linux 原生版：Last Epoch 2024 年拿掉原生 Linux 版，直接請玩家改用 Proton，說體驗好得多；Big Ambitions、Prodeus、The Falconeer 也都停了原生版，只支援 Proton。手機就不一樣了，轉譯的負擔還是太重：手機會燙、很耗電，FPS 掉得很誇張，PC 的介面縮到手機螢幕上，字也小到很難看清楚。所以在手機上，原生版還是有它的必要。

為什麼要這麼久？網路上最常見的說法是介面。Loop Hero 的手機版交給移植公司 Playdigious 做，原版很多操作靠滑鼠懸停和拖放，手機版的介面整個改成觸控。Slay the Spire 剛上手機時，也有評論說 iPhone 上的字和介面都很小、拖牌不順手，雲端存檔也還沒有。可是它晚了一年多才上手機，介面還是沒怎麼為手機調整，時間看起來不是花在介面上。

我自己做過一遍，覺得至少這類遊戲，介面不是拖兩三年的原因。觸控和手機版面，我從開始做到能用不到兩天：滑鼠停 0.2 秒才會跳的說明改成長按，拖牌出牌改成點牌再點敵人，手牌放大 1.25 倍，手機比 16:9 寬就把介面推到兩側，教學裡 11 句鍵盤滑鼠的說法改成觸控。原版的版面一格都沒重新設計。這類遊戲的卡片和按鈕本來就大，回合制也不怕手指點不準。

不過這只是我自己一支手機能玩的程度。官方要做的事多得多：各種機型都要測，觸控手感要找人試玩、反覆調，還要過商店審核、要定價。這些加起來可能要幾週到幾個月，但很難花到兩三年。

直向又是另一回事。這篇發出的同一天，我開始讓 Diceomancer 在手機直拿時也能玩，一樣只用原版的元件和美術，重新擺位置。觸控那次版面一格都不用動，直向卻是每個畫面都要重排。光是戰鬥和地圖就卡了好幾處：敵人的意圖面板掛在身體右邊，要一隻一隻量出身體、意圖和血條佔多大，再重新排；出牌區擺得太靠右，直拿時會跑到畫面外；地圖的捲動範圍照 16:9 算，左右兩端各有一段捲不到。商店、百科、牌組檢視都還沒開始動。

所以官方手機版大多只做橫向，我不意外。Balatro 是上手機最快的一款，2024 年 11 月有玩家在 App Store 評論要直向，開發團隊回覆還在研究怎麼讓遊戲在直向下能玩；我查到的資料，到 2025 年底還是只有橫向。Slay the Spire 的手機版介面也是照橫向調的。想直拿著玩，又是社群自己來，Balatro 就有人做了 [直向 MOD](https://github.com/beiklive/balatro-portrait-mobile)。我想官方不做，一次重排多少畫面還在其次，麻煩的是之後每次更新、每個 DLC 都要多做一份直向，測試也要多一份。我做得下去，是因為 Diceomancer 已經一年半沒有更新，我不用追版本，也只要我自己的手機能玩就好。

開發者自己講的原因，比較接近排序。Mega Crit 在 2019 年底把 Slay the Spire 手機版延到隔年，說想多花時間做 QA；他們也提到，先出的主機版已經把會影響手機版的引擎工作大多做完了，手機排在主機後面。iOS 版出了之後，Android 版又等了八個月。那段時間他們的更新公告先是寫還在跟移植團隊改手機操作，後來變成在等發行商和移植團隊的消息，從頭到尾沒提過盜版或機型。今年談到 Slay the Spire 2，Casey Yano 說觸控支援要等他們開始推手機版才會做，小團隊每週重新排優先順序。可是我用 DroidDeck 在手機上跑 Slay the Spire 2，觸控操作沒什麼問題，只有字太小。

所以拖這麼久，我覺得主要是排序和人力，這部分是我的推論。小工作室上市後通常先做 PC 版的更新和 DLC，再做主機版，手機版排在最後，常常要等發行商願意投資才會開始。Diceomancer 的核心成員有一部分已經去做新遊戲 Groove Core，手機版是發行商宣布的。

回頭看我當初的判斷，只對了一半。Diceomancer 會有手機版，這點我猜錯了，而且它在我開工後第四天就宣布了。「官方移植要等很久」這點倒是沒錯。手機版上架那天我會去買，當作支持；在那之前，我還是玩自己那一版。

Monster Train 2 上市一年多，手機版還是沒有消息。
