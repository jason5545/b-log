# 正牌的 Xbox Nano，在 Mac 上還不如一支假裝成 Xbox 手把的副廠

11 月 13 日，我的 Xbox Nano 控制器到了。這是微軟 11 月 4 日上市的手把，Xbox 到目前為止最小的一支，臺灣定價 1,599 元。我買它，一半是因為小，一半是因為它是正牌。我原本想的是，微軟自己出的小手把，體驗總該比第三方好。

用下來，好像不是這樣。

在它之前，我用的是良值（IINE）的復古卡片無線連發手把，型號 L1032。它也是一支小手把，接到 Mac 上用的是 Xbox 模式，會把自己假裝成一支 Xbox One 手把。所以這兩支在我的 Mac 上，系統看到的都是 Xbox 手把，只是其中一支是裝的。

良值有自己的 App。我在 Android 上用它改按鍵，除了截圖、C（連發）和 Home 這三顆功能鍵，其他鍵都能改。改好的設定存在手把裡，接回 Mac 照樣有效，Mac 這邊什麼都不用裝。

Nano 的[產品頁](https://www.xbox.com/en-US/accessories/controllers/xbox-nano-controller)寫的是「Make the controller your own by customizing button mapping with the XBOX Accessories app」，還特別介紹正面那顆可以程式化的 Action Button。問題是 Xbox Accessories 只有 Windows 和 Xbox 主機上有。我在 Mac 上用藍牙接 Nano，按下 Action Button，什麼訊號都沒有送出來，macOS 內建的遊戲控制器設定也就改不到它。Mac 上也還沒有人做過 Nano 的設定工具。CNET 的評測者用的是 MacBook Pro 和 iPhone，他也寫了 Action Button 只能用 PC 版的 Xbox Accessories 設定，因為他沒有 PC，所以沒辦法測（[CNET 評測](https://www.cnet.com/tech/gaming/xbox-nano-controller-review/)）。

微軟不是不會把設定存在手把裡。Elite 無線控制器 Series 2 的[產品頁](https://www.xbox.com/en-US/accessories/controllers/elite-wireless-controller-series-2)寫得很清楚，手把上可以存 3 組自訂設定檔加 1 組預設，用 Profile 鍵切換。但 Elite 在美國賣 199.99 美元，同一頁的註腳還寫著，按鍵映射和設定檔只能在 Xbox Series X|S、Xbox One 和 Windows 10／11 上設定。良值在一支網路上賣 811 元的手把上，就讓我在 Android 改、拿到 Mac 用。

搖桿也是。Nano 的雙搖桿比標準版 Xbox 手把小，4Gamers 的[開箱](https://www.4gamers.com.tw/news/detail/83258/xbox-nano-controller-unboxing)也提到這點。小手把配小搖桿，聽起來好像理所當然，但 L1032 的機身一樣小，搖桿照樣做得很大，用的還是霍爾搖桿。Reddit 上有一篇長評說，搖桿是 Nano 整支最弱的地方，也不是霍爾或 TMR 搖桿，而這在同價位的小手把幾乎已經是基本配備（[r/gaming 討論串](https://www.reddit.com/r/gaming/comments/1xpjqiz/xbox_nano_maybe_the_last_unique_microsoft/)）。

更新韌體又是另一件事。Nano 的韌體更新，官方只給兩條路：Windows 上的 Xbox Accessories，或 Xbox 主機。我沒有主機，就把手把直通進 Proxmox 上的 Windows 虛擬機，結果 Xbox Accessories 根本看不到它。負責更新的 XboxAccessoriesService 沒有裝，Windows Update 不推，Microsoft Update Catalog 也搜不到。連在微軟自己的 Windows 上都走不通。最後是回到 Mac，用開放原始碼的 [xboxctl](https://github.com/bb441db/xboxctl) 更新，它對 Nano 的支援還在一個沒合併的 PR 裡。韌體從 6.9.444.0 升到 6.19.50.0，總算是更新完了。

公平地說，Nano 也有贏的地方。按鍵品質好一點，按起來有 Xbox 的手感；它也比較輕，4Gamers 標 99g，L1032 這款是 133g。但也就這樣子了。

電池是另一回事。最後讓我按下訂單的，是看到有人說它的電池可以用兩個禮拜。但 Xbox 的產品頁根本沒寫續航。官方自己不寫，買的人就只能聽別人說。零售商和開箱多半標最多 5 小時，我自己用起來也覺得掉得很快。那個兩個禮拜是哪裡來的，我後來查不到出處。

再把價格放在一起看：Nano 定價 1,599 元，L1032 現在網路上賣 811 元，差不多是兩倍。同樣的價錢，甚至更便宜，第三方做得出來的東西，原廠為什麼做不出來？這是我最想不通的地方。我猜微軟根本不打算讓這支手把離開 Xbox。

我應該還是會繼續用 Nano。只是我覺得微軟這個邏輯很奇怪。既然要進來這個市場，就應該出一個打趴第三方的東西，結果在我的 Mac 上，它連一支假裝成它的副廠都打不過。

這支叫 Xbox Nano。在我的 Mac 上，我比較想問它：「Xbox なの？」
