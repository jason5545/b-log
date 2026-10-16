# Claude Code 桌面版會自己開平行 session 了，我已經換過去，九月用 deep link 拼的那條路我刪了

臺灣時間昨天凌晨三點，[@ClaudeDevs](https://x.com/ClaudeDevs/status/2110445844675838148) 發了一串推文，說 Claude Code 桌面版這次改版是為了同時跑很多 session：開新 session 更快，工作更容易分給幾個 session，每個 session 在做什麼也都看得到。

其中一則說，你叫 Claude 平行跑幾個任務，它會替每個任務開一個 nested session，做完之後把結果交回你的主 session，主 session 因此還讀得下去。

這個形狀，我九月自己拼過一次。現在我已經換成官方這套新流程了。

## 九月那套是怎麼拼的

〈[沒等到 start_session，我讓 Claude 自己開 session：資料夾明明顯示對的，還是開錯地方](https://b-log.to/tech-development/claude-desktop-open-session-without-start-session/)〉寫的就是它。我習慣一個 session 當協調端，裝著計畫和審查要用的脈絡；另一個 session 動手，大量的工具輸出留在那邊，協調端只看 diff 和驗證輸出。桌面版其實有開 session 的工具 `start_session`，但它被功能旗標關著，我的帳號沒有。

所以只能自己開。我主要靠右手食指操作電腦，開新 session、找資料夾、切權限模式、選模型，每一下都是實際的操作量。後來是 Claude 翻出 `claude://code/new` 這個 deep link，再從輔助使用介面找到 Send 按下去。第一版對錯交替，讀了桌面版的 `main.log` 才知道是按得太早，要等資料夾信任那一行紀錄出現才能按。同一個資料夾，後來改用 `spawn_task` 的 chip，按 Start locally 一秒就開好；要換資料夾，還是只能走 deep link。那篇最後一句是「旗標還是關的」。

## 這次內建了哪幾塊

ClaudeDevs 列的幾項，剛好各自蓋到我那套的一部分：

- 平行任務各開一個 nested session，做完把結果交回主 session。這就是我的協調端加實作端，只是不用我開，也不用協調端去讀 log 確認開在哪裡。
- Claude 工作時會主動提議後續工作，按一下就變成獨立的 session。這跟我九月用的 chip 是同一類東西。
- 新 session 畫面把最近用過的資料夾放在按一下就到的地方；也可以把幾個資料夾、一臺 SSH 主機或雲端存成「環境」，從那裡開 session，每個資料夾可以選要不要 worktree。
- 側欄標出哪些 session 在跑、哪些在等你；session 裡有跟著計畫走的待辦清單，需要你的時候會出一張摘要卡。

第一項省掉的，就是那支等 log、按 Send、再驗路徑的 script。那本來就是旗標沒開才繞的路，官方的能用，我就用官方的，所以更新之後我直接換過去了。開 session 少按幾下，對我就是實際省下來的力氣。

## 換過去之後，我對過的幾件事

九月那篇踩過的地方，資料夾、模型、回報時機和用量這幾點我都對過了。nested session 開的時候可以選主工作區或 worktree。模型則跟主 session 一樣：會繼承主 session，也可以自動換模型；但如果改的是 effort，還是會問你。做完時結果會自動交回主 session，不是以前 chip 那種只通知封存、還要自己傳訊息回報。

兩個 nested session 如果會改到同一個檔案，就開 worktree，各自隔開。

九月那套裡，我的分工有一種是 Fable 指揮、Opus 動手，為的是省 Fable 的週額度。chip 按下去第一輪就開始跑，來不及先換模型，所以那時只能先放「待命」，切成 Opus 之後再傳交接。現在 nested session 能繼承、也能自動換模型，這一塊已經比 chip 好處理。

用量這點我也對過了。nested session 不是把主 session fork 一份出去；主模型是傳一份乾淨的提示詞過去。這跟〈[我只管主 session 不要爆掉，雲端 agent 那一輪花了 90 美元](https://b-log.to/ai-analysis/cloud-agent-main-session-cap-90-usd-round/)〉裡那種新開子代理、要把系統提示和規則檔重新寫進快取的帳不一樣。

## 舊的那條路我刪了

開 session 這件事，我已經交給官方了。九月那支 deep link 加輔助使用介面的 script，我也刪掉了。

九月那篇最後寫「旗標還是關的」。現在旗標開了，我也不用繞那條路了。

