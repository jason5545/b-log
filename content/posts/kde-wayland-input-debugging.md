# 在 KDE Wayland 上實現語音輸入：一段痛苦又有趣的偵錯之旅

## 前言

最近我在開發 XVoice——一個跨平台的語音輸入系統。這個專案的核心功能很簡單：用麥克風錄音，透過 Whisper 辨識成文字，然後自動輸入到當前視窗。在 Windows 上一切順利，但當我切換到 Linux 的 KDE Plasma Wayland 環境時，噩夢開始了。

## 問題浮現

語音辨識的部分運作正常，Whisper 成功地把我說的「你好」轉換成文字。但是，文字就是打不出來。終端機顯示「已輸入: 你好」，可是目標視窗什麼都沒有。

一開始我以為是程式碼的問題，花了不少時間 debug，後來才發現——這是 Wayland 的「特色」。

## Wayland 的安全模型：福還是禍？

Wayland 為了安全性，移除了 X11 時代大部分的輸入模擬 API。在 X11 上，xdotool 可以輕鬆模擬鍵盤輸入，但 Wayland 認為這是安全漏洞——惡意程式可能會偷偷打字或竊取輸入。

理念很好，但對我這種需要模擬輸入的開發者來說，簡直是災難。

## 嘗試一：wtype

我首先嘗試了 wtype，這是專門為 Wayland 設計的輸入工具：

```bash
wtype "測試"
```

結果：
```
Compositor does not support the virtual keyboard protocol
```

原來 wtype 依賴 `virtual-keyboard` 協議，但 KDE 的 KWin 不支援這個協議。GG。

## 嘗試二：ydotool

接著我試了 ydotool，它透過 Linux 核心的 uinput 模擬輸入裝置：

```bash
sudo usermod -aG input $USER  # 加入 input 群組
# 重新登入
ydotool type "測試"
```

結果：指令執行了，但中文字沒出現。後來查到 [GitHub Issue](https://github.com/ReimuNotMoe/ydotool/issues/249) 才知道，ydotool 只能模擬鍵盤按鍵，無法直接輸入 Unicode 字元。它會把「測」拆成鍵盤按鍵，但中文根本不在鍵盤上啊！

## 嘗試三：dotool

dotool 是另一個類似的工具：

```bash
echo "type 測試中文" | dotool
```

結果：
```
dotool: WARNING: impossible character for layout: 測
dotool: WARNING: impossible character for layout: 試
```

一樣的問題——這些工具都是在鍵盤層級運作，不是字元層級。

## 嘗試四：剪貼簿模式

既然直接輸入不行，那就用剪貼簿吧：

```bash
echo "你好" | wl-copy  # 複製到剪貼簿
echo "key ctrl+v" | dotool  # 模擬 Ctrl+V
```

`wl-copy` 成功了，但 `dotool` 的 Ctrl+V 似乎沒有效果。我懷疑是 KDE 的問題，但沒有深究。

這個方案勉強可用——文字會複製到剪貼簿，使用者手動按 Ctrl+V 貼上。但這不是我想要的體驗。

## 深入研究：Fcitx5 D-Bus

我開始研究 Fcitx5 輸入法的 D-Bus 介面，想說或許可以直接透過輸入法提交文字：

```bash
busctl --user introspect org.fcitx.Fcitx5 /controller
```

結果發現 Fcitx5 的標準 D-Bus 介面沒有 `CommitString` 方法。有人為舊版 Fcitx 寫過 [fcitx-dbus-commit-string](https://github.com/amosbird/fcitx-dbus-commit-string) 插件，但 Fcitx5 沒有對應的版本。

## 轉機：發現 KWtype

就在我快要放棄的時候，搜尋到了 [KWtype](https://github.com/Sporif/KWtype)——一個專門為 KDE Wayland 設計的虛擬鍵盤工具。

它使用 KWin 的 Fake Input 協議，這是 KDE 專屬的特權協議。編譯安裝：

```bash
git clone https://github.com/Sporif/KWtype.git
cd KWtype
meson setup --buildtype=release build
sudo ninja -C build install
```

測試：

```bash
kwtype "測試中文輸入"
```

成功了！文字直接出現在游標位置，包括中文！

## 最終解決方案

我更新了 XVoice 的 Wayland 輸出模組，優先使用 KWtype：

```python
def _detect_tool(self) -> str | None:
    # 優先使用 kwtype（KDE Wayland 專用，支援中文）
    if self._kwtype_path:
        return "kwtype"

    # 備選方案...
    if self._ydotool_path:
        return "ydotool"

    if self._wtype_path:
        return "wtype"

    return None
```

對於中文輸入：

```python
def type_text(self, text: str) -> None:
    # kwtype 支援中文，優先使用
    if self._tool == "kwtype":
        subprocess.run([self._kwtype_path, text], check=True)
        return

    # 其他工具不支援中文，使用剪貼簿模式
    has_non_ascii = any(ord(c) > 127 for c in text)
    if has_non_ascii:
        self.type_with_clipboard(text)
        return
```

## 心得總結

這次偵錯經歷讓我深刻體會到：

1. **Wayland 生態還不成熟**：雖然 Wayland 的安全模型很好，但配套工具還跟不上。不同桌面環境各自為政，沒有統一的輸入模擬方案。

2. **KDE 有自己的路**：KDE 不支援 `virtual-keyboard` 協議，但有自己的 Fake Input。這種分裂讓跨平台開發很痛苦。

3. **中文輸入是另一個維度**：大部分輸入模擬工具只考慮英文鍵盤，對於 CJK 字元完全無能為力。

4. **小眾工具是救星**：KWtype 這種小眾專案往往能解決大問題，感謝開源社群。

5. **記錄很重要**：我把整個調查過程記錄在 `docs/WAYLAND_INPUT_ISSUE.md`，下次遇到類似問題可以快速回顧。

## 工具總結

| 工具 | 平台 | 中文支援 | KDE 支援 | 備註 |
|------|------|----------|----------|------|
| xdotool | X11 | ✓ | N/A | X11 限定 |
| wtype | Wayland | ✓ | ✗ | 需要 virtual-keyboard 協議 |
| ydotool | 通用 | ✗ | ✓ | 只支援鍵盤按鍵 |
| dotool | 通用 | ✗ | ✓ | 同上 |
| KWtype | KDE Wayland | ✓ | ✓ | KDE 專用，推薦 |

## 後記

如果你也在 KDE Wayland 上開發需要模擬輸入的應用，希望這篇文章能幫你少走一些彎路。記住：**先找 KWtype**！

專案連結：[XVoice on GitHub](https://github.com/jason5545/xvoice)

---

*寫於解決問題的那個深夜，帶著如釋重負的心情。*
