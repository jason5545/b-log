# 我為什麼從 Ghostty 換到 cmux


[cmux](https://github.com/manaflow-ai/cmux) 是一個基於 Ghostty（libghostty）打造的 macOS 終端機，專門為 AI coding agent 的工作流設計。我用 Ghostty 用了很長一段時間，換過來不是因為 cmux 功能更多，而是因為它的組織方式更符合我現在工作的形狀。

---

## 問題出在層級

tmux 和傳統終端機假設你的工作是線性展開的：一個主任務，分割幾個窗格輔助。但跑多個 Claude Code session 之後，工作結構變成樹狀——多個專案平行進行，每個專案裡又有 agent、dev server、git 操作各自佔一個位置。想把這些塞進 tmux 的分割邏輯，很快就亂了。

cmux 的解法是**側邊欄 + workspace 層級**：左側是專案清單，每個專案內部再自由分割 pane 和 tab。切換專案是 `Cmd+數字`，切換同一專案內的 pane 是 `Ctrl+數字`。層級對了，平行工作的心智負擔小很多。

---

## 通知系統是真正改變工作流的東西

跑多個 agent 最痛的地方不是開太多視窗，而是**不知道哪個在等你**。macOS 的系統通知只顯示「Claude is waiting for your input」，沒有任何上下文，分不清是哪個 session、在等什麼。

cmux 的通知系統透過 OSC 9/99/777 終端機序列偵測，當 agent 等待輸入時，那個 pane 會亮起藍色光環，側邊欄的對應 tab 也會標示。`Cmd+Shift+U` 直接跳到最新未讀。這個設計讓我不需要一個個去看，視線掃一下側邊欄就知道狀態。

可以在 Claude Code 的 hooks 裡接上 `cmux notify`，讓 agent 自己回報進度，不只是「在等待」，還可以帶訊息文字。

---

## 側邊欄能看到的資訊

每個 workspace tab 會顯示：

- 目前 git branch 和 PR 狀態／編號
- 工作目錄
- 正在監聽的 port
- 最新通知文字

跑著 dev server 的 workspace 一眼就能看到它在哪個 port，不需要切過去確認。

---

## 它的設計哲學

README 有一段話我覺得說得很準：

> cmux is a primitive, not a solution.

它不告訴你工作流應該長什麼樣，只給你終端機、瀏覽器、通知、socket API，怎麼組合是你自己的事。這讓它在上手的時候沒有「正確用法」可以抄，但也讓它不會綁死你的習慣。

---

## 後續

換過來之後陸續遇到一些邊緣問題，也發現了一些一開始以為沒用、其實設計得很清楚的功能：

- [cmux 的 Finder「在終端機中開啟」不帶路徑？用 wrapper app 解決](/tech-development/cmux-finder-open-terminal-workaround/)：把 cmux 設成預設終端機後，Finder 右鍵開啟不帶路徑的問題和修法
- [cmux 的內建瀏覽器：我誤解了它的設計](/tech-analysis/cmux-browser-integration-design-philosophy/)：為什麼我一開始以為瀏覽器功能沒用，後來發現搞錯層次了

cmux 本身還在快速迭代，現在用的版本跟幾週後可能已經不一樣。但它的核心層級設計——workspace 作為專案單位、agent 通知、可程式化的原件——這個方向是對的。

