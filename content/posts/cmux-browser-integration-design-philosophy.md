# cmux 的內建瀏覽器：我誤解了它的設計


[cmux](https://github.com/manaflow-ai/cmux) 是一個基於 Ghostty（libghostty）打造的 macOS 終端機，專為 AI coding agent 的工作流設計。它的核心功能是側邊欄 workspace 管理、agent 通知系統（等待輸入時 pane 亮藍色光環）、以及可程式化的 socket API。除此之外，它還有一個內建瀏覽器——而這個功能，我一開始完全誤解了。

Theo 在影片裡說，他裝上 cmux 之後第一件事是把「在 cmux 瀏覽器開啟終端機連結」關掉。他的理由很直接：沒有 Cookie、沒有擴充功能、不能用 1Password，每次用 Lazygit 按 PR 連結就跳出一個殘廢視窗。

我也關掉了同一個設定，理由一模一樣。

然後我以為這個功能就沒什麼意思了。

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

cmux 的瀏覽器是每個 workspace 一個獨立 pane，天然隔離。這正是 cmux 的核心場景：**多個 agent 平行工作，每個看自己的東西**。

| | Claude Code + Chrome 整合 | cmux 內建瀏覽器 |
|---|---|---|
| 依賴 | 需安裝 Chrome + 擴充套件 | 零依賴，開箱即用 |
| 隔離 | 共用單一 Chrome 實例 | 每個 workspace 獨立 pane |
| 控制方式 | MCP 工具呼叫 | CLI / socket API |
| 適用場景 | 需要登入態的網站 | dev server、多 agent 平行 |

---

## 「primitive，不是 solution」

cmux 的 README 有一段話我覺得說得很好：

> cmux is a primitive, not a solution. It gives you a terminal, a browser, notifications, workspaces, splits, tabs, and a CLI to control all of it.

大部分工具都想做「完整解決方案」，cmux 反其道而行，只給你可組合的原件，怎麼用是你的事。

這個哲學決定了它的行為：瀏覽器不攔截你的連結（除非你選擇開啟那個設定），不強迫你用它的工作流，只是靜靜待在那裡，等 agent 需要的時候呼叫它。

---

## 實際情況

我關掉的是「終端機連結用 cmux 瀏覽器開啟」這個設定，不是瀏覽器本身。

瀏覽器功能還在。Claude Code 跑完測試後，可以直接呼叫 `cmux browser snapshot` 看頁面狀態，這條路徑是通的，而且我已經把操作指南寫進 `~/.claude/agents/cmux-browser.md`，未來每個 CC session 都能自動取用。

有時候誤解一個功能，不是因為功能本身設計不好，而是因為接觸它的方式不對。那個彈出殘廢瀏覽器的體驗太差，讓我以為整個功能都是如此——但那個體驗只是一個可以關掉的選項，不是功能的本體。

---

附記：把 cmux 設為預設終端機後，Finder 右鍵「在終端機中開啟」會遇到不帶路徑的問題，解法在[這篇](/tech-development/cmux-finder-open-terminal-workaround/)。

