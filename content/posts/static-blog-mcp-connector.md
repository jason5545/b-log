# 幫靜態部落格接上 MCP，然後我可以躺在床上用手機發文了

我的部落格是純靜態的。GitHub Pages，沒有後端，沒有 CMS，沒有資料庫。發一篇文章要動三個檔案：Markdown 原始檔、`posts.json` 元數據、`feed.json`。然後 push 上去，等 GitHub Actions 跑完。

這對大部分人來說不是問題。開電腦、開 VS Code、寫完 push，幾分鐘的事。

但我只有一根手指能動。

開電腦、等開機、開終端機、打指令——每一步都是成本。躺在床上的時候想寫點東西？不可能。手機上沒有任何工具能讓我同時編輯三個檔案然後推到 GitHub。

Claude Code 現在有雲端版了，理論上能在手機上跑。但那還是要進去 Claude Code、下指令、確認結果——流程還是長的。而且每次都得先讓 Claude 了解 repo 結構，哪個檔案是什麼、要改哪裡，這些脈絡要自己建。

接上 MCP connector 就不一樣了。工具本身就是介面，Claude 透過 list_posts、get_post 直接知道我的系統長什麼樣，我開口說「改最新那篇」，它就知道去哪裡找、改完要動哪些東西。脈絡不用我建，直接就在裡面了。

所以我做了一個 MCP 伺服器。

## MCP 是什麼

MCP（Model Context Protocol）是 Anthropic 推的開放標準，讓 AI 可以接工具。簡單說就是：你定義一組工具，告訴 AI 每個工具吃什麼參數、做什麼事，AI 就能幫你呼叫。

Claude.ai 支援一種叫 Connector 的東西，就是遠端 MCP 伺服器。接上之後，Claude 就能直接用這些工具。

手機也能用。這是關鍵。

## 架構

整個東西跑在 Cloudflare Workers 上，免費方案就夠了。背後透過 GitHub API 直接操作 repo，不需要 clone、不需要本地環境。

一次「發文」在 GitHub 那邊是一個 atomic commit：用 Git Trees API 同時建立 Markdown 檔案和更新 `posts.json`。不會出現改了一半的中間狀態。

工具清單：

- **list_posts** / **get_post**：查文章
- **create_post**：建立新文章，自動算閱讀時間，驗證分類是否存在，按時間排序插入
- **edit_post**：編輯文章，只改你指定的欄位，智慧判斷要不要加 `updatedAt`
- **list_categories** / **create_category**：管理分類
- **save_draft** / **list_drafts** / **get_draft** / **publish_draft** / **delete_draft**：草稿系統，存在私有 repo 裡

總共 11 個工具。

## 為什麼不用 Hexo、Hugo 那些

Hexo 有管理面板，Hugo 有 CMS 套件，Netlify CMS、Forestry，選擇很多。

但它們都有同一個問題：它們是設計給「能操作鍵盤和滑鼠的人」用的。

Web UI 的表單？我要用一根手指去點每個欄位、切換分頁、拖拉檔案。CMS 的介面再怎麼友善，對我來說每多一次點擊就是額外負擔。

MCP 的做法不一樣。我只要用自然語言告訴 Claude：「幫我發一篇文章，標題是 XXX，分類放技術開發，內容是……」，剩下的事它全部處理。

不用開任何介面。不用點任何按鈕。

而且 Claude 知道我的寫作風格（Project instructions 裡有完整的風格指南），它可以在發文之前幫我修潤、調整格式、檢查用語。這不是一個笨的表單提交工具，這是一個理解上下文的協作者順便幫我推上去。

## 這篇文章就是用它發的

對。

你現在讀到的這篇文章，是我直接在 claude.ai 裡，叫 Claude 用 connector 發上來的。

從寫內容到文章上線，中間沒有開過任何編輯器，沒有手動編輯過任何 JSON，沒有打過 `git push`。

## 有沒有人做過類似的事

據我所知，沒有。

準確一點說：有人做過靜態部落格的 MCP server。GitHub 上有 Hugo 的版本，npm 上有 Kronk 這類工具，支援 Hugo、Jekyll、Astro，可以讓 Claude 用自然語言管理部落格。但這些方案都有同一個前提：你得先打開電腦，跑本地 MCP server，透過 Claude Desktop 連進去。換句話說，你還是得開電腦。

我做的這個版本是跑在 Cloudflare Workers 上的遠端 connector，直接接 claude.ai。這才是為什麼手機能用，為什麼躺著也能發文。差異不在工具本身，在於它跑在哪裡。

靜態部落格圈子裡，大家在意的是主題、外掛、建構速度。把 AI 當成「內容管理介面」這個概念，好像沒有人認真做過。

也許是因為大部分開發者不需要。他們有十根手指，打字不是問題，`git push` 兩秒鐘的事。

但對我來說，這個 connector 讓「隨時寫東西」從不可能變成了日常。

這大概就是 AI 作為輔助工具最實際的樣子——不是什麼革命性的突破，就是把一道本來過不去的門打開了。
