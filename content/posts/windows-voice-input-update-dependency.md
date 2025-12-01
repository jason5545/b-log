# 語音辨識進步了，但 Windows 還是那個 Windows

## 前言

作為一個只能用單指打字的開發者，任何能減少鍵盤操作的工具對我來說都是剛需。Windows 11 的語音輸入（Win+H）本來用得好好的，結果某天突然就壞了。

更詭異的是：語音輸入面板能正常叫出來，但麥克風按鈕完全按不下去。就像一個裝飾品一樣擺在那邊。

## 問題症狀

- 按 `Win + H` 可以叫出語音輸入面板 ✅
- 面板正常顯示，沒有錯誤訊息 ✅
- 但麥克風按鈕完全沒反應 ❌
- 點擊後沒有任何回饋，不會變色、不會啟動 ❌

## 排查過程

### 第一步：檢查服務狀態

我先確認相關服務是否正常運作：
```powershell
Get-Service TabletInputService, Audiosrv, AudioEndpointBuilder | Format-Table Name, Status, StartType
```

結果：**全部正常執行中**。

### 第二步：檢查麥克風權限
```powershell
# 檢查麥克風權限
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone"
```

結果：**權限正常開啟**。

### 第三步：修改登錄檔設定

網路上找到一些語音輸入相關的登錄檔設定，試著手動啟用：
```powershell
$settings = @(
    @("HKCU:\Software\Microsoft\Speech_OneCore", "HasAccepted", 1),
    @("HKCU:\Software\Microsoft\Speech_OneCore", "VoiceActivationEnableAboveLock", 1),
    @("HKCU:\Software\Microsoft\Speech_OneCore\Settings\SpeechRecognizer", "UseRelaxedRecognition", 1),
    @("HKCU:\Software\Microsoft\Speech_OneCore\Settings\VoiceActivation", "VoiceActivationEnableAboveLock", 1),
    @("HKLM:\SOFTWARE\Policies\Microsoft\InputPersonalization", "AllowInputPersonalization", 1)
)

foreach ($s in $settings) {
    if (!(Test-Path $s[0])) { New-Item -Path $s[0] -Force | Out-Null }
    Set-ItemProperty -Path $s[0] -Name $s[1] -Value $s[2]
}
```

結果：**還是沒用**。

### 第四步：檢查麥克風硬體

測試其他使用麥克風的應用程式（Discord、錄音機等）：**完全正常**。

確定不是硬體問題。

## 真正的原因

在快要放棄的時候，我突然想到一件事：

**我之前用 WinUtil (Chris Titus Tech) 優化工具，把 Windows Update 服務完全停用了。**

抱著試試看的心態，我把 Windows Update 改回自動啟動：
```powershell
Set-Service -Name wuauserv -StartupType Automatic
Start-Service -Name wuauserv
```

重開機後... **語音輸入復活了！** 🎉

## 為什麼語音輸入會依賴 Windows Update？

這個問題我到現在還是百思不得其解。

根據推測，可能的原因：

1. **語音模型透過 Windows Update 更新**
   - Windows 的雲端語音辨識需要定期下載更新的模型
   - 這些模型可能走 Windows Update 的通道

2. **服務依賴關係**
   - 語音輸入可能依賴某個由 Windows Update 啟動的元件
   - 系統檢查到 Update 服務完全停用，就不啟動相關功能

3. **功能檢查機制**
   - 系統認為「需要更新支援」的功能，在 Update 停用時會被禁用

無論如何，這種隱藏的依賴關係真的很反直覺。

語音輸入跟 Windows Update 八竿子打不著關係，結果卻是這樣設計的。

**Desktop Linux of the year.** 🙃

## 最終解決方案

但我還是不想讓 Windows Update 亂跑，所以採用了折衷方案：

### 延遲更新到 2042 年 + WinUtil

透過群組原則編輯器或登錄檔，把更新延遲到遙遠的未來：
```
設定 → Windows Update → 進階選項 → 暫停更新
→ 選擇日期：2042/12/31
```

或用登錄檔：
```powershell
New-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -Name "PauseDeferrals" -Value 1 -PropertyType DWORD -Force
New-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -Name "PauseFeatureUpdatesStartTime" -Value "2025-11-30T00:00:00Z" -PropertyType String -Force
New-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -Name "PauseFeatureUpdatesEndTime" -Value "2042-12-31T00:00:00Z" -PropertyType String -Force
```

這樣做的好處：

- ✅ Windows Update 服務狀態 = Running（滿足依賴關係）
- ✅ 實際上不會檢查更新（還要 17 年）
- ✅ 語音輸入正常運作
- ✅ 系統不會被自動更新騷擾

再搭配 WinUtil 關閉其他不需要的功能，完美。

## 意外的驚喜：辨識率大幅進步

修好語音輸入後，實際使用了一陣子，發現一件很驚喜的事：

**Windows 語音輸入的繁體中文辨識率已經不輸 Gboard 了。**

我記得幾年前試用時，Windows 的中文辨識還很糟糕，常常辨識錯誤或是完全聽不懂。但現在：

- ✅ **辨識準確度高**：一般對話幾乎不會錯
- ✅ **標點符號智慧處理**：能正確判斷逗號、句號的位置
- ✅ **反應速度快**：幾乎即時轉換成文字
- ✅ **台灣用語支援**：「程式設計」「檔案」「設定」都能正確辨識，不會變成簡體用語

對比：

| 功能 | Windows 語音輸入 | Gboard 語音輸入 |
|------|------------------|------------------|
| 繁體中文準確度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 標點符號處理 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 整合度 | ⭐⭐⭐⭐⭐ (系統原生) | ⭐⭐⭐ (僅限行動裝置) |
| 隱私性 | ⭐⭐⭐ (微軟雲端) | ⭐⭐⭐ (Google 雲端) |
| 啟動速度 | ⭐⭐⭐⭐⭐ (Win+H) | ⭐⭐⭐⭐ |

對我這種單指打字的使用者來說，這是個重大進步。

以前可能會想「反正辨識率不好，還是自己慢慢打」，但現在真的可以當成主要輸入方式了。

## 結論

這次經驗讓我學到：

1. **Windows 的服務依賴關係很複雜**，有時候完全不合邏輯
2. **「完全停用」和「延遲/手動啟動」是不同的**，前者可能影響依賴鏈
3. **排查問題要從意想不到的角度思考**，誰能想到語音輸入要靠 Windows Update？
4. **技術在進步**，幾年沒用的功能，現在可能已經變得很實用了

如果你也遇到類似問題，希望這篇文章能幫到你。

如果你跟我一樣需要減少鍵盤操作，強烈推薦試試看現在的 Windows 語音輸入。辨識率真的提升很多。

至於為什麼 Windows 要這樣設計... 我也不知道。

**2042 年的時候記得改回來。** 😂

---

*延伸閱讀：*
- [WinUtil - Chris Titus Tech](https://github.com/ChrisTitusTech/winutil)
- [Windows 語音輸入官方文件](https://support.microsoft.com/zh-tw/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc-fec94565-c4bd-329d-e59a-af033fa5689f)
