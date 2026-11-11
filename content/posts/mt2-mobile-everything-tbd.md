# 說好不等官方手機版，七天後 Monster Train 2 就宣布了

10/28，Monster Train 2 的開發商 Shiny Shoe 和發行商 Big Fan 發了一份新聞稿，主要是宣布新的 DLC「The Punished」11 月 10 日在 PC 和主機上推出。同一份新聞稿也確認，Monster Train 2 今年稍晚會上 iOS、Android 和 Switch 2（[Cosmocover 新聞稿，2026/10/28](https://www.cosmocover.com/newsroom/monster-train-2-the-punished-adding-new-playable-clan-nov-10-on-pc-and-consoles-monster-train-2s-arrival-on-switch-2-ios-and-android-announced/)）。手機版沒有給確切日期，只寫今年稍晚。

這離我 10/21 寫〈[不是 agentic coding 的時代，我只能等官方手機版，然後呢？](https://b-log.to/dev-philosophy/why-port-cant-wait/)〉只隔了七天。那篇寫的是兩款我自己買、自己移植的卡牌遊戲，當時我沒寫名字，現在可以寫了：本來想做的是 Monster Train 2，先成功的卻是 Diceomancer。Monster Train 2 我在 1 到 3 月用 AI 試了三次，三次都失敗。10/5 我先做 Diceomancer，做成了；10/15 再回頭做 Monster Train 2，沿用 Diceomancer 那時候做好的轉換工具，10/28 出了啟動器的 v0.1，官方也在同一天宣布手機版。

那篇裡，Monster Train 2 是上市一年多、官方手機版連公告都沒有的那一款，我還自己估，至少要等五年。這個五年是有參考的：它的前一代 Monster Train，PC 版 2020 年 5 月上市，Android 版 2025 年 5 月才出。現在，五年變成了今年稍晚。Monster Train 2 的 PC 版是 2025 年 5 月上市的，算起來官方手機版大約晚一年半，落在我 10/16 在〈[卡牌 roguelike 明明最適合手機，官方手機版卻總要等一兩年以上](https://b-log.to/cultural-insights/card-roguelike-mobile-port-wait/)〉整理的一年半到三年裡，離我估的五年差很遠。

10/29 我跟 Claude Code 講到這件事，說了一句：「我不做的時候，什麼都是 TBD；我一做，什麼都有期限了。」

而且不只這一款。Diceomancer 也是這樣，10/5 我開工的時候，官方沒有任何消息，10/9 發行商 Gamirror 就宣布手機版 2027 年 1 月上市，等於我開工第四天。兩款遊戲，都是在我動手之後，官方的時程才出來。

## 官方變快，不能只算在 AI 頭上

不過，Monster Train 2 這次比較快，不能直接說成是 AI 的功勞。開發商 Shiny Shoe 自己做過前一代的手機版，光是這個經驗，就足以解釋第二代為什麼快。官方有沒有用 AI，我也查不到。

我想講的是另一件事。Monster Train 2，我自己用 AI 兩週左右就做到了，官方的團隊也用得到同樣的工具。所以手機版拖好幾年，越來越不是技術問題，而是商業上要不要做。

## 我這邊做到哪裡

我做的是一個 Monster Train 2 的 Android 啟動器：用我自己的 Steam 帳號下載 PC 版，在手機上轉換，遊戲檔不散布。這跟前幾篇的原則一樣，遊戲是我自己買的。10/28，也就是官方發新聞稿的同一天，它出了第一個 v0.1，還是預先發行版，程式碼也還沒公開。

公開程式碼和到 Reddit 宣傳，10/29 我決定都等到 11/10 之後。那天新 DLC 上線，我要先在手機上把它測過。

所以「一做就有期限」這句話，最後也落到我自己頭上。官方一宣布，我這邊公開的時間點，就被一個 DLC 的上線日卡住了。

## 回頭看 10/21 那篇

10/21 那篇最後，我寫 Diceomancer 的官方手機版 2027 年 1 月上架，我會去買；Monster Train 2 的官方手機版什麼時候出，我不知道，我也不打算等。那時候我手上只有一個自己的估計。七天後，官方給了一個大概的時間，今年稍晚，但沒有日期。我的啟動器在同一天出了 v0.1。

11/10，DLC 上線，我先在手機上把它測過，再談公開。

## 測完了，也公開了

The Punished 上線的時候，遊戲本體也更新到 2.3.0。啟動器加了這個版本的支援。我在手機上從 2.2.1 用 Steam 直接更新，大約 11 分半裝好，兩個 DLC 都拿得到，遊戲頁顯示 DLC 2 / 2。

新氏族叫「受罰者」，勇者是阿卡斯。打法是主動打傷自己的單位，把痛苦轉成戰力。氏族機制叫「巨石」：戰鬥中花 1 餘燻、棄一張牌獻貢，累積奉獻，讓之後召喚的單位更強。Steam 定價是 NT$175（[Steam 商店頁](https://store.steampowered.com/app/4739980/)）。

我一開始玩了一陣子，以為新 DLC 沒東西。受罰者其實已經在「出發 → 新遊戲 → 主要氏族」的列表裡解鎖了。只是我把氏族設成「隨機MT1」，這個選項只會抽一代的氏族，永遠抽不到受罰者。不是啟動器的問題。

測試的時候抓到一個 bug，當場修掉了。在遊戲裡用返回手勢回到啟動器，再開遊戲會黑畫面，要強制停止才恢復。原因是 Android 16 的新返回手勢（預測返回）不再送返回鍵，系統直接把遊戲畫面關掉，背景裡的遊戲卻沒結束，第二次開遊戲就沿用了上一局的狀態。修好之後，返回手勢在遊戲裡改成跟 Esc 一樣，用來開選單、關對話框；要離開遊戲，用遊戲選單裡的「退出遊戲」，或按 Home。

啟動器今天發了 v0.2，是官方簽章的預先發行版。原始碼也公開了，在 [GitHub](https://github.com/jason5545/mt2-mobile-launcher)，Release 是 [v0.2](https://github.com/jason5545/mt2-mobile-launcher/releases/tag/v0.2)。原創程式碼是 MIT 授權。APK 一樣不含任何遊戲檔，遊戲要自己在 Steam 買，在手機上用自己的帳號下載、轉換。

Reddit 的英文宣傳文我還沒發。

