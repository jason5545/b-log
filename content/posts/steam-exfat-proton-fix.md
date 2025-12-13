# Steam 遊戲不跑了，然後我發現是 exFAT 不支援 symlink

把 Steam 遊戲裝在 exFAT 外接硬碟，想用 Proton 跑 Windows 遊戲，結果噴錯：

```
PermissionError: [Errno 1] Operation not permitted: '../AppData/Local' ->
'/media/jason/0123-4567/SteamLibrary/steamapps/compatdata/2062430/pfx/drive_c/users/steamuser/Local Settings/Application Data'
```

看起來是權限問題？

不是。

---

Proton 需要在 `compatdata` 資料夾裡建 symlink 來模擬 Windows 的目錄結構。

exFAT 不支援 symlink。

就這樣。

---

解法是把 compatdata（Wine prefix）放到內部硬碟，遊戲檔案繼續留在外接硬碟。

先把壞掉的 compatdata 砍掉：

```bash
rm -rf /media/jason/0123-4567/SteamLibrary/steamapps/compatdata/2062430
```

在內部硬碟建新的：

```bash
mkdir -p ~/.local/share/Steam/steamapps/compatdata/2062430
```

然後在 Steam 遊戲的啟動選項加環境變數：

```
STEAM_COMPAT_DATA_PATH="/home/你的使用者名稱/.local/share/Steam/steamapps/compatdata/遊戲ID" %command%
```

或者直接改 `~/.local/share/Steam/userdata/你的ID/config/localconfig.vdf`：

```
"LaunchOptions"		"STEAM_COMPAT_DATA_PATH=\"/home/jason/.local/share/Steam/steamapps/compatdata/2062430\" %command%"
```

改設定檔前記得先關 Steam。

---

重開 Steam 跑遊戲，應該會看到：

```
Proton: Upgrading prefix from None to 10.1000-200 (/home/jason/.local/share/Steam/steamapps/compatdata/2062430/)
fsync: up and running.
```

這樣就對了。

---

結論：遊戲檔案放 exFAT 沒問題，但 Proton 的 compatdata 要放在支援 symlink 的檔案系統（ext4）。

其他選項？把整個遊戲移回內部硬碟、外接硬碟改格式化成 ext4、或用 NTFS。但都比較麻煩。
