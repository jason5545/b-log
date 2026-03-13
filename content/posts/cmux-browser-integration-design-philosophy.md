# cmux 的內建瀏覽器：我誤解了它的設計


[cmux](https://github.com/manaflow-ai/cmux) 是一個基於 Ghostty（libghostty）打造的 macOS 終端機，專為 AI coding agent 的工作流設計。它的核心功能是側邊欄 workspace 管理、agent 通知系統（等待輸入時 pane 亮藍色光環）、以及可程式化的 socket API。除此之外，它還有一個內建瀏覽器——而這個功能，我一開始完全誤解了。

Theo（t3.gg）在介紹 cmux 的影片裡說了一句很誠實的話：「我只喜歡 cmux 把終端機這側收攏的部分。瀏覽器那塊我恨它。」他裝上 cmux 之後第一件事，就是把「在 cmux 瀏覽器開啟終端機連結」關掉。理由直接：沒有 Cookie、沒有擴充功能、不能用 1Password，每次用 Lazygit 按 PR 連結就跳出一個殘廢視窗。

我也關掉了同一個設定，理由一模一樣。

然後我們都以為這個功能就沒什麼意思了。

---

## Theo 想要的其實是另一件事

Theo 在影片裡對瀏覽器整合有一個更大的想像：**把真實的 Chrome 嵌進來**——帶入你現有的 Chrome 設定檔、Cookie、擴充功能，讓 1Password 能用，讓你已登入的所有網站都能直接用。他覺得如果能做到這個，終端機、瀏覽器、IDE 就真的可以在同一個 app 裡共存。

這個想像是對的，但 cmux 現在的瀏覽器不是在做這件事。cmux 用的是 WKWebView，User Agent 硬編碼成 Safari 的字串，目的是避免被 Google 這類網站擋掉——它本來就不是設計來給你瀏覽網頁用的。

---

## 它到底在解決什麼問題

後來我請 Claude Code 去挖 cmux 的設計思路，才發現我搞錯了層次。

cmux 的內建瀏覽器 API 是從 [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) 移植過來的。agent-browser 的定位很清楚：**讓 AI agent 能用簡潔的 CLI 介面操作瀏覽器**，不需要學 Playwright 或 Puppeteer 的複雜 API。流程是 snapshot → 拿到 element refs → 用 `@ref` 點擊或填表。

所以 cmux 的瀏覽器不是給你用的，是給 agent 用的。

```bash
cmux browser open
cmux browser snapshot        # 取得 accessibility tree + refs
cmux browser click @ref-123  # 點擊元素
cmux browser eval "document.title"
cmux browser get url
```

Claude Code 在終端機裡，透過這幾個指令，可以直接控制旁邊的瀏覽器 pane，看自己剛改的 UI 有沒有跑通，讀 console 錯誤，填表測試。

---

## 跟 Claude in Chrome 有什麼不同

聽起來跟 Claude Code 官方的 Chrome 整合（`/chrome`）做的事差不多，但有一個關鍵差異：**隔離性**。

Claude Code 的 Chrome 整合共用你的單一 Chrome 實例。你同時跑三個 CC session 各自負責不同專案，三個都想看自己的 dev server——`localhost:3000`、`3001`、`3002`——Chrome 整合沒辦法給每個 session 一個獨立的瀏覽器。

cmux 的瀏覽器是每個 workspace 一個獨立 pane，天然隔離。這正是 cmux 的核心場景：多個 agent 平行工作，每個看自己的東西。

| | Claude Code + Chrome 整合 | cmux 內建瀏覽器 |
|---|---|---|
| 依賴 | 需安裝 Chrome + 擴充套件 | 零依賴，開箱即用 |
| 隔離 | 共用單一 Chrome 實例 | 每個 workspace 獨立 pane |
| 控制方式 | MCP 工具呼叫 | CLI / socket API |
| 適用場景 | 需要登入態的網站 | dev server、多 agent 平行 |

---

## 「primitive，不是 solution」

cmux 的 README 有一段話我覺得說得準：

> cmux is a primitive, not a solution. It gives you a terminal, a browser, notifications, workspaces, splits, tabs, and a CLI to control all of it.

Theo 在影片裡說的「我只想要它把終端機這側收攏」，其實就是他在用自己的語言表達同一件事——他拿走了對他有用的 primitive，把對他沒用的先放著。他批評的是那個預設攔截連結的行為，不是功能本身。

大部分工具都想做「完整解決方案」，cmux 反其道而行，只給你可組合的原件，怎麼用是你的事。瀏覽器不攔截你的連結（除非你選擇開啟那個設定），不強迫你用它的工作流，只是靜靜待在那裡，等 agent 需要的時候呼叫它。

---

## 實際情況

我關掉的是「終端機連結用 cmux 瀏覽器開啟」這個設定，不是瀏覽器本身。

瀏覽器功能還在。Claude Code 跑完測試後，可以直接呼叫 `cmux browser snapshot` 看頁面狀態，這條路徑是通的，而且我已經把操作指南寫進 `~/.claude/agents/cmux-browser.md`，未來每個 CC session 都能自動取用。

有時候誤解一個功能，不是因為功能本身設計不好，而是因為接觸它的方式不對。那個彈出殘廢瀏覽器的體驗太差，讓我以為整個功能都是如此——但那個體驗只是一個可以關掉的選項，不是功能的本體。

至於 Theo 想像中的「嵌入真實 Chrome」——那是另一個更大的問題，cmux 目前沒在解決它，也不應該被期待解決它。

---

附記：把 cmux 設為預設終端機後，Finder 右鍵「在終端機中開啟」會遇到不帶路徑的問題，解法在[這篇](/tech-development/cmux-finder-open-terminal-workaround/)。

