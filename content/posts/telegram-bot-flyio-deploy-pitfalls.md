# 把 Telegram Bot 丟上 Fly.io：七個坑和一次 52 分鐘的強制等待

## 背景

我有一個 Telegram Bot Controller——一個 master bot 加上一個 MTProto userbot，用來統一控制多個子 bot（OpenClaw 的 Izukibot、ClaudeBot 等）。使用者只跟 master bot 對話，userbot 當中間人轉發訊息和代理 inline button。

技術棧是 PyroTGFork（Pyrogram 的活躍 fork，原版已停止維護），同時跑 Bot API client 和 MTProto User API client，用 `compose()` 同時啟動。

本來在本機跑，但 bot 這種東西需要 24/7 運行。看了一圈 serverless 選項，Fly.io 免費方案（shared-cpu-1x / 256MB）剛好夠用，東京節點離台灣最近，延遲也可以接受。

以下是部署過程中踩的每一個坑。

## 第一坑：tgcrypto 需要 gcc

Dockerfile 用了 `python:3.13-slim` 作為 base image——slim 嘛，輕量。`pip install` 一跑，tgcrypto 直接報錯：找不到 `gcc`。

tgcrypto 是 C extension，需要編譯。slim image 裡沒有編譯器。

解法是用多階段建置：builder stage 裝 gcc，編譯完再 copy 到乾淨的 slim image。這樣最終 image 不會帶著 200MB 的 gcc：

```dockerfile
FROM python:3.13-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
COPY --from=builder /install /usr/local
```

但第一次我只加了 `gcc`，沒加 `libc6-dev`。

## 第二坑：gcc 有了但 stdint.h 沒有

tgcrypto 的 C code 裡 `#include <stdint.h>`，這個頭檔在 `libc6-dev` 裡。光裝 gcc 不夠，還需要 C standard library 的 header files。

錯誤訊息倒是很直接：`fatal error: stdint.h: No such file or directory`。加上 `libc6-dev` 就解了。

這兩個坑加在一起其實是一個概念：**slim image 是真的 slim，連最基本的 C 開發工具鏈都沒有。** 如果你的依賴裡有任何 C extension（tgcrypto、uvloop、numpy、cryptography...），都需要在 builder stage 裝 gcc + libc6-dev。

## 第三坑：fly.toml 的 [processes] 會覆蓋 Dockerfile CMD

我的 Dockerfile 最後一行是：

```dockerfile
CMD ["/app/entrypoint.sh"]
```

`entrypoint.sh` 做兩件事：把 session 檔從 image 複製到持久化 volume，然後啟動 bot。

部署後，bot 一啟動就報「Enter phone number or bot token」——session 檔不在預期的位置。

查了半天，發現是 `fly.toml` 裡的 `[processes]` 覆蓋了 CMD：

```toml
[processes]
  app = "python -m bot_controller.main"
```

**`[processes]` 會完全取代 Dockerfile 的 CMD 和 ENTRYPOINT。** 這不是「追加」，是「取代」。所以 `entrypoint.sh` 根本沒被執行，session 檔也就沒被複製到 volume。

改成指向 entrypoint：

```toml
[processes]
  app = "/app/entrypoint.sh"
```

## 第四坑：Docker 快取不知道你改了 .dockerignore

改完 `[processes]` 之後重新部署，session 檔還是沒被打包進 image。

因為之前的 `.dockerignore` 裡包含了 `*.session`（當時還沒打算把 session 打包進 image）。後來決定要打包，把 `.dockerignore` 裡的 `*.session` 刪了。

但 Docker build cache 不在乎你改了 `.dockerignore`。`COPY *.session sessions/` 這一層已經被 cache 了，cache 裡的版本是空的 sessions 目錄。

解法：`fly deploy --no-cache`。

**任何時候你改了 `.dockerignore` 的排除規則，都必須清快取重建。** Docker 的 cache invalidation 是基於 `COPY` 的來源檔案內容，不包括 `.dockerignore` 的變更。

## 第五坑：Crash-Restart 循環觸發 Telegram FloodWait

session 檔終於打包進去了，entrypoint 也跑了，但 bot 啟動後立刻 crash——因為 session 檔是空的（第四坑的殘留）。Fly.io 的 machine 會自動重啟 crash 的 process。

每次重啟，Pyrogram 都會嘗試用 session 檔裡的 auth key 連線 Telegram。session 是空的，所以每次都走 `auth.ImportBotAuthorization`——相當於重新登入。

Telegram 看到同一個帳號在幾秒內重複登入十幾次，直接觸發 **FloodWait**：

```
420 FLOOD_WAIT (caused by "auth.ImportBotAuthorization")
Must wait 3133 seconds (52 minutes)
```

三千一百三十三秒。將近一個小時。

你什麼都不能做，只能等。而且**必須先停掉 machine**，否則 Fly.io 會繼續自動重啟，每次重啟都重新觸發 FloodWait，計時器重來。

教訓很清楚：**在部署 Telegram bot 之前，先確認 session 檔是正確的。** 如果 bot 會 crash，先手動停掉 machine 而不是讓它自動重啟。Telegram 的限速是根據嘗試次數累加的，越多次等越久。

## 第六坑：entrypoint 的 "不覆蓋" 邏輯

等了 52 分鐘，FloodWait 過了。用 `--no-cache` 重建了 image，確認 session 檔正確打包。重新部署。

bot 又 crash 了。一樣的 `"Enter phone number or bot token"`。

SSH 進去看 `/data/`（volume 掛載點），session 檔存在、大小 40960 bytes。再看 `/app/sessions/`（image 裡打包的），也是 40960 bytes。

問題在 entrypoint 的邏輯：

```sh
if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
fi
```

**「如果目標不存在才複製」。** 但之前的 crash 循環裡，Pyrogram 已經在 `/data/` 裡**創建了新的 session 檔**——空的、沒有有效 auth key 的 SQLite 資料庫。大小看起來一樣，但內容是壞的。

entrypoint 看到檔案存在，就不覆蓋了。好心辦壞事。

改成每次啟動都強制覆蓋，同時清除 SQLite journal 檔：

```sh
for f in /app/sessions/*.session; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    rm -f "/data/${base}-journal" "/data/${base}-shm" "/data/${base}-wal"
    cp "$f" "/data/$base"
done
```

這個設計取捨很明確：**session 檔的 source of truth 永遠是 image 裡打包的那份。** Volume 只是讓 Pyrogram 有地方寫 runtime 資料，但每次啟動都從 image 同步，確保不會因為 crash 產生的垃圾檔案而卡死。

## 第七坑：fly ssh console 裡的 glob 展開

發現第六坑之後，第一反應是 SSH 進去手動清理：

```bash
fly ssh console -C "rm -f /data/*.session /data/*.session-shm"
```

報錯：`rm: invalid option -- 'l'`。

`-C` 參數傳進去的字串，glob 展開的行為跟你預期的不一樣。`*.session-shm` 被 shell 解析成奇怪的東西。

解法是包一層 `sh -c`：

```bash
fly ssh console -C "sh -c 'rm -f /data/*.session /data/*.session-shm'"
```

小坑，但在你焦頭爛額地想修一個已經 crash 了 20 次的 bot 時，多一個 parse error 真的很火。

## 教訓

1. **多階段建置不是可選的。** 有 C extension 就得用。`gcc` + `libc6-dev` 是最低要求。

2. **fly.toml 的 `[processes]` 是 CMD 的替代品，不是補充。** 如果你有 entrypoint 腳本，`[processes]` 必須指向它，不能直接指向 Python。

3. **改 `.dockerignore` 之後必須 `--no-cache`。** Docker build cache 不追蹤 `.dockerignore` 的變更。

4. **Telegram bot crash 要手動停，不要讓平台自動重啟。** FloodWait 的懲罰是累加的。十次失敗登入可以讓你等一個小時。

5. **「如果不存在才複製」不適合 crash recovery 場景。** Crash 過程中產生的檔案會擋住正確檔案的恢復。要嘛用 force copy，要嘛用 checksum 驗證。

6. **Session 檔 = 帳號憑證。** Pyrogram 的 `.session` 檔是 SQLite 資料庫，裡面存著 Telegram auth key。它壞了就等於沒有登入憑證，Pyrogram 會要求重新輸入手機號碼——在 Docker container 裡，這意味著 EOFError crash。

## 目前狀態

Bot 跑在 Fly.io 東京節點（nrt），shared-cpu-1x / 256MB，用 persistent volume 存 session 檔但每次啟動都從 image 同步。Master bot 和 MTProto userbot 雙 client 正常運行，指令選單同步、訊息轉發、inline button 代理都正常。

從開始部署到真正穩定運行，中間有大約兩個小時在等 FloodWait 和 debug session 檔問題。如果你看了這篇文章，應該可以在十五分鐘內部署完。
