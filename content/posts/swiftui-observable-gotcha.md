# 我花了一整天才發現：SwiftUI @Observable 的子視圖陷阱

## 故事開始

最近我在開發一個 iOS 影片下載 App「Otter」，用的是最新的 Swift 6 和 iOS 26 SDK。既然都用 Swift 6 了，自然要用 `@Observable` 宏來管理狀態，畢竟這已經是 Apple 推薦的標準做法。

一切看起來都很美好，直到我發現——下載進度條完全不會動。

## 問題現象

我的 `DownloadManager` 是一個單例，負責管理所有下載任務：

```swift
@Observable
@MainActor
final class DownloadManager {
    static let shared = DownloadManager()
    private(set) var tasks: [DownloadTask] = []
}
```

在 `DownloadView` 裡，我用 `@Environment` 注入它：

```swift
struct DownloadView: View {
    @Environment(DownloadManager.self) private var downloadManager

    var body: some View {
        List {
            ForEach(downloadManager.tasks) { task in
                DownloadTaskRow(task: task)
            }
        }
    }
}
```

看起來很標準對吧？但當下載開始後，進度條永遠停在 0%，狀態永遠顯示「等待中」。

我打開 Debug Log，發現狀態確實有在更新：

```
[DownloadManager] State updated · progress=0.15
[DownloadManager] State updated · progress=0.32
[DownloadManager] State updated · progress=0.58
[DownloadManager] State updated · progress=1.0
[DownloadManager] State updated · state=completed
```

資料明明更新了，UI 卻紋風不動。這是什麼巫術？

## 除錯之路

### 第一個假設：@Observable 壞了

我先寫了一個測試視圖，把所有東西都內聯進去：

```swift
struct ObservableTestView: View {
    @Environment(DownloadManager.self) private var downloadManager

    var body: some View {
        ForEach(Array(downloadManager.tasks.enumerated()), id: \.element.id) { index, _ in
            let task = downloadManager.tasks[index]
            Text("\(task.state.displayText) - \(Int(task.progress * 100))%")
        }
    }
}
```

結果：**測試視圖可以正常更新！**

好，所以 `@Observable` 沒壞。那問題在哪？

### 第二個假設：陣列元素修改沒被偵測

我原本更新狀態的方式是：

```swift
tasks[index].state = .running(progress: 0.5, progressText: "50%")
```

我懷疑 `@Observable` 無法偵測陣列元素的屬性變化，於是改成：

```swift
var updatedTask = tasks[index]
updatedTask.state = .running(progress: 0.5, progressText: "50%")
tasks[index] = updatedTask
```

結果：**測試視圖還是正常，DownloadView 還是不動。**

### 第三個假設（正確答案）：子視圖快取

我仔細比較了測試視圖和 DownloadView 的差異：

**測試視圖（可以更新）：**
```swift
ForEach(...) { index, _ in
    let task = downloadManager.tasks[index]
    Text(task.state.displayText)  // 直接內聯
}
```

**DownloadView（無法更新）：**
```swift
ForEach(downloadManager.tasks) { task in
    DownloadTaskRow(task: task)  // 傳給子視圖
}
```

**我終於懂了！**

當我把 `task`（一個 struct）傳給 `DownloadTaskRow` 時，SwiftUI 會根據 `id` 來決定是否重新渲染這個 row。由於 `task.id` 沒變，SwiftUI 認為：「喔，這個 row 不需要更新。」

但實際上 `task.state` 已經變了！SwiftUI 不知道，因為它只看 `id`。

## 解決方案

### 方案一：完全內聯（我最終用的）

把所有 UI 都寫在 ForEach 裡面：

```swift
ForEach(Array(downloadManager.tasks.enumerated()), id: \.element.id) { index, _ in
    let task = downloadManager.tasks[index]

    HStack {
        Text(task.viewState.title)
        Spacer()
        if let progress = task.state.progress {
            ProgressView(value: Double(progress))
            Text("\(Int(progress * 100))%")
        }
    }
}
```

關鍵是每次都從 `downloadManager.tasks[index]` 重新取值，這樣 SwiftUI 才會追蹤到變化。

### 方案二：讓子視圖自己存取 Observable

如果你堅持要用子視圖，讓它自己去拿資料：

```swift
struct DownloadTaskRow: View {
    let taskId: String
    @Environment(DownloadManager.self) private var downloadManager

    private var task: DownloadTask? {
        downloadManager.tasks.first { $0.id == taskId }
    }

    var body: some View {
        if let task = task {
            // ...
        }
    }
}
```

這樣子視圖會直接觀察 `downloadManager`，當 `tasks` 變化時就會重新渲染。

## 所以到底學到什麼

`@Observable` 的觀察是基於「存取」的。只有在 view body 中直接存取 observable 的屬性，SwiftUI 才會追蹤變化。

傳遞值類型給子視圖會切斷觀察鏈。當你把 struct 從 observable 取出來傳給子視圖，那個子視圖就不再觀察原始的 observable 了。

SwiftUI 用 `id` 來判斷是否需要重新渲染。如果 `id` 沒變，SwiftUI 可能會跳過整個 view 的更新。

內聯或許不夠優雅，但它能動。

---

這個 bug 讓我抓狂了一整天。換成 `ObservableObject` 可以，但都用 Swift 6 了還回去用舊的？強制替換陣列元素沒用，重新賦值整個陣列也沒用。

最後發現問題根本不在 `@Observable`，而是在 SwiftUI 的子視圖快取機制。

反正就記住：`@Observable` UI 不更新的話，先檢查你是不是把值類型傳給了子視圖。

---

*寫於 2025 年 12 月，在 Linux 上用 xtool 交叉編譯 iOS App 的某個深夜。是的，我沒有 Mac。*
