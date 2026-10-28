# 我算是新手嗎？給 T3 Code 送了兩個 PR，第二個先被 Theo 合併了

10 月 27 日晚上 6 點 48 分，Theo 合併了我送給 T3 Code 上游的第二個 PR，[#25841](https://github.com/pingdotgg/t3code/pull/25841)。這是我第一個被合併進別人專案的程式碼修正，在這之前，我被合併過的 5 個 PR 全是翻譯。

前一天傍晚，我送出第一個 PR 之後，問了 Claude Code 一句：「我算是新手嗎？」

T3 Code 是 Theo 那邊做的開放原始碼介面，也是我現在每天派工的主要工具，跑的是我自己 fork 的版本（怎麼換過來的，[10 月 18 日那篇](https://b-log.to/ai-analysis/anthropic-agents-waiting-t3code-server/)寫過）。這兩個 PR 修的，都是我日常用到時碰上的問題。

## 第一個 PR：先問有沒有人報過

10 月 26 日我碰到的是 web 版的 bug。T3 Code 判斷一條對話能不能壓縮的時候，只看目前載入的那一頁歷史。代理開的對話，或是最後一輪很長的對話，第一頁常常一則使用者訊息都沒有，web 就以為沒有東西可以壓。伺服器看的是完整歷史，手動打 `/compact` 照樣壓得動，上游自己的手機版也早就把沒載入的歷史算進去，只有 web 漏掉。我的 fork 當天下午 4 點先修好、部署了。

接著我先問 Claude Code：最新的這個 bug 值不值得開 issue？上游有人開過嗎，或是已經修了？它查的結果是，上游最新的 main 還沒修，用六組關鍵字搜上游的 issue 和 PR，也沒有人報過。

再來是 vouch。我當時說，PR 需要 vouch，我願意，可是我可以嗎？「如果有一天能夠被 Theo 認同，我會很高興。」查了上游的貢獻規則才知道，vouch 標籤只是背景資訊，不是開 PR 的門檻，有沒有被 vouch，都一樣要過 triage。到 10 月 28 日早上，標著 `vouch:unvouched` 的 PR 已經合併 1,592 個，沒合併就關掉的有 5,442 個。

要截圖的時候，畫面上找不到壓縮按鈕所在的那個圓形用量指示。Claude Code 還在讀程式碼，我先問了一句：「Let me guess. Legacy?」答案是對的，那個指示屬於 legacy 功能，要手動開啟才會出現。往下查之後才發現，這個 bug 真正影響的是預設就開著的功能：Claude 對話閒置一段時間再回來，送出鍵旁邊本來會出現「Compact next」，提議先壓縮，免得下一則訊息把整段歷史重送一遍。碰到這個 bug 的對話，這個提議永遠不會出現，PR 裡拿來驗證的那條對話有 456k tokens 的歷史。PR 的重點因此從「一個 legacy 按鈕被停用」，改成「預設功能悄悄失效」。

送出去的 PR 只動 web 端那一個判斷，規則直接照上游手機版。PR 加了三個測試，其中一個在上游原版上真的會失敗；跟這次修改無關的測試失敗，說明裡照實寫了；截圖只裁出輸入框，沒有放我的對話內容。程式是 Claude Code 寫的，PR 最後也寫明了。

我會處理得這麼小心，是因為這個專案真的不錯，才值得我這樣處理。我也跟 Claude Code 說，我一直都很小心，你知道吧？看 Theo 的影片也看很久了，知道他的個性。然後我才問了那句，我算是新手嗎。

## 「新手」要看什麼

Claude Code 回答，如果「新手」指的是會不會自己敲出這段 diff，我算比較接近；如果指的是知不知道該修什麼、怎麼證明修對了、什麼不該送，就不算。它說，這個 PR 能不能過，主要看的是後者。我自己說過的弱項是手寫程式碼，要靠 AI 把需求轉成程式碼，但我看得懂、能除錯，也能檢查。

我另外說過，要看新手，得看我整個 GitHub 的活躍度，不只是這個案子。帳號是 2013 年開的。每年的貢獻數（含私人 repo）是：2019 年 36、2021 年 46、2022 年 40、2023 年 73，2024 年 387，2025 年 2,093，2026 年到 10 月 28 日早上是 5,658。送給別人專案的 PR 一共 20 個，合併 6 個，其中 5 個是翻譯（2019 到 2025 年），第 6 個就是 #25841。

今年送出去的有三個專案：HyperCeiler 1 個，8 月送的，還開著；DroidDeck 3 個，都已經關了；T3 Code 2 個。DroidDeck 的翻譯那個（#208）怎麼收場，[10 月 9 日那篇](https://b-log.to/dev-philosophy/patchmd-reinventing-wheel/)寫過。另外兩個是我自己關的，觸控那個（#241）是我追到原因之後關掉的：Steam 會照每款遊戲 appinfo 裡的設定挑觸控模式，這是正牌 Steam Deck 本來的行為。我的判斷是，上游會想跟著 Steam 正確的行為，而不是為了我一個人去強制把觸控開啟。

## 第二個 PR：下午先停的是我自己的 T3

10 月 27 日下午 1 點 27 分，上游合併了另一位貢獻者的 #21074，把 Cursor 的 SDK（`@cursor/sdk`）升到 1.0.38。新版把 `zod` 從自己帶的套件改成要使用的程式自己裝，上游桌面版的打包流程只會帶伺服器自己列出的外部套件，伺服器沒列 `zod`，所以它沒有被打包進去。

我的 fork 下午同步了上游。4 點 11 分，Mac 上的 T3 後端一啟動就掛，錯誤是 `Cannot find module 'zod/v4'`，連續重試 12 次後放棄。我平常就是在 T3 裡面跟 Claude Code 講話，等於工作台本身停了。4 點 18 分，Claude Code 在 `apps/server/package.json` 加了一行 `zod`，重建、重裝，恢復，前後 7 分鐘。

修好之後，Claude Code 去查上游：已發布的 v0.1.3 正式版和當時最新的 nightly，都是在 #21074 之前建的，還沒有使用者受影響，下一個從 main 建的 nightly 才會是第一個中的。上游也沒有人回報過。它提了三個選項：只開 issue、開 issue 加送 PR、不回報。我只回了一個字：「B」。

5 點 01 分，issue [#25840](https://github.com/pingdotgg/t3code/issues/25840) 和 PR 一起送出，issue 裡我也寫了，下一個從 main 建的 nightly 會是第一個帶到的。這次 PR 除了那一行，還多一個測試。上游的 AGENTS.md 規定，邏輯、資料、狀態這類 bug 的修正，要先有一個在 main 上會失敗的測試，所以我們加了一個，檢查打包進去的套件需要的 peer dependency 有沒有一起打包。這個測試在上游 main 上，剛好只抓到 `@cursor/sdk -> zod` 這一筆。

送出後幾分鐘，兩個審查機器人先留了言。Macroscope 標 Approved，但它自己註明只看資格、沒看程式碼；CodeRabbit 說沒有要修的地方，合併風險 Minimal。真正的 CI 在 5 點 02 分排進去，卻一直停在等放行。

## Theo 手上有兩個一樣的修正

6 點 18 分，Theo 手動觸發發版，6 點 31 分左右，nightly 3766（`0.1.4-nightly.20261027.3766`）發布。它包含 #21074，就是我下午在 issue 裡寫的那一版。Mac 版自動更新之後，T3 Code 的視窗出不來，後端大約每 10 秒重啟一次，每次都掛。我自己的 Mac 跑的是 fork，下午 4 點 18 分就修好了，沒有受到影響。

6 點 38 分和 6 點 43 分，兩位使用者先後在 #25840 底下回報，一位是 macOS 27.0，一位是 27.2，錯誤訊息和我寫的一樣。第一位直接寫了「#25841 should fix it」，也給了暫時的解法：重裝前一版 nightly。6 點 46 分，Theo 在 issue 回了「on it」。

6 點 47 分，Theo 開了自己的 PR [#25890](https://github.com/pingdotgg/t3code/pull/25890)，改法跟 #25841 一樣，只有加依賴那一行。他在說明裡寫：「Same fix as #25841 by @jason5545, which also adds a regression test. This PR is only the dependency change, from a branch in this repo so CI runs now.」下一秒，#25841 那個從下午 5 點就停在等放行的 CI 開始跑了。6 點 48 分，Theo 合併 #25841，issue 同時關閉。合併的時候 CI 還在跑，6 點 52 分才全部通過。

6 點 55 分，Theo 關掉自己的 #25890，留言：「Superseded by #25841, which landed the same fix plus a regression test.」6 點 57 分，修好的 nightly 3770 發布，打包的就是 #25841 的合併 commit。3766 之後從 Releases 頁面下架。從第一位使用者回報到修好的版本發布，19 分鐘。

Theo 在 #25841 底下沒有留言。他對這個 PR 說的話，就是上面那兩句。

上游接著補了幾道檢查：macOS 打包後也要確認伺服器能自己啟動（[#25900](https://github.com/pingdotgg/t3code/pull/25900)），伺服器起不來時桌面版改成跳出視窗（[#25903](https://github.com/pingdotgg/t3code/pull/25903)），發版前真的把打包好的 app 打開、點一條對話（[#25928](https://github.com/pingdotgg/t3code/pull/25928)）。這些是別人和 Theo 做的，不是我，只是它們的說明裡都引用了這次的 issue 或 #25841。

#25841 合併的時候，還標著 `vouch:unvouched`，我也不在 VOUCHED 名單上。第一個 PR [#25445](https://github.com/pingdotgg/t3code/pull/25445) 還開著，維護者還沒有回應。

10 月 26 日我說過，如果有一天能夠被 Theo 認同，我會很高興。Theo 合併了我的 PR，留下的就是那兩句話。看到結果之後，我想的是：至少，這是一個開始。雖然只是很小的一步，但這一步已經走出去了。

