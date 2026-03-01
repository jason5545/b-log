# fnOS 防火牆設定記：一天四次 Rescue Mode 的血淚教訓

## 起因

我在 OVH 租了一台伺服器跑 fnOS（飛牛 NAS），今年一月被駭客利用 dockermgr 漏洞入侵，發動 DDoS 攻擊後被 OVH 隔離。事後更新了 fnOS、改了密碼，之前也設了台灣 IP 白名單的 nftables 防火牆應急。

今天打算用 fnOS 內建的防火牆功能來取代臨時方案，想法很單純：入站預設拒絕，只允許 Tailscale 網段和台灣 IP。

以正常人的概念來說，「鎖台灣」應該是最合理的策略——我人在台灣，伺服器在法國，只讓台灣 IP 進來，駭客不就進不來了嗎？

結果就是這個「鎖台灣」，讓我一天跑了四次 rescue mode。

## 第一次鎖死

設好規則、重開機，直接連不上。

最初以為是 Tailscale 沒有自動啟動。畢竟防火牆第一條規則是只允許 Tailscale 網段（100.64.0.0/10），Tailscale 沒起來的話這條就廢了。

於是從 rescue mode 進去，想修 Tailscale 自動啟動。結果發現 fnOS 的 Tailscale 不是標準 systemd service，是 fnOS 自己的 app 框架管理的，binary 還放在 LVM 的 vol2 上。

先不管了，直接改 `/usr/trim/etc/fw.conf` 把防火牆 `enable` 設成 `false`，重開機，恢復連線。

## 第二次鎖死

進了網頁介面，重新設定防火牆規則。這次多加了一條：我家的公網 IP 全部放行。再加上 Tailscale 網段、台灣系統預設 port、FTP passive port，最後擋中國。

應該很完美了吧？重開機。

又鎖死了。

這次觀察到一個重要線索：Tailscale 的後台顯示 Connected 大約 10 秒後就斷線了。這就推翻了「Tailscale 沒自動啟動」的假設——它有啟動，而且連上了，只是很快就被踢掉。

## 第三次鎖死

根據 10 秒斷線的線索，我判斷是防火牆延遲載入，生效後砍斷了 Tailscale 的連線。查了 Tailscale 官方文件，WireGuard 需要 UDP 41641 入站。於是加了這條規則，同時把所有規則的協定改成「全部」而不只是 TCP。

重開機前還特地 SSH 進去確認 `fw.conf` 的實際內容，規則沒錯。

重開機後，一開始 port 8000 和 5667 能通，但 SSH port 22 超時。三者都在台灣規則的允許列表裡，為什麼 22 被擋？這至今是個謎。

更糟的是，Tailscale 又斷線了。最終所有連線都失敗。

## 還有一個未解之謎

我明明設了一條規則：我的家用 IP，全 port、全協定、允許。SSH 進去看 `fw.conf` 也確認規則正確寫入了。但 port 22 就是連不上，而 port 8000 和 5667 卻可以。

同一個 IP、同一條規則、不同 port 的結果不一樣。這完全不合邏輯，但確實發生了。至今沒有找到原因。

## 第四次：放棄自訂，恢復預設

再次 rescue mode 關防火牆，這次恢復完全預設的規則（入站預設允許）。重開機後，Tailscale 穩定連線，一切正常。

## 真正的根因

恢復預設後，我用 Claude Code SSH 進伺服器做了完整調查。

首先發現 fnOS 的防火牆是用 **BPF（XDP + TC）** 實作的，不是常見的 iptables 或 nftables。`security_service` 負責載入 BPF 程式到網卡上，XDP 處理入站、TC 處理出站，還有自己的 Connection Tracking。

然後看了 Tailscale 的實際連線：

```
tcp  [本機IPv6]:36552  →  [美國DERP]:80
tcp  [本機IPv6]:53474  →  [歐洲DERP]:443
tcp  [本機IPv6]:50210  →  [美國DERP]:443
```

**Tailscale 走的是 IPv6，連到美國和歐洲的 DERP relay，用的是 TCP 443。**

一切都說通了：

- **預設規則**：系統 port（含 443）允許**所有 IP** 入站 → DERP relay 回應能進來 → Tailscale 正常
- **自訂規則**：系統 port（含 443）只允許**台灣 IP** → DERP relay 在美國/歐洲 → TCP 443 回應被擋 → Tailscale 斷線

我加的那些補救規則全都沒打到點上：
- 家用 IP → 這是我的 IP，不是 DERP server 的 IP
- 100.64.0.0/10 → 這是 Tailscale 虛擬 IP，不是 DERP server 的實體 IP
- UDP 41641 → DERP relay 走 TCP 443，不是 UDP

## 教訓

1. **「鎖台灣」聽起來很安全，但你的 VPN 不在台灣。** Tailscale 的基礎設施分布全球，限制來源國家等於切斷自己的遠端管理通道。

2. **IPv6 是隱形殺手。** 我所有的思考都圍繞 IPv4，但 OVH 伺服器有 IPv6，Tailscale 優先走 IPv6。防火牆規則如果沒考慮 IPv6 的流量模式，就會出現意想不到的結果。

3. **BPF 防火牆不是你以為的 iptables。** fnOS 用 XDP 實作防火牆，在核心網路層最早期處理封包。雖然有 Connection Tracking，但行為可能和傳統防火牆不同。

4. **永遠留一個不經過 VPN 的後門。** 如果防火牆規則依賴 VPN 連線，而 VPN 又依賴防火牆放行，就形成死鎖。至少要有一個固定 IP 的直連規則作為保底——前提是它真的能生效。

## 目前狀態

暫時使用預設規則（入站預設允許），不再動防火牆。fnOS 已經更新修補了當初被利用的漏洞，密碼也改過，先靠軟體本身的安全性撐著。

等哪天想再調，只需要加一條 **TCP 443 入站全開**，就能在不影響 Tailscale 的前提下開啟自訂防火牆規則。

但今天就到這裡了。四次 rescue mode，夠了。
