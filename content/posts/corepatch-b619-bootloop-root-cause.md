# CorePatch 的 B619 是怎麼炸掉我兩次開機的

我在同一支手機上被這條鏈炸了兩次：OTA 之後開機循環，format data 暫時恢復，下一次又來。第二次我才把 `packages.xml`、APK 簽章和 CorePatch 的 hook 放在一起比對。

你如果沒在跑 Xiaomi.eu ROM、沒裝 CorePatch，這篇仍然值得看。它記錄的是一個 fail-open 設計，怎麼在特定條件下把暫時的驗證失敗寫成下一次冷開機的致命狀態。

## TL; DR

CorePatch 的 `ApkSignatureVerifierHook` 有一段 fail-open 邏輯：當 APK 簽章驗證失敗、又拿不到「已安裝簽章」或「略過摘要驗證」救援時，它會**硬塞一顆 Google 平台 release key 當占位符**（SHA-256 開頭是 `b6198a8d…`，我通稱它 B619）。

平常這沒事，因為 CorePatch 主要在 `/data/app` 處理異簽章 APK，下次開機 LSPosed 已接管，bypass 繼續放行。

但 Xiaomi.eu 的打包流程會把 `ContactsProvider` 處理成「v1 檔案在、v2/v3 被 strip、`.SF` 又殘留 `X-Android-APK-Signed: 2,3` 宣告」的自相矛盾狀態。這顆 APK 又剛好屬於 `android.uid.shared` 這個 shared UID 群組。

兩個條件相遇：

1. CorePatch 掃描時驗證失敗，塞 B619
2. `packages.xml` 把 B619 寫進去
3. 冷開機時 LSPosed 還沒接管，PackageManager 看到 B619 跟其他成員的 E443 簽章不一致
4. system_server reconcile 階段 fatal
5. 開機循環

**根因一行話**：CorePatch 用「真實有效的 Google platform 憑證」當 fail-open 占位符，而你的 EU ROM 恰好有一個 v1/v2/v3 自相矛盾的 ContactsProvider，兩者相遇就把它寫進 `packages.xml`。

## 我為什麼在意這條鏈

第一次 format data 完，我以為是 ROM 鍋，把備份還回去就算了。第二次還發，我才願意打開 logcat 一行一行看。一個在 Android 平台廣泛被信任的公開憑證，被某個 hook 模組當成 fallback 塞進去，而且塞完之後的下游沒有一道門會問「這顆 APK 本來就是用 AOSP key 簽的嗎」。這是 hook 階段把錯誤結果寫成後續流程會相信的狀態，重刷只會暫時蓋掉它。十二小時的工，不能只換來一句「小心 OTA」。

## 事件還原

第二次 OTA 升級（EU → EU，版本號 B309）之後，開機卡在 logo。`fastboot` 進 recovery，logcat 沒看到任何有意義的 error，只有一行 `PackageManager: Reconcile failed`，然後就重開。

退路跟第一次一樣：format `/data`、重刷、慢慢把備份還回來。十二小時的工。

第一次的時候我以為是「這版 ROM 比較不穩」。第二次還發，我就知道這不是偶發，是某個流程被穩定觸發的。

要追，就得先知道「第二次跟第一次的共同條件」是什麼。剩下的就是 noise。

## 注入點：全 repo 只有一處

`app/src/main/java/org/lsposed/corepatch/hook/ApkSignatureVerifierHook.kt:186`

```kotlin
signaturesBefore ?: arrayOf(Signature(Constant.SIGNATURE)),
```

這個 `?:` 的右邊是 fallback，意思是「如果 `signaturesBefore` 為 null，就塞這個」。一行就夠了，問題就在這一行。

## B619 是哪一顆憑證

`Constant.SIGNATURE` 不是隨機假資料，是 AOSP/Google 公開的「Android」platform release key。完整 metadata：

- Subject = Issuer：`C=US, ST=California, L=Mountain View, O=Google Inc., OU=Android, CN=Android`
- Self-signed、RSA-2048
- Serial：`26d148b7…ec85`
- 有效期：2019-01-02 ～ 2049-01-02
- SHA-256：`b6198a8d…`（B619）

它是一顆在 Android 生態裡被廣泛使用的公開 platform 憑證，不是測試用的隨機 key。放進 fallback 之後，後面的 reconcile 會把它當成一個看似合理、其實不屬於這顆 APK 的簽章。

比對來源：我用 `apksigner` 把 APK 拆出來，計算內嵌憑證的 SHA-256，跟 `packages.xml` 寫進去的 hex 完全一致。同時也從 Android Open Source Project 的 platform keystore clone 出原始 DER，跑 SHA-256，三邊對得起來。

這一步閉合了「B619 就是 CorePatch 寫進去的」這條鏈。如果對不起來，可能是 LSPosed fork 或別的東西在搞事，要繼續往下追。對得起來，就可以鎖定是 CorePatch。

## 觸發條件鏈

`ApkSignatureVerifierHook.kt:88-226` 這段要跑完整條鏈才會掉進 fallback。少一層就跑到別條路徑。

| 步驟 | 條件 |
|---|---|
| 前提 | 「停用 APK 簽名驗證」（`bypass_verification`）開 |
| 失敗 | `verifyV1Signature` 拋例外或 ParseResult 回 `-103` |
| 救援一 | 「使用已安裝簽章」關 → 跳過。而且開機掃描期 `ActivityThread.currentApplication()` 本來就是 null（原始碼 log 自己寫「Are you using MiUI?」），這條路在掃描期永遠失效 |
| 救援二 | 「略過摘要驗證」關 → 跳過 |
| 結果 | `signaturesBefore == null` → **硬塞 B619**，schemeVersion 強制 1 |

我的設定一直是「bypass 開、另外兩項關」。對一般用途剛好足夠，沒預料到會走到 fallback。

## 為什麼偏偏是 ContactsProvider

我本來以為 EU 整批系統 APK 都被 strip 成 v1 only，所以每顆 shared UID 成員都該中招。實測五個 `android.uid.shared` 成員才發現不是：

| APK | 簽章狀態 | apksigner 結果 |
|---|---|---|
| **ContactsProvider** | v1 在、v2/v3 block 被 strip、`.SF` 殘留 `X-Android-APK-Signed: 2,3` 宣告 | **DOES NOT VERIFY「Signature stripped?」** |
| CallLogBackup | v3 完整 | Verified using v3: true |
| E2eeContactKeysProvider | v3 完整 | 同上 |
| BlockedNumberProvider | v3 完整 | 同上 |
| UserDictionaryProvider | v3 完整 | 同上 |

整個 `android.uid.shared` 群組裡只有 ContactsProvider 處於自相矛盾狀態。EU 的 strip 是有選擇性的，而這顆剛好被選中。

任何一次驗證路徑變化（OTA、parser 差異、時序、bypass 模組版本差異）都會讓它獨家掉進 fallback → B619 → 跟其他成員的 E443 混簽章 → 冷開機 fatal。

我看到這行實測結果的時候才想清楚一件事：CorePatch 選 `Constant.SIGNATURE` 當 fallback，判斷成本幾乎是零。寫下 `signaturesBefore ?: arrayOf(Signature(Constant.SIGNATURE))` 的人，不需要先理解 shared UID、`system_server` reconcile，或 EU ROM 的 strip 順序；只要讓這次驗證繼續就好。

但下游要付的成本是 12 小時的工、一次「重刷就沒事」的誤判，還有一個連 logcat 都不會直接說出原因的 bootloop。找到 fallback 的成本很低；確認它和五顆 APK 的簽章狀態交集在哪裡，才是昂貴的部分。我寫下這段，是提醒自己下一次選 fallback 之前，要先算清楚成本最後落在誰身上。

## 上游現況：這條鏈沒有修復路徑

我去翻了 fork 點之前的所有 commit：

- `4500fa2`（2024-03-11 Initial commit）就有這顆 fallback
- `fb197fa`（2026-07-18 Rewrite）語義原封不動保留
- HEAD `af7b1de`（2026-07-19）仍在

這是**刻意的 fail-open 設計**：驗證失敗時不拒絕安裝，改塞占位憑證讓流程繼續。哲學是「不要因為簽章問題擋住使用者」。

我也查了上游 issue tracker：9 張 open、完全沒有 packages.xml 污染或 B619 相關回報，最接近的 #132 是 crDroid A13 bootloop，但無下文，沒人給出根因。

這讓這條問題很難靠一般回報被修掉：

1. **你大概率不會炸。** CorePatch 主力用途是覆蓋安裝 `/data/app` 的異簽章 APK，那種情況 fallback 即使寫入，下次開機 LSPosed 已接管、bypass 繼續放行，永遠無症狀。只有「系統分割區＋shared UID」組合才會在裸開機時 fatal，而正常 ROM 的系統 APK 簽章一致，`verifyV1` 根本不失敗。
2. **炸了也很難查到原因。** CorePatch 日誌只進 LSPosed 私有 log，logcat 沒有；crash 點在 system_server reconcile，一般人不抓 boot trace；`packages.xml` 是 ABX 二進位，要 root + parser 才能看見 B619；看到 B619 hex 還不算完，要比對 CorePatch dex 內嵌憑證才知道來源。
3. **就算查到，也很可能先停在個人 fork。** 我自己的 patch 推在 fork `6e9afdb`，目前不打算發 PR。這條鏈需要特定 ROM、特定 APK 狀態和可比對的 `packages.xml`；沒有可重現證據，上游很難判斷要改哪一層。#132 那張 open issue 就是這個結構的樣板：有現象、無證據、上游無從修起。

我在這裡寫的，是為了下一個會走完整條鏈的人。**需要「root + ABX 解析 + 反編譯模組 + 對 SHA-256」四件事都做的人本來就少**。寫下來，至少把搜尋路徑留好。

## 我開的 fork 跟 patch

我在 fork 上 `6e9afdb` 推了一個兩層修法：

```kotlin
// A. fail-closed：拿不到真實憑證就讓原錯誤傳播，不再偽造
if (signaturesBefore == null) {
    return originalResult  // 拋回原例外或 -103
}

// B. /data/app 守衛：只對用戶空間 APK 套用 bypass，系統分割區不碰
if (apkPath.startsWith("/data/app/") && bypassVerification) {
    // 原本的 bypass 邏輯
} else {
    return originalResult
}
```

加上把 `Constant.SIGNATURE` 從 repo 裡刪掉，編譯期就拿不到這顆 key。

重開機實證：裝新版 fork 之後再觸發相同條件（模擬 v1-only + 矛盾 `.SF`），`packages.xml` 不再被污染，開機正常。

這個 patch 目前不會進 upstream，原因如上節：一般場景用不到，真的會炸的人又很難把證據帶回來。對在 EU ROM 上跑 CorePatch 的人，至少要先停用 bypass，直到換掉這個 fallback。

## 怎麼自己驗證你有沒有中

如果你也遇到 OTA 後 bootloop、format data 復活、第二次再發：

1. **開機進 recovery 或 TWRP**，掛載 `/data`（唯讀就夠）
2. **拉 `packages.xml`**：`adb pull /data/system/packages.xml .`
3. **找有 `android.uid.shared` 的 package**，看它的 `<sigs>` 區段
4. **如果有 SHA-256 開頭是 `b6198a8d` 的憑證**，就是 B619
5. **比對 CorePatch APK 內嵌憑證**：`apksigner verify --print-certs corepatch.apk` 拿 SHA-256，對得起來就是這條鏈

對得起來，就先別 format data：關掉 CorePatch 的 bypass，換上 patch，再重新觸發相同條件確認。

對不起來，就不能把這次 bootloop 歸到這條鏈，得繼續查。

## 我學到的事

### 1. 失敗開放設計是雙面刃

CorePatch 的 fail-open 哲學在「使用者裝了一個來路不明的 APK 結果因為簽章不過被擋下來」這個場景是對的：寧可放行也不要擋住。但當下游消費端（PackageManager）的容錯假設是「簽章會一致」時，這個放行就會在 shared UID 群組上放大成 fatal。

設計 fail-open 時要問的不是「失敗時怎麼繼續」，是「下游有誰假設我不會失敗」。

### 2. 公開信任的 key 不該當 fallback

`Constant.SIGNATURE` 是真實的 Google platform key，這在「讓 Android 把它當成 platform-signed 來處理」這件事上其實有效——直到它跟另一顆不同的 platform key 撞在一起。Android 的簽章信任模型是相對的，不存在「全 Android 通用」這回事。

fail-open 用的占位符應該是「**明確標記為不可信**」的東西，例如全部填零的 SHA-256 或標記為 `DEBUG` 的 self-signed，讓後續 reconcile 有機會抓到異常並報錯，而不是拿一顆真實的 key 去混。

### 3. 開機早期不可信原則

system_server 在 LSPosed 還沒接管的階段做 reconcile，是 Android 安全模型的一環：開機早期任何 hook 都還沒生效，此時的 PackageManager 看到的就是「真實世界」的狀態。

任何在這個階段寫入的狀態（不管是 `packages.xml` 還是別的）都會被當成 ground truth，後續的 hook 只能選擇覆寫或放行。CorePatch 在這個階段塞 B619，就是在用 hook 階段的計算結果污染 ground truth，後面要再用 hook 去救，邏輯上就不可能每個情境都閉合。

### 4. 不要相信「重刷就沒事」

第一次發生時我也是這個結論。第二次發生才讓我意識到這是流程問題，不是資料問題。

重刷只是把「被污染的 `packages.xml`」蓋掉，但污染的機制還在，下次遇到同樣條件就再發一次。真正的修法是修流程，不是修資料。

---

如果你也在 EU ROM 跑 CorePatch，而且曾經 bootloop 過，留下 logcat 和 `packages.xml` 的 B619 片段。這條鏈要有第二個案例，才知道它是不是只在我這台手機上成立。
