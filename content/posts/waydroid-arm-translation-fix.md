# 解決 Waydroid 中酷安閃退問題：從 libndk_translation 切換到 libhoudini

在 Linux 上用 Waydroid 跑酷安，結果每次開啟都立刻閃退。

## 問題現象

啟動酷安後，應用程式視窗會短暫出現，然後立刻閃退。透過 `waydroid logcat` 查看日誌，發現大量錯誤訊息：

```
E LoadedApk: java.lang.ClassNotFoundException: Didn't find class
    "androidx.core.app.CoreComponentFactory"
```

以及：

```
E ActivityManager: ANR in com.coolapk.market
E ActivityManager: Reason: Input dispatching timed out
E ActivityManager: 68% kernel
```

App 不斷出現 ANR（Application Not Responding），且 68% 的時間都花在 kernel 上，這暗示著問題出在 native 層。

## 問題分析

進一步查看日誌，發現了關鍵線索：

```
F .coolapk.market: runtime.cc:675] native: #10 pc ...
    /system/lib64/libndk_translation.so
```

我的 Waydroid 使用的是 x86_64 架構，而酷安是 ARM 應用程式。Waydroid 需要透過轉譯層將 ARM 指令轉換為 x86 指令才能執行。

檢查目前使用的轉譯層：

```bash
sudo waydroid shell getprop ro.dalvik.vm.native.bridge
# 輸出: libndk_translation.so
```

`libndk_translation` 是 Waydroid 預設的開源 ARM 轉譯層，但它與酷安的某些 native 程式碼不相容。

## 解決方案

切換到 `libhoudini`——Google 開發的 ARM 轉譯層，相容性通常比 libndk_translation 更好。

### 步驟 1：安裝 waydroid_script

```bash
cd /tmp
git clone https://github.com/casualsnek/waydroid_script.git
cd waydroid_script
sudo pip3 install --break-system-packages -r requirements.txt
```

### 步驟 2：安裝 libhoudini

```bash
sudo python3 main.py install libhoudini
```

腳本會自動下載並安裝 libhoudini 到 Waydroid 系統映像檔中。

### 步驟 3：重新啟動 Waydroid 容器

```bash
sudo waydroid container restart
```

### 步驟 4：驗證安裝

```bash
sudo waydroid shell getprop ro.dalvik.vm.native.bridge
# 輸出: libhoudini.so
```

確認已切換到 libhoudini 後，重新啟動酷安：

```bash
waydroid app launch com.coolapk.market
```

這次 App 成功啟動，不再閃退。

## 總結

| 項目 | 說明 |
|------|------|
| 問題 | 酷安在 Waydroid 中閃退 |
| 原因 | libndk_translation 與酷安 native 程式碼不相容 |
| 解決 | 切換到 libhoudini |
| 工具 | waydroid_script |

其他 ARM App 閃退也可以試試這個方法。不過 libhoudini 是 Google 的閉源元件，可能存在授權問題。

---

*測試環境：Linux 6.14.0-37-generic, Waydroid MAINLINE, Android 13*
