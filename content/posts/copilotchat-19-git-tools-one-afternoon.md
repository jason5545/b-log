# 一個下午補完 19 個 git 工具，和一個藏很深的 libgit2 bug


起因很簡單。我打開 CopilotChat，試著讓 AI 幫我 git reset，結果發現 GitHub plugin 裡沒有這個工具。

我說：加一個 reset，要跟真正的一樣。

## 從一個到全部

reset 做完之後，我問了一句：「還缺哪些？」

AI 列了一整排：stash、merge、cherry-pick、revert、rebase、blame、reflog、branch delete、tag create、remote add/remove、clean、describe、config、show、add、commit、rm。

我說：全部。

然後它就真的全部做了。

## 28 個底層方法 + 19 個 MCP 工具

Repository.swift 是 SwiftGit 對 libgit2 的封裝層。原本只有 commit、checkout、diff、status 那些基本操作。這次一口氣加了 28 個方法：

- **Stash 完整週期**：`stashList`、`stashSave`、`stashApply`、`stashPop`、`stashDrop`
- **合併體系**：`merge`、`mergeAnalysis`、`mergeBase`、`stateCleanup`
- **提交操作**：`cherryPick`、`revert`
- **分支與標籤**：`deleteBranch`、`createTag`、`deleteTag`
- **遠端管理**：`addRemote`、`removeRemote`
- **索引操作**：`remove(paths:)`（git rm）
- **查詢工具**：`show`、`blame`、`reflog`、`describe`
- **設定**：`getConfig`、`setConfig`
- **清理**：`clean`

每一個都是直接呼叫 libgit2 的 C API，然後把 `Result<T, NSError>` 包好回傳。沒有用任何第三方 Git 框架——因為整個 app 零依賴，這條規則從一開始就定了。

上層的 GitHubPlugin.swift 對應 19 個 MCP 工具，每個工具負責解析 JSON 參數、呼叫 Repository 方法、格式化輸出。整個過程就是：MCP tool schema → dispatch → libgit2 呼叫 → 文字結果回傳。

加完之後 Xcode build，一次過。1,404 行新增，43 行刪除。

## 26/28

我把測試 prompt 丟給 agent，讓它逐一跑過每個工具。結果 26 個通過，2 個有問題：

- **github_config**：`git_config_get_string` 回傳的是借用指標，config 物件一釋放就失效了。改成 `git_config_get_string_buf`，把字串複製到自己的 buffer 裡，問題解決。
- **github_branch_create**：這個故事比較長。

## Branch Create：四輪 deploy 才抓到的 bug

第一輪，錯誤訊息是 `error -1`。

我看了程式碼，懷疑是 `headRef as? Branch` 這個轉型失敗——`HEAD()` 回傳的是 `ReferenceType`，不一定是 `Branch`，所以型別轉換永遠失敗，後面的 `git_branch_create` 根本跑不到。改用 `git_revparse_single("HEAD")` 直接解析。

第二輪 deploy，還是 `error -1`。

我開始懷疑是不是部署沒有更新。檢查了 binary timestamp，08:40 build，08:40 install，時間吻合。bug 是真的。

第三輪，我加了 `git_error_last()` 把 libgit2 的錯誤訊息印出來。

第四輪 deploy 終於看到了：

> `Branch create failed (error -1): invalid argument: 'ref_out'`

答案揭曉。`git_branch_create` 的第一個參數 `git_reference **out` 不能傳 NULL。libgit2 的實作裡面直接對這個指標寫入，你傳 NULL 它就炸了。

本來的程式碼長這樣：

```c
git_branch_create(nil, repo.pointer, namePtr, commitObj, 0)
```

改成：

```swift
var refOut: OpaquePointer?
git_branch_create(&refOut, repo.pointer, namePtr, commitObj, 0)
// ... 用完之後
git_reference_free(refOut)
```

就這樣。一個指標的問題，繞了四輪 deploy。

## 為什麼不用 Git.swift 或 SwiftGit2？

因為零依賴。CopilotChat 從第一天就決定不引入任何第三方套件。安全審計好做，供應鏈風險為零，App Store 審查也乾淨。所有 Git 操作都是直接呼叫 libgit2 的 C API，透過 xcframework 包進 app 裡。

這個選擇的代價就是：每一個 Git 功能都要自己封裝。好處是你可以完全控制每一層的行為，不會被上游框架的 bug 卡住——像我這次就是直接翻 libgit2 的 header 才找到 `out` 參數的限制。

## 現在手機上的 Git 能做什麼

28 個工具全部到位之後，CopilotChat 的 GitHub plugin 在 iPhone 上就能跑完整的 Git workflow：

- 開分支、切分支、刪分支
- Stage、commit、push、pull
- Soft/mixed/hard reset
- Stash save/list/apply/pop/drop
- Merge、cherry-pick、revert
- 建標籤、刪標籤
- 加遠端、刪遠端
- Blame、reflog、describe
- Read/write config
- Clean untracked files
- Show commit detail with diff

不是玩具。是真的能在手機上操作的 Git 工具鏈，透過 MCP 協議讓任何接上 CopilotChat 的 AI 模型都能呼叫。

## 回頭看

整個過程從「加一個 reset」開始，到「全部加完」結束，中間包含一次 28/19 的大規模實作和一個四輪才抓到的 C API bug。AI 寫程式的速度很快，但 debug 這種「文件沒寫、runtime 才炸」的問題，還是需要人類的判斷——知道什麼時候該加 diagnostic、什麼時候該檢查 deploy timestamp、什麼時候該去翻 C header。

不過說實話，如果是我自己手寫這 28 個方法，大概要一整個禮拜。今天一個下午就做完了。包括 debug。

---

*CopilotChat 是開源的，[GitHub](https://github.com/jason5545/CopilotChat)，MIT 授權。19 個新工具的 commit 是 `90a4edbbc`。*

