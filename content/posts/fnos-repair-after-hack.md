# 被駭客入侵後的 fnOS NAS 修復紀錄

最近我的 fnOS NAS 伺服器遭遇了一次來自中國的駭客入侵，對方利用了 Docker Manager 的漏洞。這篇文章記錄了我從發現問題到完全修復的整個過程。

## 事件背景

我在法國 OVH 機房託管了一台 fnOS 私有雲伺服器。某天突然接到通知，說我的伺服器被駭客入侵了，對方來自中國，利用的是 Docker Manager 的漏洞。為了防止再次發生，我決定設定只允許台灣 IP 連線的防火牆規則。

## 第一步：設定台灣 IP 限制防火牆

我使用 nftables 建立了一個名為 `taiwan_only` 的規則表，包含完整的台灣 IP 段白名單。規則邏輯很簡單：

- **INPUT**: 只允許來自台灣 IP 的連入
- **OUTPUT**: 只允許連出到台灣 IP
- 預設政策為 DROP

```bash
nft list chain inet taiwan_only input
```

## 發現 IPv6 漏洞

設定完成後，我檢查規則時發現一個嚴重問題：

```
meta nfproto ipv6 accept
```

所有 IPv6 流量都被允許！這意味著駭客可以透過 IPv6 繞過我的台灣限制。我立即刪除了這條規則，暫時禁用 IPv6。

## 系統更新的噩夢

防火牆設好後，我嘗試更新 fnOS 到最新版本 V1.1.11，但遇到了一連串問題：

### 問題一：更新伺服器被擋

fnOS 的更新伺服器分散在多個阿里雲節點：
- `apiv2-liveupdate.fnnas.com` → 39.108.138.95 / 120.77.175.196
- `iso.liveupdate.fnnas.com` → 180.163.146.6（崑崙 CDN）
- 還有 47.106.x.x、47.246.x.x 等多個 IP 段

我一開始逐個加入例外，後來乾脆設定了一條規則：**root 用戶的 HTTP/HTTPS 出站自動放行**。這樣 liveupdate 程式就能自由連接更新伺服器了。

```bash
nft insert rule inet taiwan_only output meta skuid root tcp dport 443 accept
nft insert rule inet taiwan_only output meta skuid root tcp dport 80 accept
```

### 問題二：sysrestore_service 缺失

更新程式報錯：「執行更新腳本出錯」。查看日誌發現：

```
sysrestore.service: Failed to locate executable /usr/trim/bin/sysrestore_service: No such file or directory
```

這個關鍵的系統檔案不見了！我懷疑是駭客入侵時被刪除的。

**解決方法**：從官方 ISO 中提取檔案恢復。

```bash
# 下載 ISO
aria2c -x 16 -s 16 "https://iso.liveupdate.fnnas.com/..."

# 解壓並提取
7z x fnos-1.1.11-1438.iso
tar -xzf trimfs.tgz usr/trim/bin/sysrestore_service

# 上傳並安裝
scp sysrestore_service jason@server:/tmp/
sudo mv /tmp/sysrestore_service /usr/trim/bin/
sudo chmod 755 /usr/trim/bin/sysrestore_service
```

### 問題三：依賴函式庫缺失

恢復 sysrestore_service 後，服務還是啟動失敗（exit 127）。用 `ldd` 檢查發現：

```
libtrim_machine.so.0.5 => not found
```

同樣的方法，從 ISO 提取並安裝這個函式庫。

### 問題四：cat 命令被刪除

這是最離譜的發現。更新腳本持續失敗，錯誤碼 127（命令未找到）。經過檢查：

```bash
ls /bin/cat /usr/bin/cat
# ls: cannot access '/bin/cat': No such file or directory
```

駭客居然把 `cat` 命令刪掉了！這導致更新腳本無法執行。同樣從 ISO 恢復。

### 問題五：chattr 命令被刪除

在檢查系統服務時發現 `sysinfo_service` 日誌中有錯誤：

```
sh: 1: chattr: not found
```

`chattr` 命令也被駭客刪除了。這個命令用於設定檔案屬性，是系統正常運作的必要工具。同樣從 ISO 恢復。

### 問題六：Docker 未執行

更新過程還需要 Docker，但 Docker 服務是停止的：

```bash
sudo systemctl start docker
```

## 最終成功

經過以上所有修復：
1. ✅ 恢復 `sysrestore_service`
2. ✅ 恢復 `libtrim_machine.so.0.5`
3. ✅ 恢復 `cat` 命令
4. ✅ 恢復 `chattr` 命令
5. ✅ 啟動 Docker 服務
6. ✅ 開放更新伺服器連線

系統終於成功更新到 V1.1.11！

## 應用商店無法下載

系統更新完成後，我發現應用商店無法正常下載應用程式。錯誤日誌顯示：

```
open /tmp/appcenter/trim.media-0.8.59-pkg: operation not permitted
```

經過分析 `trim_app_center` 二進制檔案，我發現它使用以下架構：
- 透過 gRPC 與本地服務通訊（`/var/run/trim_license_internal.socket`）
- 連接雲端 API：`https://aps.fnnas.com/api/v1`

檢查 `/tmp/appcenter` 目錄時發現問題：

```bash
lsattr -d /tmp/appcenter
# ----i---------e------- /tmp/appcenter
```

駭客把這個目錄設定為 **immutable（不可變）**！這導致應用商店無法在此目錄建立下載檔案。

**解決方法**：

```bash
sudo chattr -i /tmp/appcenter
```

移除不可變屬性後，重啟 App Center 服務：

```bash
sudo systemctl restart trim_app_center
```

應用商店終於恢復正常運作！

## 經驗教訓

1. **駭客很狡猾**：他們不只是入侵，還會刪除關鍵系統檔案，讓你難以修復或更新
2. **注意 immutable 屬性**：駭客會用 `chattr +i` 鎖定目錄，阻止系統正常運作。用 `lsattr` 檢查可疑目錄
3. **保留 ISO 很重要**：官方安裝 ISO 是恢復損壞檔案的最佳來源
4. **防火牆設計要全面**：別忘了 IPv6，它可能成為後門
5. **系統更新需要白名單**：嚴格的防火牆會擋住正常更新，需要特別處理
6. **root 用戶放行是個好策略**：讓系統程序能正常連網，又不影響安全性

## 最終防火牆規則摘要

```
# 自動放行系統更新
meta skuid root tcp dport 443 accept
meta skuid root tcp dport 80 accept

# 基本規則
oif "lo" accept
ct state established,related accept
ip saddr/daddr @taiwan_ipv4 accept

# DNS
udp dport 53 accept
tcp dport 53 accept

# 預設
log prefix "[NFT-DROP] " drop
```

## fnOS 安全性評估

經過這次修復，我對 fnOS 的安全性有了更深的認識。以下是我的客觀評估：

### 發現的安全問題

#### 嚴重問題

| 問題 | 風險等級 | 說明 |
|------|----------|------|
| Docker Manager 漏洞 | **高** | 這是駭客的入侵點，允許遠端執行程式碼 |
| IPv6 預設放行 | **高** | `meta nfproto ipv6 accept` 繞過所有 IPv4 限制 |
| 服務以 root 執行 | **中高** | `trim_app_center`、`trim_license` 等都以 root 執行，一旦被攻破就是完全控制 |

#### 架構問題

| 問題 | 說明 |
|------|------|
| 無檔案完整性檢查 | 駭客刪除 `cat`、`chattr` 等關鍵命令，系統毫無察覺 |
| 無異常行為偵測 | 目錄被設定 immutable 屬性，無警報機制 |
| 雲端依賴 | App Center 完全依賴 `aps.fnnas.com`，無離線模式 |
| 更新機制脆弱 | 缺少檔案後整個更新流程就會失敗 |

### 駭客能做到的事

從這次事件來看，駭客能夠：
- 刪除任意系統檔案
- 設定 immutable 屬性阻止修復
- 完全控制系統

### 與其他 NAS 系統比較

| 特性 | fnOS | Synology DSM | TrueNAS |
|------|------|--------------|---------||
| 容器隔離 | 弱 | 中 | 強 |
| 檔案完整性監控 | 無 | 有 | 有 |
| 自動安全更新 | 無 | 有 | 有 |
| 入侵偵測 | 無 | 基本 | 可選 |

### fnOS vs 黑群暉

不過話說回來，fnOS 至少比「黑群暉」（非官方安裝的 Synology DSM）安全多了：

| 考量 | fnOS | 黑群暉 |
|------|------|--------|
| 合法性 | ✅ 完全合法 | ❌ 侵權風險 |
| 官方支援 | ✅ 有 | ❌ 無 |
| 系統更新 | ✅ 官方推送 | ⚠️ 可能導致系統損壞 |
| 後門風險 | ⚠️ 漏洞問題 | ❌ 修改過的映像可能有植入 |
| 硬體相容 | ✅ 原生支援 | ⚠️ 需要額外驅動/修補 |
| 長期維護 | ✅ 官方負責 | ❌ 社群自求多福 |

黑群暉表面上功能強大，但你永遠不知道那個修改過的系統映像裡面藏了什麼。用盜版 NAS 系統來存重要資料，本身就是一個巨大的安全風險。

fnOS 雖然安全機制還不成熟，但至少是正版授權、有官方團隊維護、漏洞會被修補，也不用擔心法律問題。

### 結論

fnOS 目前的安全性**偏低**，適合：
- 內網使用
- 有防火牆保護的環境
- 非關鍵資料儲存

**不建議**直接暴露在公網，除非：
- 嚴格的防火牆規則（如台灣 IP 限制）
- 關閉不必要的服務（特別是 Docker Manager）
- 定期備份和監控

這是一個相對年輕的 NAS 系統，安全機制還需要時間成熟。

---

希望這篇文章能幫助到其他遇到類似問題的人。NAS 安全真的不能大意！
