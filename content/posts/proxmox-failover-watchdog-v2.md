# 一條壞掉的路由，讓我重寫了整個 Failover Watchdog

今天早上想連 Proxmox，發現 Tailscale 完全沒回應。所有路徑都試過了：直連不行、透過 mt6000 Subnet Router 也不行。是首次遇到整個 tsnode 離線的情況。

第一反應是懷疑路由器，但很快排除了。mt6000 本身沒問題，Subnet Router 也運作正常——它只是個中繼，封包進來了還是得靠 PVE 自己的 default route 回應，而 PVE 的 default route 指錯地方，Tailscale keepalive 就這樣靜悄悄斷掉。

## 根因

往前追，幾天前曾經觸發過一次 5G fallback。IK512 切了進來，舊版 watchdog 看到 `wwp10s0u1i3` 上有 IP 就當作連線正常，但實際上 bearer 根本沒建立，ModemManager 回的是 `NotOpened`。主線路恢復後，watchdog 沒有判斷「現在 5G 是假連線」的能力，就這樣永遠卡在那條路由上。

## IK512 的另一個坑：USB autosuspend

在整理 IK512 的過程中另外發現，它之所以偶爾會出現 `NotOpened`，根本原因是 USB hub autosuspend 把 modem 給掛起來了。解法很乾脆：在 GRUB 加上 `usbcore.autosuspend=-1`，全域關掉 USB 省電。

## Watchdog v2：重寫

舊版邏輯只有一件事：interface 上有 IP → 連線正常。這在大多數情況夠用，但在 MBIM 模式下完全不可靠。

v2 改成直接查 bearer 狀態：

- 用 `mmcli` 詢問 bearer 連線狀態，`NotOpened` 就視為斷線
- 偵測到斷線後自動觸發 USB rebind，附帶 cooldown 機制避免短時間內反覆重綁，rebind 紀錄寫入 `ik512-rebind.log`
- 切換後主動同步 IP，不依賴 interface 被動更新
- metric 管理確保主線路優先，5G 只在主線路真的掛掉時才上
- 主線路恢復後主動切回，不需要人工介入

## 管理通道強化：NISS 跳板

這次事件讓我意識到一件事：如果 tsnode 是直接跑在 PVE 宿主上，一旦宿主的網路出問題，管理通道就一起斷了。

解法是在 CT 106（NISS，10.0.0.172）裡另外裝一個 Tailscale，作為獨立的管理跳板。有一個細節要注意：CT 106 本身就在 mt6000 Subnet Router 的廣播範圍內，如果開了 `accept-routes` 會造成路由迴圈，所以只能用 point-to-point 模式，不開 subnet 廣播。Tailscale IP 規劃為 `100.64.10.172`，方便記憶。

往後就算 PVE 宿主的 Tailscale 再次掉線，至少還有 CT 106 這條路可以進來處理。
