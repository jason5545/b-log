# 我把 Mac 的「查詢／字典」功能徹底關掉了（而且保留 Force Click）

最近我有個很煩的問題：Mac 的「查詢（Look Up）」視窗會突然跳出來，有時甚至直接冒出字典。

我平常根本不需要用系統字典。要查中英字典或 Wikipedia，我會直接開瀏覽器，或用我常用的工具。這個功能對我來說不是效率加成，反而是干擾。

這篇是我實際處理這件事的完整紀錄：我怎麼判斷觸發來源、怎麼關掉、怎麼做到「登入後自動維持 disabled」。

## 問題長相

我遇到的狀況有兩類：

- 文字附近突然彈出「查詢」面板
- 不小心觸發字典視窗

一開始直覺會以為是 Trackpad 手勢，但查完我才發現，真正容易誤觸的是快捷鍵：

- `Control + Command + D`

## 我做的第一層處理：先封掉常見入口

我先做了三件事：

- 關閉 `Look Up & data detectors` 手勢（避免點按誤觸）
- 把 `Control + Command + D` 改成 `noop`（無動作）
- 一度關掉 Force Click（後來再調整回來）

`Control + Command + D` 的攔截是透過：

- `/Users/jianruicheng/Library/KeyBindings/DefaultKeyBinding.dict`

內容如下：

```plist
{
    "^@d" = "noop:";
}
```

這樣就算我誤按該組合鍵，也不會再跳字典。

## 關鍵認知：不是 Dictionary.app，而是系統 XPC 服務

我本來也想過「乾脆把 App 刪掉」，但實際上觸發這件事的不是單一 App，而是系統服務。

我查到主要是兩個服務：

- `com.apple.LookupViewService`（查詢彈窗 UI）
- `com.apple.DictionaryServiceHelper`（字典資料服務）

所以真正有效的方式不是刪 App，而是把服務層停用。

## 我最後採用的方案

我的目標很明確：

- 保留 `Force Click` 在其他場景可用（例如預覽）
- 讓 `Look Up / 字典` 完全不會跳出

我最後組合是：

- `launchctl disable` 這兩個 Lookup 服務
- 保持 `Control + Command + D` 為 `noop`
- 重新啟用 Force Click（不讓它影響其他功能）

## 長期方案：登入自動維持 disabled

我不想每次更新後手動重做，所以加了一層自動化。

我建立了：

- Script: `~/Library/Scripts/ensure_lookup_disabled.sh`
- LaunchAgent: `~/Library/LaunchAgents/com.jianruicheng.lookup-disable-enforcer.plist`

設定內容是：

- `RunAtLoad = true`（登入就跑）
- `StartInterval = 600`（每 10 分鐘重檢）

腳本會做幾件事：

- 重新 `disable` 這兩個服務
- 如果服務進程已啟動就嘗試關掉
- 確保 `Control + Command + D` 還是 `noop`
- 保持 Force Click 為可用

## 我怎麼驗證

我用這行確認服務狀態：

```bash
launchctl print-disabled gui/$(id -u) | rg 'LookupViewService|DictionaryServiceHelper'
```

我期望看到：

- `com.apple.LookupViewService => disabled`
- `com.apple.DictionaryServiceHelper => disabled`

另外，我也實測兩件事：

- `Control + Command + D` 不再有反應
- Force Click 在預覽等用途仍可用

## 這樣做的取捨

我接受的取捨是：

- 我放棄系統層的文字查詢入口
- 我換回乾淨、不中斷的操作流程

對我來說這是明顯正收益，因為我本來就不會用系統字典。我查東西寧可去瀏覽器或其他工具。

## 結論

這次我學到一件事：

Mac 的「Look Up」不是單一 App 功能，而是系統服務鏈的一部分。要徹底關閉，不能只在 UI 裡關手勢，必須連服務層一起處理，最好再加登入自動維護。

現在我的狀態是：

- 不再被字典彈窗干擾
- Force Click 仍保留我想要的用途
- 就算系統重啟或日常使用，也能自動維持設定

如果未來大版本更新把設定蓋掉，我的 LaunchAgent 也會把它拉回我要的狀態。
