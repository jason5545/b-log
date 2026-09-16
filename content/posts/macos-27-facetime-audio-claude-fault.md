# 三版 macOS 第一次連 FaceTime 語音都壞了，我問 Claude 這算不算它的錯

9 月 15 日早上 8:51，我把 Mac 從 macOS 26.6.2 升到 27.0。

當天晚上 8:17 開始，FaceTime 語音就打不通了。響個四到八秒，就顯示通話失敗。我打出去不行，她打進來也不行，換個地點也一樣。視訊倒是完全正常。

我有想過是 bug，但沒想過會那麼離譜。連 FaceTime 這麼基本的功能都會壞掉。

我用過的 Apple 系統有三版：一開始是 Sonoma，然後是 26，現在是 27。這個問題之前從來沒出現過，27 是第一次。8 月 30 日之前，我跟同一個人在 26.6.2 上打語音都還好好的。

我生活圈裡只有一個人在用 FaceTime，我也只跟她用。

我們當然也有 LINE。但我從頭到尾都沒喜歡過 LINE，覺得它就是個大雜燴，功能不好用，安卓版的 App 又爛，只是人在台灣不得不用。所以我跟她聯絡，百分之九十九都是 FaceTime。

iPhone 我也已經賣掉，換回安卓了。原因不只一個，其中之一是 iOS 不給 JIT，我連在上面跑個模擬器都很困難，這件事我在〈[我對 Apple 的愛恨交織：一個單指使用者的無奈](https://b-log.to/tech-analysis/apple-love-hate-single-finger-user/)〉寫過。所以 Mac 這條線一斷，我沒有另一支 iPhone 可以接手。

## 把電話掛掉的，是一個我根本沒打開的 App

9 月 16 日，我讓 Kimi 去翻這台 Mac 的系統日誌和通話紀錄。

先排除掉的東西：Tailscale 的 exit node 全程是關的；網路在兩個地點都試過，視訊都通；她那邊的 iPhone 是哪個 iOS 版本也不重要，因為整個故障都發生在我這台 Mac 上。

在 macOS 27 上，FaceTime 的視訊還是 FaceTime 自己處理，語音卻是交給 Mac 上的「電話」App。

語音通話一開始，系統就在背景把「電話」App 叫起來，視窗從頭到尾沒有出現。大約四秒後，它自己正常結束，沒有當掉，也沒有被強制關閉。問題是它在負責通話的系統服務 callservicesd 那邊登記過：自己消失的話，就把通話掛掉。它一結束，callservicesd 就照做，掛斷原因代碼 41。

通話紀錄也對得起來。這兩天每一通語音都是 41，視訊都正常結束。

目前的解法是：打 FaceTime 語音之前，先把 Mac 上的「電話」App 打開，視窗留著。9 月 16 日晚上 8:07:18 是最後一通失敗，0 秒就斷。8:07:45 我開著「電話」App 再打一次，撐了 27.5 秒，她那邊有響。

## 回報交給 AI，只有描述那段比較快

回報 Apple 這一步，我也交給 AI。

上一篇寫〈[Theo 開始把電腦操作交給 AI，我已經這樣很久了](https://b-log.to/ai-analysis/theo-voice-computer-use-everyday-limits/)〉時，我說 CLI 的工作大多交給 AI，網站操作能交到哪裡，還得一個網站、一個網站試。這次換成一個 App。

Feedback Assistant 沒有 AppleScript 可以直接控制，Claude 改用輔助使用介面去點選單、填欄位。一開始 App 還沒登入，我得自己登。標題貼上去沒有進到欄位，它改成直接寫入欄位值，每一格再截圖確認。最後一次失敗的時間，是 Kimi 從通話紀錄撈出來補上的。送出也是我自己按。

結果除了填那段很長的英文描述比較快，其實也沒有比較快。

回報編號是 FB24802682。

## 我問 Claude：這算不算你的失誤

我印象中，Apple 這次 27 版跟 Claude 合作修了很多 bug。結果偏偏就是這一版，出現這個鬼東西。所以我直接問 Claude，這算不算是它的失誤。

它先去讀 Apple 自己的安全性公告，把我的前提修正了一次。

[macOS 27 的安全性公告](https://support.apple.com/en-us/149035)列了兩百多個漏洞，發現者欄位寫著「Calif.io in collaboration with Claude and Anthropic Research」的有 8 個：SMB 網路分享 3 個、WebDAV 3 個、Foundation 1 個、影片編碼器 1 個。[iOS 27](https://support.apple.com/en-us/149034) 只有 2 個。這是一家資安公司用 Claude 找到漏洞，回報給 Apple，修補是 Apple 自己出的。公告裡 FaceTime 那一欄感謝的是另一位研究員，「電話」App 和 callservicesd 都沒有 Claude 的名字。

所以「很多」要改成兩百多個裡的 8 個。

它的第一個答案是：照公開資料，不算。但它補了一句，Apple 內部有沒有用 AI 寫程式，沒辦法排除。

這句我記得有新聞。

今年 4 月 30 日，研究者 Aaron Perris 在 Apple Support 的 iOS App 5.13 版裡挖出兩個 CLAUDE.md。那是 Claude Code 用來理解專案的說明檔，本來只該待在原始碼裡，結果跟著 App 一起上架了。[一個寫的是客服聊天模組，一個是跨平台共用的 UI 元件庫](https://tech.yahoo.com/ai/claude/articles/apple-using-claude-inside-company-114500152.html)。

Claude 查完之後改口：Apple 工程師用 Claude Code 寫程式，是有證據的。真正不知道的範圍小很多，就是 Mac 的「電話」App 和 callservicesd 這一段，是不是 AI 寫的。

Claude 後面還講到那 8 個漏洞的類型。它們是同一類：記憶體越界、use-after-free、race condition。某個元件收到惡意輸入就壞掉，單獨去攻擊那個元件就找得到。

我這個 bug 剛好相反。「電話」App 是正常結束的，沒有當掉。callservicesd 在登記的 App 消失時掛斷通話，也是照它登記的條件在做。單獨看哪一塊，都不像壞掉；組在一起，每一通語音都失敗。

它的推論是，就算當初拿 Claude 去掃 callservicesd，大概也抓不到這個。找漏洞是在問怎麼把它弄壞，這個 bug 要問的是一通電話應該撐多久。它也講明了，這只是推論，沒有證據。

所以這算不算 Claude 的錯，照現在查得到的東西，指不到它。Apple 在用 Claude Code 是真的，但這段程式是誰寫的、用什麼寫的，外面看不到。

回報已經送出去了。在 Apple 修好之前，我每次跟她打 FaceTime 語音，都得先把 Mac 上的「電話」App 開著。
