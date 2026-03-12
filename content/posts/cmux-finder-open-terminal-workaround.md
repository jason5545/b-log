# cmux 的 Finder「在終端機中開啟」不帶路徑？用 wrapper app 解決

## 問題

把 [cmux](https://github.com/manaflow-ai/cmux)（Ghostty fork）設為 macOS 預設終端機後，Finder 路徑列右鍵「在終端機中開啟」只會開新視窗，**不會帶入資料夾路徑**。

但從 Finder 右鍵選「服務 → New cmux Window Here」卻完全正常。iTerm2 也沒有這個問題。

## 根因分析

Finder 的「在終端機中開啟」透過 `kAEOpenDocuments`（odoc）Apple Event 把資料夾路徑送給預設終端機 app，對應到 `NSApplicationDelegate` 的 `application(_:openFile:)` 方法。

查看 [Ghostty 上游原始碼](https://github.com/ghostty-org/ghostty)，`AppDelegate.swift` 有完整的 `application(_:openFile:)` 實作：

```swift
func application(_ sender: NSApplication, openFile filename: String) -> Bool {
    // ...
    if isDirectory.boolValue {
        config.workingDirectory = filename
    }
    // ...
}
```

但 cmux fork 的 `Sources/AppDelegate.swift` **完全沒有這個方法**。所以：

1. Finder 送出 odoc 事件 → cmux 沒有 handler
2. App 被啟動/激活 → 開預設新視窗
3. 路徑被忽略 → 工作目錄停在 `~`

Services 之所以正常，是因為走的是 `NSPasteboard` + `NSServices` 機制，跟 odoc Apple Event 完全不同。

## 嘗試 cmux CLI → 失敗

cmux 有 CLI 工具，支援 `new-window --command` 參數。從 cmux 終端機內部執行完全正常：

```bash
cmux --socket /tmp/cmux.sock new-window --command "cd /tmp && exec zsh"
# OK FF8F7F1F-...
```

但從外部 app 呼叫時，exit code 141（SIGPIPE）。原因是 cmux socket 的 `access_mode: "cmuxOnly"` 需要認證，外部 process 沒有憑證。

## 解法：CmuxOpener wrapper app

既然 Services 能正常運作，就做一個小型 Swift app 當中間人：

1. 接收 Finder 的 `application(_:openFile:)` 事件
2. 透過 `NSPerformService` 轉發給 cmux 的 Service
3. 設為預設終端機

```swift
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    private var didOpenFile = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self, !self.didOpenFile else { return }
            NSWorkspace.shared.open(
                URL(fileURLWithPath: "/Applications/cmux.app"))
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                NSApp.terminate(nil)
            }
        }
    }

    func application(_ sender: NSApplication,
                     openFile filename: String) -> Bool {
        didOpenFile = true

        var isDirectory = ObjCBool(false)
        guard FileManager.default.fileExists(
            atPath: filename, isDirectory: &isDirectory) else {
            return false
        }

        let directory = isDirectory.boolValue
            ? filename
            : (filename as NSString).deletingLastPathComponent
        openViaPasteboard(directory: directory)
        return true
    }

    private func openViaPasteboard(directory: String) {
        let pb = NSPasteboard(
            name: .init("com.cmuxterm.opener.service"))
        pb.clearContents()
        pb.writeObjects(
            [URL(fileURLWithPath: directory) as NSURL])
        pb.setPropertyList([directory],
            forType: NSPasteboard.PasteboardType(
                "NSFilenamesPboardType"))
        NSPerformService("New cmux Workspace Here", pb)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            NSApp.terminate(nil)
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
```

### Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.cmuxterm.opener</string>
    <key>CFBundleName</key>
    <string>CmuxOpener</string>
    <key>CFBundleExecutable</key>
    <string>CmuxOpener</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSBackgroundOnly</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
</dict>
</plist>
```

### 編譯與部署

```bash
# 建立 app bundle
mkdir -p /Applications/CmuxOpener.app/Contents/MacOS

# 編譯
swiftc CmuxOpener.swift \
  -o /Applications/CmuxOpener.app/Contents/MacOS/CmuxOpener \
  -framework AppKit

# 放入 Info.plist
cp Info.plist /Applications/CmuxOpener.app/Contents/

# 設為預設終端機
swift -e '
import Foundation; import CoreServices
let id = "com.cmuxterm.opener" as CFString
for t in ["public.unix-executable",
          "public.shell-script",
          "com.apple.terminal.shell-script"] {
    LSSetDefaultRoleHandlerForContentType(
        t as CFString, .shell, id)
}
'
```

## 結果

Finder 路徑列右鍵「在終端機中開啟」→ CmuxOpener 接收路徑 → 透過 NSPerformService 觸發 cmux 的 Service → cmux 開新 tab 並帶入正確工作目錄。

整個 wrapper app 編譯後只有幾十 KB，`LSBackgroundOnly` 讓它不會出現在 Dock，用完自動結束。
