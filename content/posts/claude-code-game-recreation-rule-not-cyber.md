# Claude Code 不幫人重做現有遊戲，擋下來的不是 [cyber]，是系統提示詞裡的兩句話

11 月 1 日我在 Claude Code 被擋過一次，錯誤訊息最後掛著一個 `[cyber]`。11 月 2 日早上，我看到 Claude Code 開始不幫人重做現有遊戲的消息。我自己目前沒有遇到，但我第一個想知道的是：這次擋人的，也是 `[cyber]` 嗎？

答案是不是。這次擋下遊戲重製的，是 Claude Code 系統提示詞裡的兩句話。被它擋下時，回覆就是 Claude 自己寫的一段文字，不會出現錯誤訊息，也沒有任何分類標籤。

10 月 30 日下午 3 點（臺灣時間），X 上的 chasm [貼出](https://x.com/chasmmmmmmmmmmm/status/2116062991686721968)一段 Claude Code 設定檔的截圖，說 10 月 27 日前後，Anthropic 從伺服器送來一條新規則，放在一個叫 `tengu_heron_brook` 的欄位裡，使用者這邊沒有設定可以關。規則就兩句：

> Do build original games, games in a genre, and games from the user's own designs and assets. Don't build a recreation of a specific existing game, even if it is renamed or called original.

可以做原創遊戲、某一類玩法的遊戲、用使用者自己的設計和素材做的遊戲；不要重做某一款現有的遊戲，改名或說是原創也一樣。

10 月 31 日凌晨 0 點 58 分，Anthropic 的 Addy Osmani [回覆了這則貼文](https://x.com/addyosmani/status/2116213240363729013)：他們在 Claude Code 跑 Opus 5.5 時的 prompt 加了兩句話，讓它不要重做別人的某一款遊戲，因為拿 Claude 侵犯智慧財產權違反使用政策；原創遊戲、同類型遊戲、用自己設計和素材做的遊戲應該照常可以做；他們會繼續調整，如果 Claude 拒絕了你自己的東西，可以直接找他。Anthropic 發言人回覆媒體時，也是指向這則貼文。官方的 changelog 沒有寫。

## 執行檔裡寫了什麼

我請リップ把 Claude Code 的 npm 套件抓下來，比對 10 月 28 日的 2.1.312、10 月 30 日的 2.1.314 和目前最新的 2.1.316。那兩句話在 2.1.312 裡找不到，從 2.1.314 開始直接寫在執行檔裡，是系統提示詞的一個段落，設定名稱叫 `original_games_guidance`，預設跟著 Opus 5.5 那一組提示詞一起打開。另一條路就是 chasm 截到的 `tengu_heron_brook`：伺服器送來什麼文字，Claude Code 就原樣插進系統提示詞。2.1.312 沒有內建那兩句，但這個欄位早就在了，所以 10 月 27 日前後就能先從伺服器送進來。

`[cyber]` 走的是另一條路。它來自 Anthropic API 的安全分類器：API 回傳 `stop_reason: "refusal"`，再附一個 `stop_details`，裡面的 `category` 寫著是哪一類。Claude Code 收到這種回應，才會組出那段以「API Error」開頭、寫著模型的 safeguards flagged this message 的訊息，最後補上一行 `Details: [cyber]`。我 11 月 1 日看到的，就是這一行。

Anthropic 的 [API 文件](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback)列出的分類只有五個：`cyber`、`bio`、`frontier_llm`、`reasoning_extraction`、`general_harms`，對不上的時候是 `null`。裡面沒有智慧財產權，也沒有遊戲。Claude Code 執行檔裡組拒絕訊息的程式，只替 `cyber` 和 `bio` 多寫了說明文字，其他類別一律照同一個格式印出來，沒有遊戲或智慧財產權的分支。

所以遊戲規則不會產生 `[cyber]`。它不是分類器擋下來的，是模型讀了系統提示詞之後，自己決定不做。

## 被擋下來長什麼樣子

GitHub 上有一則 11 月 2 日凌晨開的 issue（[#106591](https://github.com/anthropics/claude-code/issues/106591)），開的人請 Claude Code 把一款市售的合作桌遊做出來，給朋友私下玩，對話是日文。Claude 第一則回覆說，它不會照原樣重做現有的遊戲，內部用、不公開、改名都一樣，還說這是它這邊畫的線，接著提議改做原創的遊戲，或照他自己設計的規則做。對方追問為什麼，它才說這條線來自 Anthropic 放進它系統提示詞的指示，並把那兩句原文引出來。那則 issue 要講的就是這件事：拒絕的原因明明是產品的指示，第一時間卻說成 Claude 自己的判斷。

10 月 30 日開的 [#106167](https://github.com/anthropics/claude-code/issues/106167)，開單的是一家替擁有實體兵棋的客戶做數位模組的公司。issue 範本裡「錯誤訊息」那一欄是空的，他寫的是 session 引用了那條新指示，拒絕繼續。

11 月 2 日清晨，他在同一則 issue 又貼了一張截圖，截圖裡問的是能不能做一份 1904 年 The Landlord's Game 的完整複製版，這款遊戲早就是公有領域。回覆是一段文字：它不能完整複製這款遊戲，也不能做任何一款現有遊戲的近似重製，再列兩個替代方案，同類型的原創桌遊，或照使用者自己的設計做。截圖上沒有錯誤框，也沒有標籤，只是從截圖看不出這是 Claude Code 還是網頁版。

## `[cyber]` 還是可能出現

這不代表做遊戲相關的事就碰不到 `[cyber]`。有人在 11 月 1 日[直接打 API 測過](https://ranthis.com/guides/claude-game-clone-refusal-test)：沒有那兩句的時候，點名重做現有遊戲的 18 次都照做；把那兩句放進系統提示詞，12 次全部用文字拒絕，沒有一次是 `stop_reason: "refusal"`。同一輪測試裡，真正被分類器打成 `cyber` 的，是請它寫 Ghidra 或 IDA 腳本，列出所有呼叫 `strcmp` 的函式。Tom's Hardware 也轉述過，有遊戲開發者寫自家反作弊、做自家遊戲的安全審查時被 safeguards 擋下。

所以一個遊戲專案可能碰到兩層。要求重做整款遊戲，是模型讀了那兩句之後用文字拒絕。過程中做了看起來像破解的逆向步驟，才是 API 的分類器擋下，畫面上出現 `[cyber]`。

## 我做的移植落在哪裡

我在做的卡牌遊戲移植，都是自己買的遊戲，移植給自己玩，不散布。我對移植的定義是：同一個遊戲換平台執行，每樣東西都指得出原版出處，不是 inspired。照字面看，這跟「a recreation of a specific existing game」很接近。10 月 20 日我也寫過，[那兩款遊戲現在跑的是原版的 DLL](https://b-log.to/tech-development/without-rea-unity-original-dll-port/)，遊戲程式一行都沒有轉成 TypeScript。[XDA 測試](https://www.xda-developers.com/anthropic-testing-potential-crackdown-on-vibe-coded-ports-of-existing-games/)時，Opus 5.5 拒絕重做 Pokémon Diamond，卻願意幫忙反編譯，也願意規劃 static recompilation。只是那兩句話沒有定義 recreation 的界線在哪裡，模型會把我的做法放在哪一邊，我不知道。

7 月我寫過，[Codex 擋我的時候手上只有一個 `cyber_policy`](https://b-log.to/ai-analysis/trusted-access-codex-cyber-policy-visibility/)，我分不出卡在哪一層。至少那次還有一個名字可以拿去問。這次如果被擋，畫面上只會是 Claude 的一段話，要知道是不是那兩句造成的，只能再問它一次。#106591 的經驗是，問了它才說。
