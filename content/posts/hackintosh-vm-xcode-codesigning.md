# 為什麼我在 Proxmox 上跑了一台 Hackintosh


我在用 OpenClaw——一個透過 LLM 結合系統架構、能在 Telegram 上幫你做大量自動化任務的 AI bot。這類服務現在越來越多，很多甚至不需要自架，付訂閱費直接用就好。

OpenClaw 爆紅之後，大批人開始搶購 Mac mini 作為專屬的 24/7 agent 執行機器，導致 Mac mini M4 一度缺貨、等待時間拉長到六週。但有趣的是，OpenClaw 本身根本不需要強大的硬體——它只是跑一個 Node.js 行程然後對外發 API request，作者自己也公開澄清過只需要 2 vCPU 和 4GB RAM。大多數人買 Mac mini 其實是不必要的。

但我的情況恰好相反——我是少數真的需要 macOS 能力的人，原因有兩個：

**1. Xcode code signing**

沒有任何雲端服務能跑 Xcode，而我需要在這個環境裡做 iOS code signing，把 build 出來的東西裝到裝置上測試。光是 Xcode 加上 GitHub 資料夾就需要 200GB 空間，這也是現有服務給不了的。

**2. Accessibility API**

OpenClaw 有個技能是透過 MCP 調用 Apple 底層的 Accessibility API，讓 AI 直接操控 macOS 上任何 App 的 UI。這個 API 是 Apple 私有的，Linux 上沒有對應的替代方案。一個 Linux VM 可以跑 OpenClaw，但這個能力就消失了。

所以「為什麼是 macOS 而不是 Linux」不是偏好問題，是能力邊界的問題。

---

有人會說：那買台 Mac mini 就解決了。但我有兩個理由沒這樣做：一是我的 MacBook Pro M5 已經是一筆不小的支出，二是我本來就有一台規格很強的 HomeLab 在跑，不拿來用就是浪費。

所以我在 Proxmox 上用 QEMU/KVM 跑了一台 Hackintosh，使用 OpenCore 引導，SMBIOS 型號 iMacPro1,1。

**網路架構**

這台 VM 只存在於 Tailscale 的私有網路，沒有任何對外開放的 port。對外的唯一出口是 OpenClaw Gateway——它用 long-polling 定期去 Telegram 伺服器拿訊息，所有連線都是 outbound，Telegram 不需要能反向連進 VM。零攻擊面，手機照樣能操控。

問題是：Xcode 在 VM 裡登不進去 Apple ID。

---

## 修復方式

技術細節跟[之前修 KVM Hackintosh Apple ID 的那篇](/posts/macos-sequoia-kvm-apple-id)完全一樣，三件事缺一不可：

1. **VMHide.kext**——隱藏 `kern.hv_vmm_present`，讓 macOS 以為自己在實體機
2. **GenSMBIOS 重新生成 SMBIOS**——換掉可能被標記的序號
3. **NVRAM 補齊 ROM 和 MLB**——`4D1FDA02-...` 區段要明確注入

這次的環境差異是：EFI 在 Proxmox 的實體分區（`/Volumes/EFI-PX-HACK/EFI/OC/`），不是 OSX-KVM 的 qcow2 映像，所以不需要 `qemu-nbd` 掛載，直接編輯就好。

修完重啟驗證：

```bash
sysctl kern.hv_vmm_present
# kern.hv_vmm_present: 0  ← 成功
```

開 Xcode 登入，正常了。

---

## 這台機器的主人是 AI

這個架構有一個刻意的設計：我不會登入這台 VM。

系統裡的檔案我不碰，內部狀態我不看，所有的操作都交給 AI 處理。我唯一會接觸的，是雙向同步的那個程式碼資料夾——在 MacBook 上寫到一半，同步過去，躺在床上用 iPhone 透過 Telegram 繼續叫 AI 把它完善。

這跟一般人用 AI 輔助開發的思路有本質上的差異。通常人還是主角，AI 是工具。但這台機器的設計從一開始就是反過來的：**AI 是這台機器的使用者，我只是它的程式碼來源。**

