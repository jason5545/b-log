# OpenClaw 自架踩坑全紀錄：從 gateway.bind 到「關掉驗證反而壞掉」

## 為什麼要架 OpenClaw

我的主要開發環境靠 Claude Code，但 AI 服務終究是別人的——掛了就是掛了，你什麼都做不了。所以需要一個備案：平常用便宜的模型處理日常任務，真的需要強推理的時候再 fallback 回 Claude。

OpenClaw 就是拿來做這件事的。它跑在 claws-iMac-Pro 這台 VM 上，主要模型用 MiniMax M2.5（走 Anthropic-compatible API），透過 Tailscale serve 暴露 HTTPS 給其他裝置連。架構本身很單純，但設定的過程一點都不單純。

## 第一關：gateway.bind

OpenClaw 的 gateway 預設綁定在 loopback，因為我要透過 Tailscale serve 做反向代理，這個設定是對的。但一開始我不知道新版的 `gateway.bind` 不接受 IP 地址了——你不能寫 `"127.0.0.1"` 或 `"0.0.0.0"`，要用模式名稱：`loopback`、`lan`、`custom`、`tailnet`、`auto`。

寫了 IP 就直接報錯，錯誤訊息倒是很明確，只是文件裡完全沒提到這個改變。

而且 Tailscale serve 模式下，bind **必須**是 `loopback`。這是因為 Tailscale serve 本身就是 reverse proxy，如果你把 bind 開到 `0.0.0.0`，等於繞過 Tailscale 直接暴露 gateway，安全模型就破了。

## 第二關：tools.profile

設定好 gateway，連上 Web UI，發現 AI 什麼工具都沒有——不能讀檔案、不能執行命令、什麼都不能做。

原因是 `tools.profile` 預設值是 `"messaging"`，只有聊天功能。要完整的工具權限得改成 `"full"`。因為這台是獨立 VM，沒有安全顧慮，直接開 full。

但這個預設值的設計邏輯是對的：如果你把 OpenClaw 接到 Telegram 或 WhatsApp，你不會希望 AI 預設就能在你的機器上跑任意指令。只是對自架使用者來說，這個預設值會讓你以為系統壞了。

## 第三關：Tailscale serve 的存取方式

Tailscale serve 設好了，HTTPS 代理到 port 8789，但連不上。

踩了三個坑：

1. **必須用 hostname，不能用 IP。** `https://claws-imac-pro.tailb20be.ts.net:8789/` 可以，但 `https://100.64.10.131:8789/` 會 404。這是因為 Tailscale serve 的 TLS 證書是綁 hostname 的。
2. **必須用 HTTPS。** 用 HTTP 連會得到 `"requires device identity"` 錯誤，非常誤導——讓你以為是驗證問題，其實只是協定錯了。
3. **瀏覽器的 Secure DNS（DoH）要關掉。** 開著的話 MagicDNS 域名解析不了，因為 DoH 會繞過 Tailscale 的 DNS resolver。

第二點最坑。`"requires device identity"` 這個錯誤訊息會把你引到完全錯誤的方向，讓你去研究 device auth 怎麼設定，但問題根本不在那裡。

## 第四關：驗證設定的陷阱

這是整個過程最多坑的部分。

最初的想法是：我都走 Tailscale 內網了，應該不需要額外驗證。所以設了 `gateway.auth.mode = "none"`。Gateway 本身確實接受了這個設定，也能正常啟動。

但馬上就遇到問題了。

### dangerouslyDisableDeviceAuth

連線時一直跳 `"device identity required"`，Google 了一下，有人說加 `dangerouslyDisableDeviceAuth: true`。名字裡都寫了 "dangerously"，但我還是加了。

結果更慘——加了之後反而**完全連不上**。這個設定的實際行為不是「跳過驗證」，而是「把 device identity 系統整個關掉」，然後 gateway 就不知道你是誰了，連握手都過不了。

### allowInsecureAuth

接著又試了 `allowInsecureAuth: true`，想說放寬一點總該可以了吧。

跟 `dangerouslyDisableDeviceAuth` 一起用的結果是：系統完全壞掉。不只是連不上，是連 Web UI 都打不開那種壞掉。

### 不存在的設定 key

過程中還試了 `gateway.devices`、`gateway.pairing`、`gateway.autoApproveDevices`，全部都是**不存在的 key**。OpenClaw 的 config validator 很嚴格，不認識的 key 會直接報錯。`gateway.err.log` 裡面堆了一堆 `Unrecognized key` 的警告。

### 最後的解法

兜了一大圈，正確的設定其實很簡單：

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "你的token",
      "allowTailscale": true
    }
  }
}
```

`allowTailscale: true` 讓 Tailscale 連線自動信任，裝置配對會自動批准。而 `mode` 必須是 `"token"`——不能是 `"none"`。

這是我花最多時間才搞懂的一件事：**整個 OpenClaw 生態系的 client app 都預期 token 驗證存在。** GoClaw、ClawControl、Web UI，它們的 pairing protocol 裡包含 token exchange。你把 token 拿掉，握手流程就走不完，各種 app 都會報錯。

設計上 `"none"` 是合法的選項，大概是留給純 CLI 使用或前面自己掛 reverse proxy 做驗證的場景。但只要你接任何第三方 client，就必須有 token。這件事文件裡完全沒寫。

## 第五關：改了設定之後的重啟

改 `auth.mode` 或 `auth.token` 之後，hot reload（SIGUSR1）不夠——socket 不會 rebind，auth middleware 也不會重新初始化。需要完整的 gateway restart。

但 restart 之後還有一個坑：如果你只改了 `openclaw.json` 裡的 token，gateway 重啟後會繼續用 **service 裡儲存的舊 token**。必須跑 `openclaw gateway install --force` 才能把新 token 同步到 LaunchAgent。

這個行為有道理——config file 和 service 的 token 分開管理可以防止意外修改。但如果你不知道這件事，就會遇到「明明改了 token 但怎麼還是舊的」的靈異現象。

## 第六關：裝置配對

設定都搞定了，接下來要讓手機的 GoClaw app 連上來。

第一次連的時候，GoClaw 顯示 `"Device identity required"`。查了 gateway log，看到連線從手機的 Tailscale IP 進來，但 WebSocket 在配對握手完成之前就斷了。`pending.json` 是空的，代表配對請求根本沒成功送出。

後來發現是 pending 請求**五分鐘後自動過期**。你不能在手機上按連線，然後慢慢去 iMac 上找指令——等你準備好，請求早就過期了。

正確流程：

1. 先在終端機開好，準備跑 `openclaw devices list`
2. 在手機上按連線
3. 馬上回終端機執行 `openclaw devices approve <requestId>`

時間窗口只有五分鐘，要快。

## 第七關：CORS 白名單

Web UI 能開了，但 MCP 工具（像 blog connector、memory）全部報 CORS 錯誤。

`controlUi.allowedOrigins` 試了列出具體的 origin，包括 `file://`、`https://claws-imac-pro.tailb20be.ts.net:8789`，都不行。最後只有 wildcard `"*"` 才能讓所有 client 正常連線。

另外，外部 MCP 服務（像我的 b-log-connector）也要在自己的 CORS 白名單裡加上 OpenClaw 的 origin，否則從 OpenClaw 呼叫也會被擋。

## 第八關：MiniMax 的文字消失 bug

以上全部搞定之後，在 Web UI 上跟 MiniMax M2.5 聊天，看起來一切正常。

但換到 ClawControl app 或 WhatsApp channel，AI 回覆的文字就消失了——只看到 tool call 的結果，看不到 AI 的自然語言回覆。

這是 MiniMax 的已知 bug（issue #9983）：它把文字和 tool call 打包在同一個 response block 裡，OpenClaw 解析時只提取 tool block，文字就被丟掉了。Web UI 不受影響是因為它直接讀 stream，不經過同樣的解析邏輯。

目前無解，只能用 Web UI，或者在需要文字回覆的場景切到其他模型。

## 第九關：BOOTSTRAP.md 的無限迴圈

OpenClaw 的 workspace 有一個 `BOOTSTRAP.md`，是 onboarding 腳本。新裝的時候它會跑一次引導流程。

問題是：跑完之後你必須**手動刪除** `BOOTSTRAP.md`，否則每次開新 session 都會重跑 onboarding。系統不會自動標記為已完成。

這個坑不大，但很煩——你以為哪裡設定壞了，其實只是忘了刪檔案。

## 教訓

1. **名字裡有 "dangerously" 的設定，真的很 dangerous。** 但不是你以為的那種 dangerous——不是「不安全但能用」，是「整個系統直接壞掉」。

2. **`"none"` 不代表「什麼都不需要」。** 它代表的是「我自己在別的地方處理驗證」。如果你沒有在別的地方處理，那就是沒有驗證也沒有握手，client app 全部傻掉。

3. **錯誤訊息會把你引到錯誤的方向。** `"requires device identity"` 可能只是因為你用了 HTTP 而不是 HTTPS。`"pairing required"` 可能只是因為你五分鐘前的 pending 請求過期了。不要照著錯誤訊息的字面意思去修，先搞清楚實際發生了什麼。

4. **Config 和 service 是兩個東西。** 改了 config file 不代表 service 會讀到新值。`openclaw gateway install --force` 這個指令你會需要的。

5. **CORS 就設 wildcard。** 在 Tailscale 內網的情境下，精確列出 origin 沒有額外的安全價值，反而會讓各種 client 莫名其妙連不上。

## 目前狀態

OpenClaw 跑在 claws-iMac-Pro 上，MiniMax M2.5 處理日常任務，Claude Code CLI 包裝成內建工具作為 fallback。Gateway 透過 Tailscale serve 暴露 HTTPS，auth 用 token 模式，allowTailscale 自動批准配對。

已配對六台裝置：Web UI、ClawControl、Macbook Pro、GoClaw 手機、加上兩個內部 client。MCP 工具（blog connector、memory）都正常運作。

MiniMax 的文字消失 bug 還在，等上游修。其他的坑都已經填完了。

整個設定過程大概花了一整天。如果你把這篇文章從頭看到尾，你的設定過程應該可以在一小時內完成。這就是踩坑文的價值。
