# Tailscale HA 沒壞，壞的是切過去之後的 LAN 回程

這件事一開始看起來像同一個問題又回來了。

昨天才把 MT6000 的 Tailscale subnet route 修好，今天早上又出現一樣的症狀：人在外面，Mac 走 Tailscale，要打家裡 LAN 裡的機器，結果不通。

最直覺的反應是：Tailscale 又壞了。

但這次真正麻煩的地方是，router 上的 Tailscale 其實有跑，而且 `10.0.0.0/24` 也真的切到 MT6000 了。

也就是說，這次不是 HA 沒發生。

是 HA 發生之後，切過去的那台 subnet router 沒有真的把 LAN 回程接好。

---

前面其實已經有一個很像的教訓。

Apollo / Sunshine 那次本地 IP 會影像黑畫面，Tailscale IP 卻正常。那時候很容易往「是不是 Tailscale route」「是不是防火牆」去想，因為同一台 Windows VM，一條路影像黑畫面，另一條路正常。

後來才確認問題在 Windows VM 的 VirtIO / NIC offload 路徑。Discovery、start session、stop session、音效都可以，壞的是 UDP 影像串流那條資料路徑。

那次讓我先修正一個判斷：同一台主機，不等於同一條資料路徑。

這次 Tailscale HA 又把這件事演了一次。

## 昨天修的是 route 的形狀

昨天真正不對勁的是 MT6000 的 advertise route 設定。

OpenWRT 上的 Tailscale 設定裡同時有幾組東西：

```text
advertiseRoutes='10.0.0.0/24'
advertise_routes='10.0.0.192/24' '10.0.0.172/32' '10.0.0.206/32'
```

其中 `10.0.0.192/24` 是錯的。

`/24` 的 network address 應該是 `10.0.0.0/24`，不是拿一台主機的 IP 去寫 `/24`。所以 log 裡很直接：

```text
10.0.0.192/24 has non-address bits set; expected 10.0.0.0/24
tailscale up failed.
```

這不是小 typo。它讓 MT6000 的 Tailscale 起不來，後面就全部不用談。

同時還有另一個問題：`10.0.0.172/32` 這種更精確的 route，會蓋過 `10.0.0.0/24`。Tailscale 的 HA 是看 exact prefix，同樣 advertise `10.0.0.0/24` 的幾台可以互相 failover；但 `10.0.0.172/32` 不會自動理解成 `/24` 的一部分然後幫你切。

所以昨天的修法是把 route 形狀整理乾淨：

```text
advertise_routes='10.0.0.0/24'
```

不要混 `/32`，不要留錯的 `10.0.0.192/24`。

修完後，MT6000 的 Tailscale 起來了。Web console approve 之後，Mac 也看得到 MT6000 可以 advertise `10.0.0.0/24`。

到這裡，我以為事情大概結束了。

結果沒有。

## 今天 route 真的切了，但 LAN 還是不通

今天早上症狀回來的時候，第一件事不是重開服務。

我先看 Mac 現在到底怎麼走：

```text
route get 10.0.0.172
destination: 10.0.0.0
mask: 255.255.255.0
interface: utun4
```

這代表 Mac 確實把 `10.0.0.0/24` 丟進 Tailscale。

再看 Tailscale netmap，這次更清楚：

```text
mt6000
allowed = 100.64.10.1/32, 10.0.0.0/24
primary = 10.0.0.0/24
online = true
```

也就是說，今天不是 PVE 在扛，也不是 route 沒 approve。

今天 primary subnet router 是 MT6000。

但測起來很怪：

```text
ping 10.0.0.1    # 通
ping 10.0.0.172  # 不通
ping 10.0.0.192  # 不通
```

這個結果很關鍵。

`10.0.0.1` 是 MT6000 自己，所以它會回。  
`10.0.0.172` 和 `10.0.0.192` 是 LAN 後面的機器，它們不回。

所以問題不是「Mac 到 MT6000 不通」。

問題是 MT6000 收到 Tailscale 來的封包之後，沒有成功把整段 LAN 連線完成。

## 讓每一層只回答一個問題

接下來要分層確認。

第一層：MT6000 自己能不能打到 LAN 主機？

```text
MT6000 -> 10.0.0.172
4 packets transmitted, 4 packets received
```

可以。

第二層：MT6000 到 `10.0.0.172` 的 route 怎麼走？

```text
10.0.0.172 dev br-lan src 10.0.0.1
```

走 `br-lan`，正常。

第三層：IP forwarding 有沒有開？

```text
net.ipv4.ip_forward = 1
```

有。

第四層：firewall 有沒有 tailscale 到 lan forwarding？

OpenWRT UCI 和 nft ruleset 都看得到：

```text
tailscale -> lan
lan -> tailscale
```

而且 nft counter 也證明了一件事：Mac ping `10.0.0.172` 的 ICMP request 有進到 MT6000，也有被轉出 `br-lan`。

也就是說，封包不是卡在進 router，也不是卡在 firewall forward。

封包有出去。

但 reply 回不來。

這才是今天真正的問題。

## 少的是 SNAT

這時候最合理的猜測是回程。

如果 MT6000 把 Tailscale 來的封包直接轉進 LAN，LAN 主機看到的來源可能是 Mac 的 Tailscale IP，例如 `100.89.162.36`。

理論上，如果 LAN 主機的 default gateway 是 `10.0.0.1`，它應該可以回去。但實際網路常常不是這麼乾淨。PVE、VM、旁邊的 mesh、不同 router、不同 route table，只要有一段不照你想像走，reply 就回不來。

所以我先不改永久設定，只加一條 runtime 測試規則：

```nft
oifname "br-lan" ip saddr 100.64.0.0/10 masquerade
```

結果一加就通：

```text
10.0.0.172  0% loss
10.0.0.192  0% loss
```

這一步幾乎就能定案了。

不是 Tailscale 不會 HA。  
不是 MT6000 到 LAN 不通。  
不是 Mac route 沒走 `utun4`。  

是 MT6000 當 subnet router 時，Tailscale-to-LAN 這條路缺有效的 SNAT。

最後我沒有把整個 LAN zone 都開 masquerade。那太粗。

我加的是精準的 fw4 custom nft 規則：

```text
/etc/nftables.d/20-tailscale-lan-snat.nft
```

內容是：

```nft
chain codex_ts_lan_snat {
    type nat hook postrouting priority 99; policy accept;
    oifname "br-lan" ip saddr 100.64.0.0/10 masquerade comment "Tailscale-to-LAN SNAT for subnet routing"
}
```

這條只處理一件事：  
Tailscale client 來源 `100.64.0.0/10`，要從 MT6000 轉進 `br-lan` 時，做 masquerade。

修完後再測：

```text
10.0.0.172  0% loss, 約 7.7-11.3 ms
10.0.0.192  0% loss, 約 7.7-10.4 ms
```

而且 Mac netmap 仍然顯示：

```text
MT6000 primary route: 10.0.0.0/24
```

這次是真的走 MT6000，也是真的通。

## `running` 不等於這條路可以用

這次最容易誤判的地方，是 router Tailscale 確實 running。

甚至更精確一點，`tailscaled` 本體是 running，MT6000 也 online，route 也被選成 primary。

但 OpenWRT 上 `/etc/init.d/tailscale status` 是：

```text
running (1/2)
```

查 procd 後看到：

```text
instance1: /usr/sbin/tailscaled  running
instance2: /usr/sbin/tailscale_helper --advertise-routes=10.0.0.0/24  not running, exit_code=1
```

這很有意思。

因為它剛好解釋了今天這種狀態：Tailscale daemon 本身沒壞，route 也成立，但 helper 沒有把整套 OpenWRT forwarding / NAT 狀態處理到我需要的樣子。

如果只看「Tailscale running」，會以為這層已經排除了。

但它其實只回答「daemon 有沒有活著」。  
它沒有回答「這台 router 當 subnet router 時，LAN 回程有沒有接好」。

這兩件事差很多。

## 這次改掉的判斷

昨天修的是 route 的定義。

今天修的是 route 切過去以後，封包真的要怎麼回來。

這兩件事很容易混在一起，因為症狀都像「Tailscale 又不通」。但它們不是同一個問題。

昨天的問題是：  
MT6000 advertise 的 prefix 有錯，還混了 `/32`，所以 HA 的前提不乾淨。

今天的問題是：  
HA 真的選了 MT6000，但 MT6000 作為 subnet router 的 LAN 回程沒有被 SNAT 補起來。

Tailscale 的 HA 沒有笨到完全不會切。它切了。

但它也不會幫你證明「切過去那台 router 後面的 LAN forwarding 一定完整」。它只知道這台 node online、這條 route 被允許、這個 prefix 可以走。至於 router 裡面的 firewall、NAT、LAN 回程，那是另一層。

這就是我之後會改掉的檢查方式。

我不會再停在：

```text
tailscale status: running
route: utun4
primary: 10.0.0.0/24
```

這些都只是前半段。

後面還要確認：

```text
subnet router 自己能不能打到 LAN 主機
ip_forward 有沒有開
firewall forward 有沒有放
封包有沒有真的出 br-lan
reply 是不是回得來
需要 SNAT 還是需要 LAN 端 route
```

昨天我以為問題是 route 沒整理乾淨。

今天才補上真正缺的那一段：route 切過去之後，那台 router 要能讓封包回家。
