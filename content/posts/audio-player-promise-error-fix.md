# 修復音訊播放器點擊無反應：Promise 錯誤處理的重要性

在為部落格新增音訊播放器功能後不久，我遇到了一個看似簡單卻頗具啟發性的 bug：播放按鈕點擊後毫無反應。這篇文章記錄完整的偵錯過程，以及一個容易被忽略的 JavaScript 陷阱。

## 問題現象

使用者回報：「Claude nerf 文章的音訊播放器點擊播放沒有反應」。

初步觀察：
- 播放器 UI 正常顯示
- 按鈕可以點擊，但沒有任何視覺或聽覺反饋
- 沒有明顯的錯誤訊息彈出

## 偵錯過程

### 第一步：使用 Chrome MCP 開啟網站

我使用 Chrome MCP（Model Context Protocol）直接在瀏覽器中進行偵錯：

```bash
# 開啟目標頁面
chrome_navigate("https://b-log.to/ai-analysis/claude-nerf-analysis/")
```

### 第二步：檢查 Console 錯誤

透過 `chrome_console` 工具擷取錯誤訊息，發現兩個關鍵線索：

**錯誤 1：404 網路請求失敗**
```
Failed to load resource: the server responded with a status of 404 ()
URL: /content/audio/Claude_AI_變笨還是被Nerf？...陷阱-part0.m4a
```

這個錯誤是誤報——系統嘗試載入分割檔案 `-part0.m4a`，但實際上只有完整的 `.m4a` 檔案存在。播放清單偵測邏輯正常返回原始檔案，這不是主要問題。

**錯誤 2：未捕獲的 Promise 錯誤**
```
Uncaught (in promise)
URL: https://b-log.to/assets/main.js
Line: 243, Column: 14
```

這才是真正的罪魁禍首！

### 第三步：深入測試 Audio 元素

我注入測試腳本直接呼叫 `audio.play()`：

```javascript
const audio = document.querySelector('.audio-player audio');

try {
  await audio.play();
  console.log('✅ Play succeeded!');
} catch (error) {
  console.error('❌ Play failed:', error);
}
```

結果揭曉：

```
❌ Play failed: NotAllowedError: play() failed because
the user didn't interact with the document first.
Error name: NotAllowedError
```

## 根本原因分析

問題出在 `assets/main.js` 的第 243 行：

```javascript
// 播放/暫停
playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();  // ❌ 沒有處理 Promise 錯誤
  } else {
    audio.pause();
  }
});
```

### 為什麼會失敗？

現代瀏覽器的 `HTMLMediaElement.play()` 方法返回一個 **Promise**，用於處理以下情況：

1. **自動播放政策限制**：未經使用者互動前不允許播放
2. **媒體載入失敗**：檔案不存在或格式不支援
3. **權限問題**：使用者拒絕媒體播放權限

在我的案例中，雖然使用者確實點擊了按鈕（符合互動要求），但 Promise 仍然可能因為其他原因被拒絕。**未處理的 Promise rejection 會導致靜默失敗**——程式碼不會崩潰，但功能完全無法運作。

## 解決方案

修復非常簡單，為所有 `audio.play()` 調用加上 `.catch()` 錯誤處理：

**修復 1：播放/暫停按鈕**（main.js:243）
```javascript
playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play().catch(error => {
      console.error('播放失敗：', error);
    });
  } else {
    audio.pause();
  }
});
```

**修復 2：播放清單自動播放**（main.js:445）
```javascript
// 自動播放下一個片段
audio.play().catch(error => {
  console.error('自動播放失敗：', error);
});
```

## 技術要點總結

### 1. Promise 必須處理錯誤

JavaScript 的 Promise 有三種狀態：pending、fulfilled、rejected。**任何返回 Promise 的方法都應該處理 rejection**，否則會導致：

- 未捕獲的 Promise 錯誤（Uncaught in promise）
- 靜默失敗（功能不運作但沒有明顯錯誤）
- 難以偵錯（沒有堆疊追蹤）

### 2. 瀏覽器自動播放政策

Chrome、Firefox、Safari 等現代瀏覽器都實施嚴格的自動播放政策：

- ✅ 允許：使用者互動後的播放（點擊、觸控、鍵盤）
- ❌ 禁止：頁面載入時自動播放
- ⚠️ 例外：靜音影片或已授權的網站

即使符合政策，`play()` 仍可能因為其他原因失敗，因此**錯誤處理不是可選的，而是必須的**。

### 3. 偵錯工具的價值

這次偵錯過程中，Chrome MCP 發揮了關鍵作用：

- **遠端偵錯**：無需開啟本機 DevTools
- **腳本注入**：即時測試假設
- **Console 擷取**：完整的錯誤記錄

這類工具對於在生產環境中快速定位問題非常有幫助。

## 經驗教訓

1. **所有異步操作都應該有錯誤處理**
   - 不只是 `audio.play()`，任何返回 Promise 的方法都一樣
   - 使用 `.catch()` 或 `try-catch`（async/await）

2. **靜默失敗是最糟的失敗**
   - 至少在 console 輸出錯誤訊息
   - 考慮使用錯誤追蹤服務（Sentry、Rollbar）

3. **測試真實使用者場景**
   - 本機開發時可能沒有自動播放限制
   - 生產環境的政策可能更嚴格

4. **善用偵錯工具**
   - Chrome DevTools、MCP、遠端偵錯
   - 不要只依賴 `console.log`

## 修復驗證

提交修復後（commit `51ce01e`），透過以下步驟驗證：

1. 清除快取並重新載入頁面
2. 點擊播放按鈕
3. 確認音訊正常播放
4. 檢查 console 無錯誤訊息

✅ 播放器現已完全正常運作！

## 後續修復：自動略過內容問題（2025-10-19）

在 Promise 錯誤處理修復後，又發現了一個更隱蔽的問題：播放時會自動略過一些內容，但進度條顯示正常，原始檔案也正常。這個問題源於多個時序競爭條件（race condition）和事件處理器衝突。

### 發現的核心問題

經過深度分析（commit `dde7489`），找出了 5 個相互關聯的問題：

**1. 播放進度還原時機錯誤**（高嚴重性）
```javascript
// ❌ 錯誤：在音訊元數據載入前就設定 currentTime
const savedTime = localStorage.getItem(storageKey + '-time');
if (savedTime && parseFloat(savedTime) > 0) {
  audio.currentTime = parseFloat(savedTime);  // 太早設定！
}
```

如果在 `loadedmetadata` 事件觸發前設定 `currentTime`，可能會失效或產生競爭條件，導致播放進度跳過或重置。

**2. 進度儲存觸發條件不可靠**（中嚴重性）
```javascript
// ❌ 錯誤：使用 % 5 判斷觸發時機
if (Math.floor(audio.currentTime) % 5 === 0) {
  localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
}
```

`timeupdate` 事件並非每秒精確觸發一次（通常是每 250ms），使用 `% 5 === 0` 判斷可能永遠不會觸發，尤其是在播放速度改變時。

**3. 播放清單片段切換衝突**（高嚴重性）

播放清單模式下，`loadPart()` 會呼叫 `audio.load()`，這會觸發 `loadedmetadata` 事件，但此時播放進度可能已經被設定，導致進度被重置或跳到錯誤位置。

**4. ended 事件處理器重複綁定**（中嚴重性）

`init()` 中已經綁定了 `ended` 事件，`initPlaylist()` 又綁定了另一個處理器，兩者可能互相衝突，導致播放清單模式下行為異常。

**5. 缺少 seeking/seeked 事件處理**（低嚴重性）

拖曳進度條時會觸發 `timeupdate` 事件，可能導致儲存錯誤的播放進度。

### 修復方案

**修復 1：正確的播放進度還原時機**
```javascript
// ✅ 正確：在元數據載入完成後還原播放進度
audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = this.formatTime(audio.duration);

  const savedTime = localStorage.getItem(storageKey + '-time');
  if (savedTime && parseFloat(savedTime) > 0) {
    const time = parseFloat(savedTime);
    if (time < audio.duration) {
      audio.currentTime = time;  // 確保音訊已載入
    }
  }
});
```

**修復 2：改用時間戳記節流機制**
```javascript
// ✅ 正確：使用節流避免過度儲存
let lastSaveTime = 0;
const SAVE_INTERVAL = 5000; // 5 秒

audio.addEventListener('timeupdate', () => {
  // ... 更新 UI ...

  if (!isSeeking) {
    const now = Date.now();
    if (now - lastSaveTime >= SAVE_INTERVAL) {
      localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
      lastSaveTime = now;
    }
  }
});
```

**修復 3：新增 seeking/seeked 事件處理**
```javascript
// ✅ 正確：拖曳時暫停儲存，拖曳完成後立即儲存
let isSeeking = false;

audio.addEventListener('seeking', () => {
  isSeeking = true;
});

audio.addEventListener('seeked', () => {
  isSeeking = false;
  localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
  lastSaveTime = Date.now();
});
```

**修復 4：使用 CSS class 標記播放清單模式**
```javascript
// ✅ 正確：統一處理 ended 事件
audio.addEventListener('ended', () => {
  if (!audioPlayer.classList.contains('playlist-mode')) {
    localStorage.removeItem(storageKey + '-time');
    progressBar.value = 0;
  }
});

// 在 initPlaylist() 中
audioPlayer.classList.add('playlist-mode');
audio.addEventListener('ended', () => {
  if (!audioPlayer.classList.contains('playlist-mode')) return;
  // ... 播放清單邏輯 ...
});
```

### 技術要點

1. **時序競爭條件（Race Condition）**：異步操作必須確保正確的執行順序，尤其是媒體元素的載入和狀態設定。

2. **節流（Throttling）vs 去抖（Debouncing）**：對於高頻事件（如 `timeupdate`），使用時間戳記節流比條件判斷更可靠。

3. **事件處理器管理**：避免重複綁定同一事件，使用狀態標記（如 CSS class）區分不同模式。

4. **狀態同步**：拖曳進度條時需要暫停自動儲存，避免儲存中間狀態。

### 測試場景

修復後應測試以下場景：
- ✅ 首次播放（無儲存進度）
- ✅ 還原播放（有儲存進度）
- ✅ 拖曳進度條
- ✅ 播放速度變更
- ✅ 播放清單模式（多個片段）
- ✅ 頁面重新載入

## 結語

這個看似簡單的 bug 揭示了一個重要教訓：**JavaScript 的 Promise 機制要求開發者主動處理錯誤**。在異步操作日益普遍的現代 Web 開發中，忽略 Promise rejection 就像忽略 try-catch 一樣危險。

記住：**如果一個函數返回 Promise，你就有責任處理它的 rejection**。這不僅能讓程式碼更健壯，也能讓偵錯過程更加順暢。

---

**相關資源**：
- [MDN: HTMLMediaElement.play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay/)
- [JavaScript Promises 完全指南](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
