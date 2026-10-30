# 躲到哪都有洞：PHP 的洞之後換 Tailscale 的，我再開了 Tailnet Lock

10 月 27 日早上 8 點 32 分，另一個 Claude Code thread 回報 Tailnet Lock 開好了。簽章的節點是我的 Mac 和兩台放 agent 的主機，從現在起，新節點沒有被簽過，就連不上 tailnet 裡的其他節點。同一個早上，那套系統的入口，已經從公開網路搬進 tailnet。

一週前我還只是旁觀。[10 月 22 日那篇](https://b-log.to/dev-philosophy/cve-week-zeabur-plaintext-keys/)我寫過「現在差不多一天一個 CVE，老實說跟得很累」，那時我頂多更新一下自己的 Nextcloud。這一週輪到我自己。

## 先擋在 Cloudflare，再整個搬進 tailnet

PHP 官方 10 月 21 日釋出修補版，修的是 PHP2Shell，也就是 CVE-2026-109618 和 CVE-2026-109619，不用登入就可能遠端執行程式碼。公告對沒辦法馬上更新的人講得很直接：列出來的緩解措施只能降低曝險，沒有完整的緩解，更新才是唯一安全的選擇。

我手上有一台伺服器，這條路不在我手裡。那是一套系統，內網那一段不歸我管，我能管的只有對外的入口。那個入口是我自己開的，掛在我自己網域底下的一個子網域，用的是我自己的 Cloudflare 帳號和 Tunnel。10 月 22 日晚上，我先用 Cloudflare 的 WAF 擋，也把狀況回報給負責的人。

PHP 官方後來又補了兩則。10 月 23 日的資訊公告提到，session upload progress 有一個機率不高的遠端執行風險，要同時符合特定的設定和程式寫法才碰得到，在下一個例行版本之前，建議先把 `session.upload_progress.enabled` 設成 0，完整公告等下一版。10 月 26 日是 Windows 版重新打包，修的是 Brotli 解壓縮的 CVE-2026-111497，只有 cURL 開了自動解壓縮才碰得到，而那預設是關的。三則放在一起，只有第一則是官方要所有人立刻更新的等級。

10 月 27 日早上，我看到 Tailworm 的報告。PHP 這一週已經連著出，連 Tailscale 現在也有一個。同一個早上，入口改成只走 tailnet。Cloudflare Tunnel 關掉，子網域改指向一台電腦的 tailnet 位址，再由那台電腦用 Windows 內建的轉送功能接到內網的伺服器。其他人照舊走內網直連，完全不受影響。我人在家的時候，像颱風天，一樣可以透過這條路處理。附帶的結果是速度：走 tailnet 大約 0.3 到 0.5 秒，原本繞 Cloudflare 要 1.0 秒。

另一個 agent 替那台電腦加了 tag，也收緊 ACL：它只能被我的裝置連到，自己只能往外連一個 port。套用之前先跑過 policy tests。到這裡，外面的人已經碰不到那個入口，前提是 tailnet 這一層可以信。

## Tailworm 把 PHP 的洞和 Tailscale 的洞接在同一條鏈上

同一週，Tailscale 這一層也被報出問題。

10 月 25 日，研究員 Erica Windisch（Cyberdione Labs）公開 Tailworm 報告，測的是 Tailscale 1.104.2，共 11 項發現，其中也包含自架的 headscale。公開的時程沒有跟廠商協調。主要的攻擊鏈有幾個前提：目標伺服器開著 Tailscale SSH，規則允許某台裝置連過去，規則也允許 SSH 轉送，而且攻擊者已經拿下那台獲准的裝置。都成立的話，就能從那台裝置拿到目標伺服器的 root。這是她在實驗室裡的測試結果，我查證的時候沒有看到其他人公開重現。

報告說明入侵怎麼開始時，第一個例子就是被打下來的 PHP 網頁或 CMS 外掛。

報告自己的說法是，網狀網路會把這樣一個平常的立足點，變成整批機器的最高權限。PHP 的洞給攻擊者第一台機器，Tailscale 的洞讓他從第一台往其他伺服器走，兩個洞接成一條線。

Tailscale 工程副總裁 Mike Shaver 10 月 25 日的回應是：問題出在 SSH 已經授權之後，不建議所有人停用 Tailscale SSH，不需要 SSH 轉送就把轉送關掉，透過 Tailscale 網路跑一般的 SSH 不受影響。截至 10 月 27 日上午，狀態是這樣：Tailscale 的安全公告頁，最新一則還是 10 月 21 日的 TS-2026-013（eMudhra 憑證外洩），沒有 Tailworm；GitHub 上最新的正式版也還是 10 月 21 日的 1.104.2，正是報告測的那一版。報告在 10 月 27 日更新，說 Tailscale 已經發表自己的評估，修補合進了公開的程式庫，但還沒有出正式版號，Tailscale 的目標是 10 月 27 日結束前出修補版（報告沒寫是哪個時區），要看測試結果。這個目標日期是報告轉述的，Tailscale 自己那一頁我沒有讀到。SSH 的 Unix socket 轉送，今年稍早才出過公告 TS-2026-004，這次是同一類功能。

## Tailnet Lock 擋的是加節點那一步

報告那條鏈的最後一步，是拿到新增裝置用的金鑰，再把攻擊者自己的機器加進 tailnet，看起來就像一台合法的伺服器。iThome 和 The Hacker News 的整理都寫到，這一步只在沒開 Tailnet Lock 的測試環境完整做完。Tailnet Lock 的規則是，新節點要被 tailnet 裡已經信任的簽章節點簽過，才能連到其他節點。10 月 22 日那篇我寫過 Zeabur 的攻擊者拿到內網的管理憑證之後，自己加了一個節點進去，動作是同一個。

但這一步被擋，不代表整條鏈斷了。報告對開了 Tailnet Lock 的情況另外寫了一筆：解除 Lock 用的 disablement secret 和簽章金鑰的相關材料，在傳輸途中被攔到，只是實驗沒有真的去解除。提權到 root 的部分，需要的是 SSH 規則和轉送，跟有沒有新增節點無關，這一段要靠官方修補，或在不需要的地方把轉送關掉。

我的 agent 主機和法國那台主機有開 Tailscale SSH，10 月 25 日的規則只在我自己的裝置之間 accept。加冒牌節點那一步，Tailnet Lock 已經擋掉；提權那一段還是要等官方修補，或不需要轉送的地方先把轉送關掉。我決定先等官方修補。

## AI 讓找洞變快，以前相對安全的東西也不安全了

AI 讓找洞變得更快。以前被當作相對安全的東西，舉例來說 Linux kernel，現在也不再安全。CVE-2026-43499，別名 GhostLock，就是一個例子：一般使用者就能提權成 root，在容器裡還能逃出到主機。研究團隊 [NebuSec 表示](https://nebusec.ai/research/ionstack-part-2/)，這個洞從 2011 年的 kernel 2.6.39 就存在，修補在 7.1，Google kernelCTF 給了他們 92,337 美元的獎金。

同樣的能力還有另一面：靠同一個洞，我們也能把手機的控制權拿回自己手上。臺版的偏移一開始怎麼算都對不上，我八月寫過那一段，[同一支手機，兩顆核心：臺版的 GhostLock 偏移為什麼永遠算不出來](https://b-log.to/tech-analysis/myron-taiwan-kernel-ghostlock-offsets/)。後來還是 root 成功了，控制權拿回來。

## 一個早上改了三處，伺服器還是修不了

這些在同一個早上做完。Claude Code 改 DNS 和 App，另一個 agent 改 ACL，另一個 Claude Code thread 開 Tailnet Lock。我做的是下決定，用的是 CTO 和 AFFIRM 這兩個詞，CTO 是放行 CLEARED FOR TAKEOFF 的簡寫，[HOLD SHORT 那篇](https://b-log.to/ai-analysis/theo-full-stop-to-atc-hold-short/)寫過。token 和 API key 都是當天才給，用完就撤銷。

這種判斷每天都要做一次。agent 起來之後的累，我 9 月[寫過一篇](https://b-log.to/ai-analysis/agent-fatigue-touch-id-ungraded-judgment/)。

那台伺服器我到現在還是修不了。入口搬進 tailnet，改變的只是誰碰得到它：以前是任何人，只要過得了 Cloudflare 的 WAF；現在要先是我的裝置，而且從 10 月 27 日早上起，新加入 tailnet 的裝置要先被簽過。tailnet 這一層自己的洞，截至 10 月 27 日上午，官方還沒有出版號。

隔天早上就有了。10 月 28 日上午（臺灣時間），GitHub 上出了正式版 1.104.4，安全公告頁也補上 TS-2026-014 到 TS-2026-017 四則。第一則就是 SSH 的 Unix socket 轉送，有用轉送的要更新到 1.104.4 以上，暫時沒辦法更新的，可以只關掉轉送，不用整個停掉 Tailscale SSH。Tailworm 報告也把 SSH 這幾項改標成已在 1.104.4 修好。

資料來源：
- [PHP 官方網站：10/21 安全公告、10/23 資訊公告、10/26 Windows 版更新](https://www.php.net/)
- [Tailworm 報告與 10/27 上游回應更新](https://www.tailworm.com)
- [iThome：Tailscale SSH轉送功能遭揭權限提升漏洞，一般帳號恐取得伺服器最高權限](https://www.ithome.com.tw/news/179953)
- [The Hacker News：Unpatched Tailscale SSH Flaws Could Let a Hacked Device Reach Root on Other Servers](https://thehackernews.com/2026/10/unpatched-tailscale-ssh-flaws-could-let.html)
- [Tailscale：Security Bulletins](https://tailscale.com/security-bulletins)
- [Tailscale：GitHub Releases](https://github.com/tailscale/tailscale/releases)
- [Tailscale 文件：Tailnet Lock](https://tailscale.com/docs/secure-networks)
- [NebuSec：IonStack part II，GhostLock（2026/7/7）](https://nebusec.ai/research/ionstack-part-2/)

