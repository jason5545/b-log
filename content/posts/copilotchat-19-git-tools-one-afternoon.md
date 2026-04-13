# 一個 libgit2 的 out 參數，燒了我四輪 deploy


今天下午我讓 AI 幫 CopilotChat 補了 19 個 git 工具。stash、merge、cherry-pick、revert、blame、reflog、tag、remote——一次全上，build 一次過，1,404 行新增。

測試跑完，26/28 通過。剩下兩個小問題，config 那個改個 API 就修了。但 branch_create 卡了我很久。

這篇文章只講這個 bug。

## 第一輪：error -1

`github_branch_create` 回傳 `error -1`。

我翻了程式碼，看到 `headRef as? Branch`。`HEAD()` 回傳的是 `ReferenceType` protocol，不保證是 `Branch` struct。如果轉型失敗，整個 branch creation 的 code path 根本不會執行。

合理懷疑。我把整段重寫成用 `git_revparse_single("HEAD")` 直接解析 HEAD 到 commit object，繞過型別轉換。Deploy。

## 第二輪：還是 error -1

一樣的錯誤碼。

我開始懷疑是不是手機上的 binary 沒有更新。跑去查 build timestamp 和 install timestamp，完全吻合——08:40 build，08:40 install。 deploy 沒問題，bug 是真的。

## 第三輪：加 diagnostic

我意識到 `error -1` 什麼都沒告訴我。libgit2 有 `git_error_last()` 可以拿到最後的錯誤訊息，但我從來沒想過要用——因為其他 27 個工具都不需要。

加了一行：

```swift
let errPtr = git_error_last()
let errMsg = errPtr != nil ? String(validatingUTF8: errPtr!.pointee.message) ?? "unknown" : "unknown"
```

Deploy。

## 第四輪：真相大白

錯誤訊息終於有意義了：

> `Branch create failed (error -1): invalid argument: 'ref_out'`

`ref_out`。就是 `git_branch_create` 的第一個參數。

libgit2 的 API 長這樣：

```c
int git_branch_create(
    git_reference **out,    // <-- 這個
    git_repository *repo,
    const char *branch_name,
    const git_commit *target,
    int force);
```

我的程式碼是這樣寫的：

```swift
git_branch_create(nil, repo.pointer, namePtr, commitObj, 0)
```

`nil`。因為我不需要拿到新建的 reference，我後面會用 `repo.localBranch(named:)` 重新查。所以第一個參數傳 NULL，很合理吧？

不合理。libgit2 的實作會直接對 `out` 寫入，不檢查 NULL。你傳 NULL，它就 segfault 或回傳 -1。而且這件事**文件沒有明確寫**——header 裡只說 `Pointer where to store the underlying reference`，沒有說「不能傳 NULL」。

修正很簡單：

```swift
var refOut: OpaquePointer?
git_branch_create(&refOut, repo.pointer, namePtr, commitObj, 0)
// 用完釋放
git_reference_free(refOut)
```

就這樣。一個指標，四輪 deploy。

## 事後檢討

這個 bug 的每一層都讓人以為找到了答案：

1. **`as? Branch` 失敗** → 以為是型別轉換的問題 → 改了之後還是錯
2. **`error -1`** → 以為是 HEAD 解析失敗 → 但 `git_revparse_single` 回傳了成功
3. **質疑 deploy** → 檢查 timestamp，確認 binary 是新的
4. **加 diagnostic** → 終於看到真正的錯誤訊息

最根本的教訓是：**在 C API 的世界裡，永遠不要假設一個 `out` 參數可以傳 NULL，除非文件明確說可以。** Swift 的 `nil` 對應到 C 的 `NULL`，看起來很自然，但 C 函式庫不會像 Swift 那樣幫你做 optional checking。

另外一個學到的事：debug 的第一步應該是拿到錯誤訊息，不是猜。我前三輪都在猜，第四輪才加了 `git_error_last()`，然後一分鐘就修好了。

---

*CopilotChat 是開源的，[GitHub](https://github.com/jason5545/CopilotChat)，MIT 授權。這個 bug 的修復在 commit `90a4edbbc`。*

