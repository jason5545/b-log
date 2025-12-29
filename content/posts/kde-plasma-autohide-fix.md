# KDE Plasma 6 面板自動隱藏失效的解決方法

開始用 KDE Neon 之後遇到一個很煩的問題：底部面板的自動隱藏功能用一段時間就會失效，面板卡在那邊不會縮回去，每次都得手動重啟 plasmashell 才能恢復。一天下來重啟了五次。

## 問題現象

- 面板設定為「自動隱藏」模式
- 剛開機時運作正常
- 用一段時間後，面板就不會自動隱藏了
- 滑鼠移開面板區域也沒用，它就是賴在那裡不走
- 重啟 `plasmashell` 後暫時恢復，但過一陣子又會發生

## 查 log

```bash
journalctl --user -u plasma-plasmashell.service -b
journalctl -b | grep -i plasmashell
```

發現幾個可疑的錯誤訊息：

```
plasmashell: qrc:/qt/qml/plasma/applet/org/kde/plasma/notifications/global/Globals.qml:521:13: Unable to assign [undefined] to bool
plasmashell: BatteryItem: Binding loop detected for property "width"
```

看起來通知和電池小工具有點問題，但應該不是主因。

Google 了一下，原來這是個老問題——[Bug 330356](https://bugs.kde.org/show_bug.cgi?id=330356) 從 2013 年就有人在抱怨，到現在還是陰魂不散。

## 解決方法

翻了一下 bug report 的討論串，大家都說兇手是任務管理器的「當視窗需要注意時取消隱藏」選項。關掉它就好了。

### 方法一：透過 GUI 設定

1. 右鍵點擊任務管理器（或 Icon Tasks）
2. 選擇「設定圖示任務...」
3. 找到「當視窗需要注意時取消隱藏」
4. 取消勾選
5. 套用

### 方法二：直接改設定檔

編輯 `~/.config/plasma-org.kde.plasma.desktop-appletsrc`，在任務管理器的 `[Configuration][General]` 區段加入：

```ini
unhideOnAttentionNeeded=false
```

然後重啟 plasmashell：

```bash
kquitapp6 plasmashell && plasmashell &
```

## 還是不行的話

如果上面的方法沒用，可以再試試：

1. **檢查通知**——關閉所有懸停的通知視窗
2. **換用「視窗進入時隱藏」模式**——比自動隱藏穩定一些
3. **按 `Meta+Alt+P`**——切換面板焦點，有時候能讓它恢復
4. **檢查合成器設定**——系統設定 → 顯示 → 合成器 → 把「保留視窗縮圖」改成「僅限顯示的視窗」

---

關掉那個選項之後，用了幾個小時都沒再發生，應該是解決了。Plasma 6 + Wayland 還是有些小毛病，繼續觀察。
