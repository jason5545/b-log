# ThinkPad P15 Gen 2i 的 WWAN FCC Lock：QMI 繞過去了，重開機就通

筆電內建 Quectel EM160R-GL 數據機，想在 Linux 上用 LTE。

問題是：FCC Lock。

Lenovo 有官方解鎖工具，但只支援特定機型，P15 Gen 2i 不在清單上。Windows 上用 Lenovo Vantage 可以解，但我主力系統是 Linux。

---

## 為什麼會有 FCC Lock

FCC（美國聯邦通訊委員會）要求無線電發射設備必須經過認證，認證綁定特定硬體組態。OEM 用 FCC Lock 確保數據機只在認證過的筆電裡運作——數據機開機後預設禁用，要收到官方軟體的解鎖指令才會啟動射頻。

理論上合理。

問題是：我的數據機就裝在原廠認證的筆電裡，天線是原廠的，硬體組態完全沒變。Quectel EM160R-GL 是標準 M.2 模組，裝在其他 ThinkPad 型號都能正常解鎖。唯獨 P15 Gen 2i 不在支援清單上。

---

## Lenovo 明確拒絕支援

這不是疏忽，是刻意的。

有人在 GitHub 回報過這個問題（[lenovo/lenovo-wwan-unlock#12](https://github.com/lenovo/lenovo-wwan-unlock/issues/12)），要求支援 P15s Gen 2i + EM160R-GL。Lenovo 的回應：

> "As of now, there is no plan to support Quectel EM160R-GL on a ThinkPad P15s Gen 2i for Linux."

理由是「合規要求」。但報告者在澳洲——FCC 是美國法規，根本不適用。使用者說願意自己改程式碼，Lenovo 不給 source code。

Issue 最後被標記為 "COMPLETED" 關閉。不是 "won't fix"，是裝作已經解決了。

硬體完全相同，其他型號都支援，就是不打算處理這個 SKU。純粹的商業決策。

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
