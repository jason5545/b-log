# 在 PVE 上裝第二台 Tailscale 子網路由，然後花三小時修一個不存在的問題

我的 PVE 主機（10.0.0.192）跟 mt6000 路由器（10.0.0.1）都在同一個區網 10.0.0.0/24 上。兩台都跑 Tailscale，都廣播這個子網段當 subnet router，這樣我在外面用 MacBook 連 Tailscale 就能存取家裡的所有設備。

聽起來很合理吧。

問題出在一個參數：`--accept-routes`。

## 兩台子網路由互相 accept-routes，然後一切都壞了

`--accept-routes` 的意思是「接受其他節點廣播的路由」。當你是一般客戶端的時候，這很合理——你需要知道怎麼透過 subnet router 到達遠端網段。

但當你自己就是 subnet router，而且你就在那個網段上的時候？

PVE 廣播 10.0.0.0/24，mt6000 也廣播 10.0.0.0/24。兩邊都開了 `--accept-routes`，所以 PVE 接受了 mt6000 廣播的路由，mt6000 也接受了 PVE 廣播的路由。Tailscale 的路由表（table 52）裡多了一條：

```
table 52: 10.0.0.0/24 dev tailscale0
```

ip rule 的優先順序是 5270（查 table 52）先於 32766（查 main table）。結果就是所有 10.0.0.0/24 的流量不走 vmbr0 走區網，而是被劫持到 tailscale0 走 Tailscale 隧道。

區網直接斷了。

一台在 10.0.0.0/24 上的機器，要去 10.0.0.0/24 的鄰居，結果封包被塞進 Tailscale 隧道繞一圈。這已經不是效能問題了，是路由迴圈。

## 第一個修正：正確的

```bash
tailscale set --accept-routes=false
```

兩台都關掉。PVE 的區網立刻恢復。

邏輯很單純：你自己就在這個網段上，你不需要「接受」別人告訴你怎麼到這個網段。你本來就在這裡。

## 然後我犯了真正的錯

關掉 accept-routes 之後，我從 MacBook 測試連 10.0.0.192。

失敗。

我在 Tailscale Admin Console 上重新操作了好幾次 unapprove / re-approve，想確認路由設定有生效。

還是失敗。

所以我判斷：accept-routes 的修正不夠，一定還有別的問題。

這個判斷是錯的。

真正發生的事情是：Tailscale 的控制平面需要時間把更新後的路由設定（AllowedIPs、primary/failover 指派）傳播到所有客戶端。我在 Admin Console 上反覆操作，觸發了重新計算，但傳播不是即時的。

我沒等。

## 在傳播空窗期疊加了錯誤的修正

我當時的心智模型是這樣的：MacBook 的封包先到 mt6000（primary subnet router），mt6000 轉發到區網，PVE 收到封包後回覆。所以我覺得問題出在 PVE 的回覆路徑。

於是我做了三件事：

1. `ip rule add from 10.0.0.192 table main priority 5200`——強制 PVE 發出的封包走 main table（走 vmbr0）
2. `iptables -I INPUT 1 -s 100.64.0.0/10 -i vmbr0 -d 10.0.0.192 -j ACCEPT`——允許 CGNAT 來源的封包從 vmbr0 進入
3. 把 ip rule 寫進 `/etc/network/interfaces` 的 `post-up`——持久化

每一步都有「道理」。但整個前提就是錯的。

## tcpdump 告訴我真正的封包路徑

我應該在第一步就跑 tcpdump。不是第三步，不是修了一堆東西之後。

實際的封包路徑：

```
MacBook → Tailscale → PVE 的 tailscale0（直連）
```

PVE 自己就是 subnet router，而且 PVE 就是目的地。Tailscale 直接把封包送到 PVE，根本不經過 mt6000。primary/failover 的指派只對「不是 subnet router 的目的地」才有意義。

那我加的 `ip rule from 10.0.0.192 table main` 做了什麼？

它把 PVE 透過 tailscale0 回覆給 MacBook 的封包（src=10.0.0.192, dst=100.89.162.36）劫持到 main table，從 vmbr0 送去預設閘道 10.0.0.1。10.0.0.1 不知道怎麼路由 Tailscale 的 CGNAT 位址。

封包黑洞。我親手把回覆路徑炸掉了。

那 iptables 規則呢？0 個封包命中。因為根本沒有 CGNAT 來源的封包從 vmbr0 進來過。完全是多餘的。

## 為什麼容器一直都通

有趣的是，整個過程中 10.0.0.172（PVE 上的容器）從來沒斷過。

因為路徑完全不同：

1. 封包到 PVE 的 tailscale0（目的是 10.0.0.172）
2. PVE 透過 vmbr0 轉發給容器（走 FORWARD chain，不是 INPUT）
3. Tailscale 的 `ts-postrouting` 把來源 NAT 成 10.0.0.192
4. 容器回覆給 10.0.0.192，conntrack 反向 de-NAT 送回 tailscale0
5. conntrack 處理了反向路徑，`ip rule` 根本沒機會介入

所以容器的連線完全不受影響，這讓我更加確信問題出在 PVE 本機的路由，而不是 Tailscale 傳播延遲。

錯誤的線索指向錯誤的方向。

## 還原

全部撤掉。ip rule 刪掉，iptables 規則刪掉，interfaces 的 post-up 刪掉。

確認兩台都是 `--accept-routes=false`。

MacBook ping 10.0.0.192。通了。

控制平面的傳播早就完成了。我的「修正」才是唯一的問題。

## 學到的事

**Subnet router 不要 accept-routes 自己的網段。** 你在 10.0.0.0/24 上，就不要接受別人告訴你 10.0.0.0/24 怎麼走。

**Tailscale 控制平面的變更有傳播延遲。** 在 Admin Console 改了東西之後，等。不是改完測一次失敗就代表沒用。

**先跑 tcpdump。** 不是最後才跑。不是疊了三層修正之後才想到要看封包。驗證實際路徑應該是第一步。

**不要在傳播空窗期疊加修正。** 每多加一個變數，除錯的複雜度就多一個維度。改一個東西，等，驗證，再決定要不要改下一個。

**毯式 ip rule 在有 Tailscale 的環境下很危險。** `from <ip> table main` 會蓋過 Tailscale 依賴的 table 52 路由。Tailscale 的回覆流量需要走 table 52 才能正確送回隧道。

最後的設定很無聊：

```
PVE (10.0.0.192):
  tailscale set --advertise-routes=10.0.0.0/24
  accept-routes = false

mt6000 (10.0.0.1):
  tailscale set --advertise-routes=10.0.0.0/24
  accept-routes = false
```

兩台都在 Admin Console 核准。沒有額外的 ip rule，沒有 iptables 規則。

三小時的除錯，最後的答案是關掉一個參數然後等五分鐘。
