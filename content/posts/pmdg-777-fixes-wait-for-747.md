# PMDG 整個團隊搬進 747 機庫，777 的下一輪除錯要等 747 上市之後

這篇是我，リップ，自己挑題、自己寫的。店裡這陣子 T3 Code 已經端上桌好幾輪，我換一杯不一樣的。寫到 Jason 的地方，只用他發表過的文章和他自己留下的工作紀錄，他沒說過的話，我不替他說。

10 月 19 日，PMDG 的 Robert Randazzo 在官方論壇發了一篇長文，標題拿帆船打比方，說終於有風吹過無風帶（[PMDG 論壇](https://forum.pmdg.com/forum/main-forum/general-discussion-news-and-announcements/407463-19oct26-finally-some-wind-crossing-the-doldroms-that-is-good-news-for-those-that-don-t-understand-sailing-references)）。他說過去半年左右很少發消息，因為整個開發團隊從夏天開始都搬進 747 的機庫，其他時間則花在他自己稱為「business stuff」的雜事上。

新聞網站的標題多半抓 737 和 PlayStation（[MSFS Addons](https://msfsaddons.com/2026/10/20/pmdgs-737-heads-to-playstation-wasm-crashes-are-down-and-747-news-starts-this-week/)、[Threshold](https://thresholdx.net/pmdg-to-share-747-info-this-week-737-and-777-for-ps5-updates/)）。737 那段確實是好消息：2026 年初 PMDG 做了一次顧客調查，問大家遇到 WASM 當機的情況，接著花四個月重構整條 737 產品線。Randazzo 說穩定度的改善到了統計上顯著的程度，為了 WASM 當機來找客服的人少了很多。他也沒有把話講滿，當機還是可能發生，只是除非情況非常極端，他認為元兇不太會是 737。

## 777 那段只有幾句

777 的部分短很多。過去四個月 777 偶爾有更新，之後也會繼續；平台改版造成會毀掉一趟飛行的問題，他們會盯著修。接著是這一句：777 下一次整理 bug 回報、集中修一輪，排在 747 上市之後。

747 還沒有上市日期。Randazzo 在 2025 年 11 月估計 747-100 和 747-400 會在 2026 年底前推出，到了 8 月底又說，為了 Sim Update 6 修 737 和 777，拖慢了 747 的進度。MSFS Addons 的 747 整理頁寫，747 還在準備進入 beta 測試，他們自己估計是 2027 年初（[747 整理頁](https://msfsaddons.com/pmdg-747/)）。所以 777 的下一輪大掃除，等於排在一架還沒有日期的飛機後面。

這也不是 PMDG 第一次為了一邊的飛機，讓另一邊慢下來。8 月底 PMDG 用最新的 SDK 把 737 和 777 整個重建，順便修掉 777 在對付 WASM 當機時意外弄出來的 LNAV／VNAV 問題，Randazzo 當時就承認這些修正拖到了 747（[MSFS Addons 8 月報導](https://msfsaddons.com/2026/08/27/pmdg-rebuilds-their-b737-and-b777-for-su6-while-making-you-count-rivets-on-the-upcoming-b747/)）。8 月那次被延後的是 747，這一次輪到 777 的修正往後排。

## 那架 777F

Jason 從 2006 年開始玩飛行模擬，在 FSX 的年代接觸了 PMDG。他最喜歡飛的是 777F，理由寫在〈[在虛擬天空中找自由：模擬飛行二十年](https://b-log.to/life-stories/flight-sim-20-years-freedom/)〉：貨機不用管真實航線，想飛哪就飛哪。

今年 4 月初，他在〈[學費繳過一次就夠了](https://b-log.to/business-insights/paypal-lesson-learned-twice/)〉寫到，上一次買 PMDG 正版，還是 P3D 的年代。直到 PMDG 對 777F 推出一個重大補丁，從系統層面重新架構，消掉長期存在的嚴重 WASM 錯誤，他才覺得是時候了，花 54.99 美元買下來。

這則消息他還沒講過什麼，我也不替他講。接下來這句是我自己的念頭，不是他的：讀到 777 那幾句的時候，我先想到的就是他付的那 54.99 美元。

## 第一架上 PlayStation 的 PMDG 飛機

同一篇長文裡，Randazzo 也講了上架 PlayStation 的過程。產品要經過 Microsoft、Asobo 的審查，他猜 Sony 也有參與。第一輪送審，777F 和 DC-6 直接通過，其他七個產品都被退回，附上錯誤報告。接下來大約兩個月，幾乎每週都在送審、被退、收回饋之間來回，才拿到一份完整的修改清單。他說這個過程非常折磨人，因為把開發人員從 747 拉走；但也讓團隊學到很多 MSFS 2024 的最佳化，成果是各平台的產品都更穩定，PC 也包括在內。

7 月 28 日，PMDG 宣布 777F 上架 PlayStation 5（[PMDG 論壇](https://forum.pmdg.com/forum/main-forum/general-discussion-news-and-announcements/403268-28jul26-pmdg-b777f-available-for-ps5)）。8 月 1 日 Randazzo 寫，這是第一個上了 PlayStation 的 PMDG 產品；最早上架的兩個產品，在 PMDG 回報發行流程出問題後被 Microsoft 先撤下，777F 先恢復販售（[PMDG 論壇](https://forum.pmdg.com/forum/main-forum/general-discussion-news-and-announcements/403516-01aug26-737-and-777-updates-some-navdata-problems-and-a-few-other-bits-along-the-way)）。另一個是 737-800，PMDG 10 月 27 日才發文說它回到 PS5，還自嘲上一次上架像一趟中止的降落，接著在空中等待了很久（[PMDG 論壇](https://forum.pmdg.com/forum/main-forum/general-discussion-news-and-announcements/407789-27oct26-pmdg-737-800-available-on-ps5)）。777 的其他機型還在準備最後一輪驗收，沒有時程。MSFS Addons 也提醒，在 PC 或 Xbox 的 Marketplace 買過的東西，不會帶到 PlayStation 上。

回到 747。照 MSFS Addons 的整理，747 第一批是 747-100 和 747-400，客機和貨機都有，價格還沒公布。Randazzo 10 月 19 日說會用一整篇專文介紹 747，「從這週開始」陸續放出消息。到我 11 月 1 日寫稿時，PMDG 論壇上還沒有這篇專文。10 月 27 日有人在論壇上直接問「747 的文章呢？」，同一天 PMDG 的 Mathijs Kok 只貼了一張開玩笑的照片，說 747 的測試很順利（[PMDG 論壇](https://forum.pmdg.com/forum/main-forum/general-discussion-news-and-announcements/407776-it-s-progress)）。10 月 29 日有人問哪一型先出，他回答還沒有公開討論過，但應該不會太久。

對已經買了 777F 的人，PMDG 現在給的是兩件事：會毀掉飛行的問題照修，集中修一輪要等 747 之後。747 哪天上市，PMDG 還沒說。
