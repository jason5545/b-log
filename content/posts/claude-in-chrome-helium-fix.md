# 讓 Claude Code 的瀏覽器自動化功能在 Helium 上運作

今天花了一點時間解決了一個有趣的問題：Claude Code 的全新瀏覽器自動化功能（Claude in Chrome）在我使用的 Helium 瀏覽器上無法運作。

## 問題背景

我用的是 [Helium](https://github.com/nickhol/helium)，一個基於 Chromium 的瀏覽器 fork，以 AppImage 形式運行。當我嘗試使用 Claude Code 的 `/chrome` 指令時，一直顯示「Browser extension is not connected」。

## 調查過程

首先確認 Helium 確實有在運行，也已經安裝了 Claude in Chrome 擴充套件：

```bash
ps aux | grep helium
ls ~/.config/net.imput.helium/Default/Extensions/
```

擴充套件 ID `fcoeoabgfenejglbffodgkkbkcdhcgfn` 確實存在。

### 問題一：Native Messaging 設定缺失

Chrome 擴充套件透過 Native Messaging 與本地程式溝通。檢查後發現：

```bash
# Chrome 有設定
ls ~/.config/google-chrome/NativeMessagingHosts/
# com.anthropic.claude_code_browser_extension.json ✓

# Helium 沒有
ls ~/.config/net.imput.helium/NativeMessagingHosts/
# (空的)
```

**解法**：複製 manifest 檔案

```bash
cp ~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json \
   ~/.config/net.imput.helium/NativeMessagingHosts/
```

重啟 Helium 後，Native Host 進程成功啟動了，但還是連不上。

### 問題二：Socket 路徑不一致

查看 debug log 發現關鍵問題：

```
[Claude in Chrome] Attempting to connect to: /home/jason/.claude-tmp/claude-mcp-browser-bridge-jason
[Claude in Chrome] Socket error: ENOENT
```

但 Native Host 實際建立 socket 的位置是：

```bash
ls /tmp/claude-mcp-browser-bridge-jason  # 存在！
```

路徑不一致導致 MCP 找不到 socket。

**解法**：建立 symlink

```bash
mkdir -p ~/.claude-tmp
ln -sf /tmp/claude-mcp-browser-bridge-jason ~/.claude-tmp/claude-mcp-browser-bridge-jason
```

成功連線。

## 永久修復

為了讓修復在重開機後仍然有效，建立 systemd user service：

```bash
cat > ~/.config/systemd/user/claude-chrome-bridge.service << 'EOF'
[Unit]
Description=Create Claude Chrome bridge symlink
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'mkdir -p ~/.claude-tmp && ln -sf /tmp/claude-mcp-browser-bridge-%u ~/.claude-tmp/claude-mcp-browser-bridge-%u'
RemainAfterExit=yes

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable claude-chrome-bridge.service
```

## Claude in Chrome 功能介紹

這個功能讓 Claude Code 可以直接操作瀏覽器，包括：

- **導航**：開啟網頁、前進後退
- **截圖**：擷取當前頁面畫面
- **點擊/輸入**：與網頁元素互動
- **讀取頁面**：取得 accessibility tree 或純文字內容
- **執行 JavaScript**：在頁面 context 中執行程式碼
- **GIF 錄製**：錄製操作過程

實測在 Helium 上運作正常，成功開啟 example.com 並截圖。

---

這次的問題本質上是 Claude Code 只針對標準 Chrome 設定了路徑，使用其他 Chromium fork 時需要手動橋接。
