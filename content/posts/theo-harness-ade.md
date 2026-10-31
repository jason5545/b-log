# 我說 T3 Code 變成很奇怪的變體，Theo 剛好拍了一支影片說它不是 harness，是 ADE

10 月 30 日，我在 T3 Code 裡問 Claude Code：這個專案到底有沒有偏離 Theo 的初衷？我感覺它已經變成一個很奇怪的變體了。你說它不是 harness，可是它提供出來的 MCP 又很強大，只是沒有 LSP 而已。

Claude Code 先去查了一輪。T3 Code 的 README 確實改過定位：2 月 9 日寫的是「a minimal web GUI for coding agents. Currently Codex-first」，7 月 28 日改成「agent harness control surface」。它把 harness 定義成單一代理那一圈迴圈：叫模型、管上下文、讀檔改檔、跑 shell，LSP 也在這一圈裡。T3 的 MCP 大約有 70 個工具，管的都是這一圈外面的事：開對話串、派別家的代理、瀏覽器預覽、手機畫面、PR、排程、跨機器。照這樣分，T3 不算 harness。

模糊的地方也有。T3 每一輪都會把自己的指示注入代理，repo 裡還有一個 `evals/`，專門測模型讀了這些指示之後會怎麼做，這已經碰到 harness 的範圍。我的全域規則是不開子代理，就曾經跟 T3 的內建指示打架，這在〈[Theo 終於好好介紹了 T3 Code，我拿每天在用的 fork 一段一段對](https://b-log.to/tech-development/theo-t3-code-video-my-fork/)〉寫過。偏得最多的是 minimal。AGENTS.md 裡 Theo 自己寫了「fight scope creep」，可是排程、workflow、裝置面板、T3 Connect、行動版一路加上來，早就談不上 minimal。

## Theo 的答案：T3 Code 不是廚房，是美食街

沒多久，Theo 上傳了一支快五十分鐘的影片〈[Are Harnesses Dead?](https://www.youtube.com/watch?v=ebILGCoN4UU)〉，整支幾乎都在講這件事。

他先講定義。LLM 只會產生文字，harness 像一間備好工具的廚房，模型加上 harness，才叫 agent。Claude Code CLI 是一個介面，裡面包了一個 harness，也就是 Agent SDK。T3 Code 只是介面，本身不是 harness。他把 harness 的工具比成放進廚房的鍋具，T3 的 MCP 比較像留在廚房裡的食譜：MCP 只是一層綁定，程式留在 T3，所以一個 harness 可以透過 T3 叫起另一個 harness，T3 在中間轉訊息。至於 LSP，他舉 Claude Code 的 TypeScript plugin 當例子，裝了才能跳到定義、找參照，那是 harness 的外掛，不歸 T3 管。

那 T3 是什麼？他的比喻是美食街：T3 不是廚房，是讓你選要去哪間廚房的地方，模型選單其實是 harness 選單。他的結論是，T3 Code 是 ADE（agentic development environment），一邊面對人，一邊面對各家 harness，也管遠端機器、幫各家 harness 更新。處理各家 harness 子代理的那段程式，他自己也說寫得很糟，可是既然選了比較難的路，就只能做。

拿來跟 Claude Code 先前的回答對，幾乎都對得上：T3 不加工具，LSP 歸 harness；不 minimal，Theo 自己也認了。只有一處他自己畫的線不太穩。他說 T3 不加工具，同一支影片又說，Kua 的電腦操作工具（截圖、點擊、打字）很快會進 T3，那正好落在他放給 harness 的工具層。

## 換了廚房，skill 就不見

影片裡有一段，Theo 在抱怨使用者：有人在 Claude 裝了 skill，換到 Codex 就沒有了，跑去私訊罵他。他說，使用者現在已經感覺不到 harness 的存在。他估各家 harness 之間的差距只剩 3% 到 5%，不過模型開始用自家 harness 的資料訓練，Claude 的模型在 Claude Code 裡通常表現比較好。

我這邊沒有遇到這個問題。換了廚房，我的全域規則和 skill 還是放在同一個地方，各家工具都讀同一個資料夾，只有少數限定某個工具的 skill 才分開放。所以我在 T3 裡換來換去，規則和 skill 都跟著走。

這一塊不是 T3 做的，是我自己接起來的。

## 10 月 31 日：比直接用還好調度

隔天，我又跟 Claude Code 說了一句：但是我怎麼覺得，它比直接用還好調度。

對我來說，理由其實很簡單：現在我在一個地方，就可以用到很多家的東西。

所以這個專案到底有沒有偏離 Theo 的初衷？照 README，minimal 那一句早就不成立了；照 Theo 自己的說法，這是他選的那條比較難的路。Theo 在影片最後說，ADE 早晚也會跟編輯器一樣變得不重要，大家會直接在 Slack 下 prompt。在那之前，我還是每天在 T3 裡派工。

