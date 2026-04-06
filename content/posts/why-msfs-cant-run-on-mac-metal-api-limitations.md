# 為什麼 Microsoft Flight Simulator 到現在還不能在 Mac 上跑？

## 起因

我是模擬飛行玩家，主要玩 Microsoft Flight Simulator。兩年多前，我開始把工作環境從 Linux 轉移到 Mac，但 MSFS 這個需求一直沒辦法跟著搬過來。

當時我寫信給 CrossOver 的開發商 CodeWeavers 詢問支援進度，得到的回覆是：**Mac 的圖形 API 存在缺陷，導致他們無法正確支援**。

我覺得奇怪——同樣是 CrossOver/Wine 的翻譯技術，我在 Linux 上玩得好好的，怎麼到了 Mac 就不行？於是我做了一次完整的技術調查。

## 兩條完全不同的路

問題的答案，藏在圖形 API 的翻譯路徑裡。

**Linux 上的路徑：**
```
DirectX 12 → vkd3d → Vulkan（原生驅動）
```

**Mac 上的路徑：**
```
DirectX 12 → D3DMetal → Metal
```

Linux 有 AMD 和 NVIDIA 提供的**原生 Vulkan 驅動**，功能完整，該有的一個不缺。Mac 上則必須走 Apple 自家的 Metal API，而 Metal 缺了好幾塊關鍵拼圖。

## Metal 到底缺了什麼

### Geometry Shaders——最大的硬傷

Metal **從來沒有支援過 geometry shaders**，從第一版到最新的 Metal 4 都沒有。Apple 的態度很明確：他們認為這是過時技術，應該用 mesh shaders 取代。

問題是，遊戲產業不會因為 Apple 說過時就不用。大量現有的 Windows 遊戲仍然依賴 geometry shaders，MSFS 就是其中之一。而且翻譯層沒有辦法自動把 geometry shader 轉換成 mesh shader——這兩者的架構完全不同。

MoltenVK（Vulkan 到 Metal 的翻譯層）的 [GitHub issue #1524](https://github.com/KhronosGroup/MoltenVK/issues/1524) 從開設至今仍然是 open 狀態，沒有解決方案。

### 資源綁定上限

DirectX 12 遊戲通常需要存取至少 **100 萬個 Shader Resource Views**（所謂的 Tier 2 資源綁定）。Metal 過去只支援約 50 萬個，直接不夠。Metal 4 引入了新的 `MTL4ArgumentTable` 有所改善，但翻譯層能不能完全利用這些改進，還需要時間。

### GPU 虛擬位址

DX12 使用 GPU 虛擬位址來引用資源，光線追蹤功能特別依賴這個機制。Apple 長期拒絕支援，直到 Metal 3 才加了 `MTLBuffer.gpuAddress`，但完整程度仍不如原生 Vulkan 或 DX12 的實作。

### Tessellation（曲面細分）

更諷刺的是，Metal 4 不但沒有改善傳統的 tessellation 支援，反而**直接移除了** D3D11 風格的 tessellation，強制改用 mesh shader 實作。用傳統 tessellation pipeline 的遊戲，在 Metal 4 上可能比以前更慘。

### Sparse Resources

MSFS 的世界資料是即時從伺服器串流的，需要高效的稀疏資源管理。這一點 Metal 4 終於補上了 placement sparse resources，算是少數有明確改善的項目。

## MSFS 為什麼是最慘的案例

MSFS 基本上**同時踩到了 Metal 所有的限制點**：

- 強制要求 DirectX 12（2024 版連 DX11 回退選項都沒有）
- 要求 Shader Model 6.7
- 大量使用 geometry shaders 和 tessellation
- 光線追蹤陰影依賴 GPU 虛擬位址
- 即時世界串流需要 sparse resources
- 線上 DRM 和 Xbox 服務驗證在 Wine 環境下也有問題

AppleGamingWiki 對 MSFS 在 CrossOver 上的評級是直接標注 **Unplayable**。能安裝，但啟動就崩潰。

## 虛擬機也走不通

我也想過用 Parallels 或 UTM 裝 Windows 虛擬機來跑。結論是一樣不行——虛擬機裡的 GPU 還是透過 Metal 虛擬化出來的，底層限制完全相同。Parallels 跑 MSFS 的結果是黑畫面然後彈回桌面。

## Metal 4 改善了什麼

| 問題 | Metal 4 狀態 |
|------|-------------|
| Sparse Resources | 已修復 |
| Bindless 資源上限 | 提高到 100 萬 |
| Barrier API | 改善 |
| GPU 虛擬位址 | 部分支援（Metal 3 起） |
| **Geometry Shaders** | **仍然不支援，Apple 無意加入** |
| **傳統 Tessellation** | **反而被移除** |

部分遊戲已經受益於這些改善——例如 Cyberpunk 2077 在 M3 Max 上透過 GPTK 能跑到約 80fps。但 MSFS 不在支援清單中，因為它需要的恰好是 Metal 仍然缺少的那些功能。

## 我的現況

我目前的解決方案已經用了兩年多：一台跑 Proxmox VE 的 PC 伺服器（AMD 9950X3D + RTX 4070 Ti Super），透過 GPU 直通給 Windows 虛擬機跑 MSFS，再用 Moonlight 串流到 Mac 上操作。

最近因為計劃把 MacBook 從 M5 基本款升級到 M5 Max 128GB，我重新評估了一下能不能精簡設備、讓 Mac 一台搞定所有事。

調查結果很明確：**不行**。Metal 的限制跟硬體強弱無關，M5 Max 再猛也沒用，瓶頸在 API 層。那台 PC 伺服器短期內還是退不掉。

## 結論

CodeWeavers 的回覆是誠實的——這確實不是他們的問題，是 Apple 在 Metal 的設計上做了取捨。Apple 選擇不支援他們認為過時的功能（geometry shaders），改推更現代的替代方案（mesh shaders）。這個決定在技術願景上或許有道理，但現實是大量 Windows 遊戲仍在使用這些「過時」的功能。

最關鍵的是，Apple 的態度不是「還沒做到」，而是**「我們選擇不做」**。這意味著看不到修復的時間表。

對於跟我一樣想在 Mac 上玩 MSFS 的人，目前可行的選項只有兩個：
1. **從 Windows PC 串流**（Moonlight/Sunshine、Steam Remote Play）
2. **Xbox Cloud Gaming**（需要 Game Pass Ultimate 訂閱）

在 Apple 改變對 geometry shaders 的立場之前，這個狀況不會有根本性的改變。
