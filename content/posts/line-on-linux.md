# 在 KDE Wayland 上讓 LINE 支援中文輸入法的折騰之旅

## 前言

身為一個 Linux 使用者，最痛苦的事情之一就是要用 Windows 專屬的通訊軟體。LINE 沒有官方 Linux 版本，所以只能透過 Wine 來執行 Windows 版。但更麻煩的是，我用的是 fcitx5-rime 輸入法，在 Wine 裡面根本打不出中文！今天就來記錄一下我是怎麼解決這個問題的。

## 我的環境

- **系統**：KDE Neon (Ubuntu 24.04 base)
- **桌面**：KDE Plasma + Wayland
- **輸入法**：fcitx5-rime
- **Wine 管理工具**：Bottles (Flatpak)

## 問題描述

一開始我用 Bottles 安裝 LINE，程式本身跑得很順，但就是沒辦法用 fcitx5 輸入中文。切換輸入法後，完全沒有反應，只能打英文。

## 嘗試過的方法（都失敗了）

### 1. 設定 Flatpak 環境變數

我先試著幫 Bottles 加上 fcitx5 的環境變數：

```bash
flatpak override --user com.usebottles.bottles \
  --env=XMODIFIERS=@im=fcitx5 \
  --env=GTK_IM_MODULE=fcitx \
  --env=QT_IM_MODULE=fcitx
```

結果：**沒用**。

### 2. 修改 Wine Registry

接著我修改了 Wine 的登錄檔，加入 X11 Driver 的 InputStyle 設定：

```
[Software\\Wine\\X11 Driver]
"InputStyle"="root"
"UseXIM"="1"
```

試過 `root`、`onthespot`、`overthespot` 三種模式，結果：**全部沒用**。

### 3. 修改 Bottles 的 bottle.yml

把環境變數直接寫進 Bottles 的設定檔，結果：**還是沒用**。

## 問題的根源

經過一番研究，我發現問題出在 **Flatpak 的沙盒機制**。Bottles 是透過 Flatpak 安裝的，而 Flatpak 的沙盒會阻擋 fcitx5 與 Wine 之間的通訊。這在 Wayland 環境下尤其嚴重。

GitHub 上也有相關的 issue（[Bottles #3840](https://github.com/bottlesdevs/Bottles/issues/3840)），證實這是一個已知問題。

## 最終解決方案：繞過 Flatpak

既然 Flatpak 是問題的根源，那就不要用 Flatpak 跑 Wine 就好了！但我又不想重新下載 Wine，所以我直接借用 Bottles 裡面的 Wine runner。

### 步驟 1：建立獨立的 Wine Prefix

```bash
mkdir -p ~/Wine/LINE
```

### 步驟 2：從 Bottles 複製 LINE 資料

因為我已經在 Bottles 裡裝好 LINE 了，直接把資料複製過來：

```bash
cp -r ~/.var/app/com.usebottles.bottles/data/bottles/bottles/LINE/drive_c/users/jason/AppData/Local/LINE/Data ~/Wine/LINE/drive_c/users/jason/AppData/Local/LINE/
```

### 步驟 3：建立啟動腳本

建立 `~/Wine/LINE/run-line.sh`：

```bash
#!/bin/bash
export WINEPREFIX="/home/jason/Wine/LINE"
export XMODIFIERS="@im=fcitx"
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export SDL_IM_MODULE=fcitx
export INPUT_METHOD=fcitx
export LC_ALL=zh_TW.UTF-8

# 使用 Bottles 的 kron4ek Wine
WINE_PATH="$HOME/.var/app/com.usebottles.bottles/data/bottles/runners/kron4ek-wine-10.18-amd64/bin"

"$WINE_PATH/wine" "$WINEPREFIX/drive_c/users/jason/AppData/Local/LINE/bin/LineLauncher.exe" "$@"
```

記得加上執行權限：

```bash
chmod +x ~/Wine/LINE/run-line.sh
```

### 步驟 4：設定 DPI（HiDPI 螢幕適用）

如果你的螢幕是高解析度的，文字可能會很小。修改 `~/Wine/LINE/user.reg`，找到 `LogPixels` 並改成你需要的 DPI：

```
"LogPixels"=dword:000000fa
```

`0xFA` 是 250 DPI，可以根據自己的螢幕調整。

### 步驟 5：建立桌面捷徑

編輯 `~/.local/share/applications/wine/Programs/LINE/LINE.desktop`：

```ini
[Desktop Entry]
Name=LINE
Exec=env WINEPREFIX="/home/jason/Wine/LINE" XMODIFIERS="@im=fcitx" GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx /home/jason/.var/app/com.usebottles.bottles/data/bottles/runners/kron4ek-wine-10.18-amd64/bin/wine /home/jason/Wine/LINE/drive_c/users/jason/AppData/Local/LINE/bin/LineLauncher.exe
Type=Application
StartupNotify=true
Icon=196C_LineLauncher.0
Categories=Network;InstantMessaging;
```

更新桌面資料庫：

```bash
update-desktop-database ~/.local/share/applications
```

## 結果

成功了！現在可以在 LINE 裡面用 fcitx5-rime 打中文了。

## 重點整理

1. **Flatpak 沙盒是元兇**：fcitx5 在 Flatpak 環境下無法正常與 Wine 通訊
2. **解決方案**：直接用 Bottles 裡的 Wine runner，但不透過 Flatpak 執行
3. **必要的環境變數**：`XMODIFIERS`、`GTK_IM_MODULE`、`QT_IM_MODULE` 等
4. **Wine runner**：kron4ek-wine 比官方 WineHQ 更適合跑 LINE

## 已知問題：會影響 KDE 面板自動隱藏

透過 Wine 執行的 LINE 會導致 KDE Plasma 底部面板的自動隱藏功能失效。每次 LINE 有新訊息通知，面板就會跳出來然後卡住不隱藏。

**解法**：把 LINE 視窗重新最小化一次，面板就會恢復正常。

詳細說明請參考：[KDE Plasma 6 面板自動隱藏失效的解決方法](https://b-log.to/tech-analysis/kde-plasma-autohide-fix/)

## 後記

Linux 桌面真的很折騰，但折騰完的成就感也是無可取代的。希望這篇文章能幫到同樣在 Linux 上掙扎的朋友們！
