# ThinkPad P15 Gen 2i 的 WWAN FCC Lock：QMI 繞過去了，重開機就通

筆電內建 Quectel EM160R-GL 數據機，想在 Linux 上用 LTE。

問題是：FCC Lock。

Lenovo 有官方解鎖工具，但只支援特定機型，P15 Gen 2i 不在清單上。Windows 上用 Lenovo Vantage 可以解，但我主力系統是 Linux。

---

## 突破點：QMI 可以繞過 FCC Lock

翻了一堆文件和論壇，發現 QMI 介面可以直接啟動數據機，不需要官方工具：

```bash
# 透過 QMI 啟動數據機
sudo qmicli -d /dev/wwan0qmi0 --dms-set-operating-mode=online
```

這招有用。

數據機起來了，可以註冊網路，連上台灣大哥大 LTE，拿到 IP。

```bash
# 取得連線狀態
sudo qmicli -d /dev/wwan0qmi0 --wds-get-packet-service-status
```

顯示已連線。IP 也分配到了。

---

## 卡關：mhi_swip0 介面不通

QMI 層面一切正常，但實際網路流量走不出去。

問題在 `mhi_swip0` 這個網路介面。有 IP，有路由，但 ping 不出去。tcpdump 看得到封包發出去，但沒有回應。

試過的東西：
- 手動設定 IP 和路由
- 調整 MTU
- 檢查防火牆規則
- 用 `ip link set up` 重新啟動介面

都沒用。

---

## MBIM 介面：直接超時

另一個選項是 MBIM 介面（`/dev/cdc-wdm0`）。

```bash
sudo mbimcli -d /dev/cdc-wdm0 --query-device-caps
```

直接超時，完全沒回應。

查了一下，這張卡的 MBIM 實作可能有問題，或者 FCC Lock 在 MBIM 層面還是有作用。

---

## 解法：重開機

折騰了一堆設定都沒用，最後試著重開機。

通了。

猜測是 kernel driver 需要完整重新初始化，或者某些設定要在開機時才會正確套用。總之，QMI 啟動數據機之後，重開機一次就好了。

---

## 最終狀態

✅ QMI 繞過 FCC Lock
✅ 網路註冊成功（TWM LTE）
✅ IP 分配正常
✅ 實際網路流量正常
❌ MBIM 介面仍然超時（但不需要了）
❌ 官方 Lenovo 工具不支援此機型（但不需要了）

不需要 Windows，不需要官方工具，純 Linux 搞定。
