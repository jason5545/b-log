# Windows 11 終於把單指捲動放回觸控板設定，至少有進展了

微軟公告附的設定截圖裡，Drag two fingers to scroll 下面多了一列 Single-finger scrolling，右邊的下拉選單寫著 Right Side。

選項有三個：Disabled、Left Side、Right Side。位置在「設定 → 藍牙與裝置 → 觸控板」，展開「捲動與縮放」就看得到。

微軟的說明只有一句：手指從觸控板左側或右側開始滑，就能用一根手指垂直捲動。

去年 11 月，我寫了〈[當「現代化」成為無障礙的退步：精確式觸控板取消邊緣捲動功能](https://b-log.to/business-insights/modernization-vs-accessibility/)〉，抱怨精確式觸控板把邊緣捲動拿掉了。那篇問過一句：「留著一個 checkbox 很難嗎？」

幾天後，我自己用 C# 寫了 [Touchpad Advanced Tool](https://b-log.to/tech-development/touchpad-advanced-tool/)。今年 1 月換到 Mac，又寫了一個 [TrackPal](https://b-log.to/tech-development/touchpal/)。

微軟這邊，[5 月 8 日](https://blogs.windows.com/windows-insider/2026/05/08/announcing-new-builds-for-8-may-2026/)先在 Experimental 通道的 Build 26300.8376 放進來，[9 月 10 日](https://blogs.windows.com/windows-insider/2026/09/10/announcing-windows-11-release-preview-builds-26100-9539-26200-9539/)進到 Release Preview（24H2 是 26100.9539，25H2 是 26200.9539）。目前還是分批推送，升級到這個版本也不一定看得到。

結果不是 checkbox，是下拉選單，還可以選左邊或右邊。

## 它放在哪裡

它就在「捲動與縮放」裡，跟雙指捲動、捲動速度排在同一區。微軟 5 月的公告把它和捲動速度、加速捲動寫在同一段觸控板更新，這段沒有用到「無障礙」這個詞。

去年那篇我抱怨的是，無障礙部門在做得獎的新產品，觸控板這邊卻把基本功能拿掉，兩邊好像沒在溝通。這次加回來的，是觸控板設定本身。

## 我自己寫的時候卡過的兩件事

第一件是方向。

微軟寫的是垂直捲動，只有左右兩側。水平捲動，公告沒有提。

這跟我在 Mac 上反編譯 Scroll2 看到的一樣，邊緣只定義了 `leftEdge` 和 `rightEdge`。我自己的兩個工具都有做水平捲動：Windows 版可以把上緣或下緣設成水平捲動區，TrackPal 是手指放在底部邊緣左右滑。

第二件是誤判。

[Neowin 的 Ivan Jenic 在 9/16 寫了實測](https://www.neowin.net/reports/you-can-scroll-with-one-finger-in-windows-11-but-it-feels-awkward/)。他想捲動，常常變成只有游標在動。游標還可能跑出他要捲的那個視窗，他得把游標找回來、移回視窗上，再試一次。

這個我很熟。寫 TrackPal 的時候我遇過同樣的狀況，想捲動，系統判定成移動游標，再試一次還是一樣。我後來加了意圖判斷和重試偵測：被拒絕之後一兩秒內在同一個邊緣再做類似的動作，系統就稍微放寬門檻。

用兩根手指的人碰到誤判，換回雙指就好。只有一根手指的人沒得換，每重來一次，都要先把游標找回來，移回視窗上，再滑一次。

## 誰會用這個功能

Neowin 那篇最後說，大家用雙指捲動用了這麼多年，他不確定這個功能會有多少人用。

這個判斷的前提是讀者有兩根手指可以用。需要單指捲動的人，沒有雙指的肌肉記憶要改。

同一批更新還有 Automatic scrolling：捲動時手指碰到觸控板上緣或下緣，頁面會繼續捲，不用抬起手指重來。Neowin 說這個反而順。單指在邊緣滑，很快就會滑到底，這個設定剛好補在那裡。

## 還沒完整的地方

微軟 5 月的公告寫著，用 WinUI 3 做的介面要等 Windows App SDK 1.8 和 2.0 更新，才會完整支援這批新手勢。微軟自家新框架寫的 App，暫時不一定完整。

去年我問的是一個 checkbox。今年 9 月，Release Preview 裡有了一個下拉選單，還在分批推。

就差水平捲動和右鍵了。Windows 現在的單指右鍵，要把觸控板右下角按下去；我的 Windows 版是在角落輕點一下就好。誤判的部分，我是在自己的工具裡處理的，微軟這版還沒看到。

至少有進展了。

封面是微軟 [5 月 8 日公告](https://blogs.windows.com/windows-insider/2026/05/08/announcing-new-builds-for-8-may-2026/)附的設定畫面。
