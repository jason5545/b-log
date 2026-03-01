# IK512 到底壞了沒？一次從表象到根因的系統診斷


IK512 從上線到現在，我們碰到的麻煩不少：USB 間歇斷線、bearer 假死、每次 reconnect 都換 IP。每次出問題，第一反應都是「這東西是不是壞了」。把所有問題拉出來一起看，結論反而讓人意外：硬體從頭到尾沒壞過。

## 三個問題，三個層次

先把事件整理出來。

**USB 間歇斷線**：IK512 每隔幾小時出現 MBIM `NotOpened`，bearer 斷掉，需要手動 USB rebind 才能恢復。最初懷疑是 modem 不穩定，追下去才發現是 Linux 核心的 USB hub autosuspend——USB Root Hub 閒置後進入休眠，把整個 hub 連同下掛的 IK512 一起掛起來。解法是 GRUB 加上 `usbcore.autosuspend=-1`，全域關掉 USB 省電。這不是硬體問題，也不是 IK512 特有的問題，任何 USB 網卡在同樣設定下都會中招。

**Zombie bearer**：bearer 狀態顯示 `connected: yes`、訊號品質正常、IP 也有分配，但 ping 8.8.8.8 100% loss，tx/rx 近乎為零。資料通道死了，但 firmware 對 ModemManager 保持沉默。從 2/28 晚上 20:55 reconnect 後進入殭屍狀態，到 3/1 早上 08:26 才手動發現，持續超過 11 小時，watchdog v2 完全沒有感知到。

**每次換 IP**：每次 reconnect 都拿到全新的 CGNAT 地址（10.x.x.x），週期大約 1.5 到 2 小時。

三個問題看起來都指向 IK512，但根因完全不同：

- USB 斷線 → **Linux 核心設定問題**，已解決，與硬體無關
- Zombie bearer → **firmware 缺陷**，bearer 死亡時應該上報卻沒有
- 每次換 IP → **電信商 CGNAT 行為**，session 到期就中斷重建，正常設計

## Zombie Bearer 的本質

Zombie bearer 是這三個裡面最核心的問題，因為它無法從 host 端根本解決。

MBIM 協定對 bearer 的設計期望是：當資料通道斷開時，modem firmware 應該更新 bearer state，讓 ModemManager 能感知並觸發重連。IK512 沒有實作這一塊——bearer 死了，firmware 維持 `connected: yes`，host 端完全不知道發生了什麼事。

這不是 IK512 特有的問題，而是 consumer-grade USB dongle 的通病。廠商的開發資源有限，firmware 對 host 的 event notification 實作往往不完整，因為一般消費者感知不到這個層次的差異。工業級模組（如 Quectel RM520N-GL）才會嚴格實作 bearer failure notification，因為工業應用不能靠人眼監控。

Watchdog v2.5 的補救方式是主動驗證：不相信 bearer status 的回報，每次都自己去 ping 確認資料通道真的通。這是從 host 端繞過 firmware 的缺口，有效，但本質上是在替 firmware 做它原本應該做的事。

## 這個裝置本來就不是設計來這樣用的

IK512 的設計使用情境是：插上 Windows 電腦，裝驅動程式，打開瀏覽器，上網。使用者不需要知道 bearer 是什麼，不需要知道 MBIM，不需要知道 session 斷了再連。那個層次的問題，Windows 驅動程式和電信商 app 都幫你處理掉了，使用者也不在乎 IP 有沒有換。

我拿它來做的事情完全不同：裸接 Linux、ModemManager 直接管、當 Proxmox 的 failover 備援、要求 bearer failure 要能被偵測到、要求路由要能自動切換。這些需求在它的設計目標裡根本不存在。

所以才需要用 watchdog 去補——本質上是在用一個消費級工具做工業級的工作，缺的部分只能自己加。這也解釋了為什麼工業模組貴那麼多：那些需求它原本就設計進去了，firmware 完整實作是預設，不是選配。

## 為什麼手機熱點不會有這個問題

很多人用手機熱點，從來不會碰到這種 zombie 狀態，但裝了 USB dongle 的 Linux 卻要自己想辦法。差別在架構。

手機的基頻晶片和 Android/iOS 的電話堆疊（RIL，Radio Interface Layer）是緊密整合的。Bearer 一斷，電話堆疊馬上感知，自動重撥，整個恢復過程在手機內部完成。對外呈現的 WiFi hotspot 從來沒有真的斷掉，連接的設備感知不到任何異常。

IK512 是裸 modem 透過 MBIM 暴露給 Linux，modem 和 ModemManager 之間的整合完整性完全取決於 firmware 實作。firmware 沒做的部分，就必須由 host 端自己補。

## 類比：HiNet PPPoE 的強制斷線

電信商 CGNAT session 週期性中斷、重建、換 IP，這件事本身和台灣的 HiNet PPPoE 三天強制斷線換 IP 是同一個概念——都是電信商在 session 層面主動管理連線生命週期，host 端只能被動應對。

差別在於感知難度不同。PPPoE 斷線時 interface 狀態是真的掉的，OS 能感知到，重撥機制也跑得起來。IK512 的 CGNAT session 斷掉時，bearer 死了但 interface 仍然活著，感知難度高得多，才需要用 ping 主動探測。

## 那到底要不要換？

把問題追清楚之後，退貨的動機反而弱了。

台灣市場買得到的消費級 5G USB dongle，firmware 品質普遍在同一個等級，換同類型的產品不會解決 zombie bearer 問題，只是換一個一樣的坑。降到 4G 也一樣——zombie bearer 是 consumer-grade firmware 通病，跟 4G/5G 無關。

要根本解決，需要的是工業級模組，代表的是三四倍的成本加上自組 USB adapter board 的麻煩，對一個 homelab 備援線路而言不划算。

GPS 不實廣告的退貨機會還在。但為了 firmware 品質去退、換同類型消費品，不值得。

IK512 硬體沒壞，watchdog v2.5 已經把盲區補起來，系統穩定。最後的結論是：不換。

---

相關文章：[一條壞掉的路由，讓我重寫了整個 Failover Watchdog](/blog/proxmox-failover-watchdog-v2)　[TCL LINKKEY IK512 的 GPS 不實廣告：從技術驗證到代理商回應](/blog/tcl-ik512-gps-false-advertising)

