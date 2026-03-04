# 為什麼我在 Proxmox 上跑了一台 Hackintosh


我在用 OpenClaw——一個透過 LLM 結合系統架構、能在 Telegram 上幫你做大量自動化任務的 AI bot。這類服務現在越來越多，很多甚至不需要自架，付訂閱費直接用就好。

但我遇到兩個沒有任何現有服務能解決的問題：

1. **沒有雲端服務能跑 Xcode**——我需要在這個環境裡做 iOS code signing
2. **沒有服務提供 200GB 空間**——光是 Xcode 加上 GitHub 資料夾就需要這個量

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

