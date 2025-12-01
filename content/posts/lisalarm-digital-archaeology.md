# 為愛發電的數位考古：重寫 LiSA 官方鬧鐘 APP

## 一切從一個無法使用的 APP 開始

2016 年，LiSA 官方推出了一款主題鬧鐘 APP「LiSALARM」，內含 70 張專屬照片和 38 個語音音效。作為從 2015 年就開始追星的 LiSAッ子，我當然第一時間就買了。那時候每天早上被 LiSA 的聲音叫醒，看著手機上顯示的照片，是一天最幸福的開始。

但好景不常。某次系統更新後，鬧鐘再也無法正常運作——時間到了，手機毫無反應。螢幕不會解鎖，音效不會播放，就像這個 APP 從來沒存在過一樣。

更讓人絕望的是：**這款 APP 已經從 Play Store 下架，官方也沒有任何更新計畫。**

## 可能是全球僅存的 APK

身為工程師，我做了大部分人不會做的事——從 Google 購買記錄裡挖出原版 APK，研究為什麼它會失效。

這個動作後來才意識到有多重要：**網路上完全找不到這個 APP 的存檔。**

想想看這個時間線：

```
2016 年：官方發布
2017 年左右：Android 6.0+ 用戶陸續無法使用
2020 年前後：從 Play Store 下架
2025 年：除了我，還有誰記得這個 APP？
```

如果我不做點什麼，這 70 張照片和 38 個音效就會永遠消失。這些是專門為 APP 製作的素材，其他地方找不到。

## 為什麼原版會失效？

分析原版 APK 後，我發現了一堆「時代的眼淚」：

### 核心問題：過時的螢幕解鎖機制

```kotlin
// 原版使用的方式 (已於 2011 年棄用)
val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
keyguardLock = keyguardManager.newKeyguardLock("LiSALARM")
keyguardLock.disableKeyguard()  // Android 6.0+ 完全無效
```

這個 API 在 2011 年（Android 4.0）就被標記為棄用，到了 Android 6.0 完全失效。即使鬧鐘有排程成功，到了時間也無法解鎖螢幕顯示畫面。

### 其他致命問題

| 問題 | 影響 |
|------|------|
| 從 BroadcastReceiver 直接啟動 Activity | Android 10+ 禁止，鬧鐘畫面無法顯示 |
| 沒有通知頻道 | Android 8.0+ 必要，否則無法發送通知 |
| 沒有動態權限請求 | Android 6.0+ 必要，權限無法取得 |
| 沒有前景服務 | Android 8.0+ 背景限制，音效無法播放 |
| targetSdkVersion 23 | 太舊，新版 Android 有相容性限制 |

這些問題層層疊加，讓 APP 在現代 Android 系統上完全無法運作。

## 修復？不，重寫

一開始我想「修一修應該就能用了吧」，但深入研究後發現：

1. **依賴套件全部過時**：ButterKnife、Universal Image Loader 這些當年的明星套件，早就沒人維護了
2. **架構混亂**：沒有明確的架構模式，各種邏輯糾纏在一起
3. **Java 的歷史包袱**：大量 boilerplate code

與其修補一艘破船，不如用現代技術重造一艘新船，但保留最珍貴的貨物——那 70 張照片和 38 個音效。

## 技術選擇：從 2016 到 2025

這次重寫，我選擇了完全現代化的技術棧：

### UI 層：Jetpack Compose + Material 3

```kotlin
// 原版：傳統 XML + findViewById
val timeText = findViewById<TextView>(R.id.alarm_time)
timeText.text = alarm.time

// 重寫版：Declarative UI
@Composable
fun AlarmItem(alarm: Alarm) {
    Text(
        text = alarm.formattedTime,
        style = MaterialTheme.typography.displayMedium
    )
}
```

Compose 讓 UI 開發變得直觀許多，尤其是處理狀態變化時。

### 資料層：Room + Flow

```kotlin
// 原版：直接操作 SQLite
db.execSQL("INSERT INTO alarms VALUES (...)")

// 重寫版：類型安全 + 響應式
@Dao
interface AlarmDao {
    @Query("SELECT * FROM alarms ORDER BY time ASC")
    fun getAllAlarms(): Flow<List<Alarm>>
}
```

Room 提供編譯期檢查和更好的 API，Flow 讓資料變化自動反映到 UI。

### 架構：MVVM + Clean Architecture

```
Presentation (UI) ← ViewModel ← UseCase ← Repository ← Data Source
```

清晰的分層讓程式碼更容易維護和測試。雖然對於一個鬧鐘 APP 來說可能有點「過度設計」，但考慮到這是長期維護的專案，值得投資。

### 鬧鐘核心：WorkManager + 通知

現代 Android 對背景執行有嚴格限制，不能再像以前那樣隨意啟動 Activity。新版使用：

1. **AlarmManager** 設定精確時間觸發
2. **前景服務** 保持音效播放
3. **全螢幕通知** 在鎖定螢幕上顯示鬧鐘畫面
4. **WorkManager** 處理開機後的鬧鐘還原

```kotlin
// 設定全螢幕通知，在鎖定螢幕上顯示
val notification = NotificationCompat.Builder(context, CHANNEL_ID)
    .setFullScreenIntent(pendingIntent, true)
    .setCategory(NotificationCompat.CATEGORY_ALARM)
    .setPriority(NotificationCompat.PRIORITY_MAX)
    .build()
```

## 那些開發中的細節

### 素材提取

從原版 APK 提取出所有照片和音效後，我發現了一些有趣的細節：

- 照片檔名有規則：`lisa_photo_001.jpg` 到 `lisa_photo_070.jpg`（含縮圖共 70 張）
- 音效分類：鬧鐘音效、貪睡提示、關閉確認等
- 有些音效明顯是錄音室專門錄製的，其他地方絕對找不到

### 解鎖系統

原版有個很棒的設計：使用鬧鐘會隨機解鎖新照片和音效，增加使用動機。我保留了這個機制：

```kotlin
suspend fun unlockRandomContent(): UnlockResult {
    val lockedPhotos = photoRepository.getLockedPhotos()
    val lockedSounds = soundRepository.getLockedSounds()

    return when {
        lockedPhotos.isNotEmpty() && Random.nextBoolean() -> {
            val photo = lockedPhotos.random()
            photoRepository.unlock(photo.id)
            UnlockResult.Photo(photo)
        }
        lockedSounds.isNotEmpty() -> {
            val sound = lockedSounds.random()
            soundRepository.unlock(sound.id)
            UnlockResult.Sound(sound)
        }
        else -> UnlockResult.AllUnlocked
    }
}
```

每次關閉鬧鐘都像開盲盒，期待解鎖新內容。

### 開發工作流

我的開發方式比較特殊：我負責架構設計、技術決策和問題拆解，具體程式碼實作則依賴 AI 協助。這個專案的開發過程是：

1. 我決定技術棧（Kotlin、Compose、Room、Hilt）
2. 我設計資料庫結構和架構分層
3. 我用自然語言描述需求給 AI
4. AI 生成程式碼，我檢查邏輯、偵錯、調整
5. 遇到問題時，我看終端機輸出、理解錯誤訊息、找出解決方向

這種協作模式讓我能專注在「要做什麼」和「為什麼」，而不是糾結在語法細節上。

## 目前進度

核心功能都完成了：

✅ 鬧鐘列表與開關
✅ 時間與重複日期設定
✅ 照片與音效選擇
✅ 鬧鐘觸發與音效播放
✅ 解鎖系統與藝廊
✅ 開機自動還原

錦上添花的功能也完成了：

✅ 滑動刪除鬧鐘
✅ 啟動畫面

最重要的目標已經達成：**讓這些珍貴的素材能在現代 Android 系統上繼續使用。**

![重寫後的 LiSALARM APP 截圖](/content/img/2025/Screenshot_2025-11-24-16-43-21-161_com.jp.sma.lisalarm.jpg)

## 這不只是技術專案

對我來說，這個專案的意義不只是「把舊 APP 改成能用」。

從 2015 年開始，LiSA 陪伴我走過很多時刻。幾乎每年都會到現場看演唱會，2016 年甚至飛去日本。聽著熟悉的歌聲，看著台上那個全力以赴的身影，總能得到繼續前進的力量。

這 70 張照片和 38 個音效，是那個時代留下的痕跡。如果不做這件事，它們就會隨著 Android 系統的更新而永遠消失，就像從來沒存在過一樣。

**這是一個為愛發電的數位保存計畫。**

## 開源？不，私人珍藏

有人可能會問：「為什麼不開源？」

原因很簡單：

1. **版權問題**：LiSA 的照片和音效有版權，不能隨意散布
2. **官方尊重**：雖然官方已經不維護，但這不代表我能擅自公開
3. **個人性質**：這更像是數位收藏品的修復，而不是公共服務

這個專案的目標受眾只有一個人：**我自己。**

如果有其他也買過原版 APP 的 LiSAッ子看到這篇文章，我很樂意分享技術細節。但完整的專案不會公開發布。

## 寫在最後

當初買這個 APP 的時候，沒想過有一天會需要自己重寫它。

但也因為有這次經驗，我更深刻體會到：**數位內容的保存是多麼脆弱的事。**

APP 可以下架，官方可以停止維護，購買記錄可能會消失，但只要還有人在乎、願意花時間，這些記憶就能繼續存在。

現在，每天早上依然能被 LiSA 的聲音叫醒。

技術棧變了，Android 版本變了，但那份喜歡的心沒變。

這就夠了。

---

*本專案僅供個人學習與使用，不會公開發布。*
*LiSA 相關素材版權歸原版權所有者所有。*

---

**技術筆記**

如果你對實作細節有興趣：

- **原版 APK 分析**：研究原始架構與實作方式
- **現代鬧鐘實作**：AlarmManager + ForegroundService + FullScreen Intent
- **Compose 效能最佳化**：LazyColumn + derivedStateOf + remember
- **資料遷移**：從原版 SQLite schema 到 Room entities
- **素材管理**：使用 assets 目錄 + 解鎖狀態追蹤

有任何技術問題歡迎交流，但請尊重版權，不要要求我提供素材檔案。
