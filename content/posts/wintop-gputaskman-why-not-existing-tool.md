# Windows 版的 top 早就有了，保哥應該比我清楚

11/11 晚上，Will 保哥在粉專貼了一張截圖：PowerShell 寫的 `top`，全螢幕，上半部是 CPU 使用率、時脈、記憶體、溫度四條五分鐘趨勢圖，下面是吃 CPU 最多的程序。已經上架 PSGallery，裝好之後打 `top` 就能開。

我第一個反應是：這不是微軟那邊的人剛發布的東西嗎？Scott Hanselman 前幾天才開放原始碼了一個 GPU 版的工作管理員，叫 gputaskman。所以我用 `gh` 把兩邊的時間查了一遍。

## 時間對得上，比的對象錯了

gputaskman 的 repo 是 11/3 建的。11/10 下午的 v0.3.5 加上了系統 RAM／CPU 面板，那是社群送的 [PR #27](https://github.com/shanselman/gputaskman/pull/27)，不是 Hanselman 自己寫的。保哥 [WinTop](https://github.com/doggy8088/WinTop) 的第一個 commit 是 11/11 18:54，版本 v0.1.0，一個 commit 就全部進去。照時間看，gputaskman 補上 CPU 面板大約一天之後，WinTop 就出來了。

可是兩邊的主軸不一樣。gputaskman 的 README 第一句是「An `htop` for what's inside your GPU」，想回答的是 VRAM 被誰吃掉、是模型權重還是 KV cache，還明寫只用 CPU 的工作不在範圍內。WinTop 看的是 CPU 時脈、Turbo、ACPI 溫度，兩邊只在 CPU／RAM 那一小塊重疊。

真的要找 WinTop 的先例，要往前找：[btop4win](https://github.com/aristocratos/btop4win) 2022 年就有，2,080 顆星；[NTop](https://github.com/gsass1/NTop) 是 2017 年的，1,500 顆星；跨平台的 [bottom](https://github.com/ClementTsang/bottom) 有一萬四千多顆星，11/11 當天還有人在 push。說重造輪子，撞到的是這幾個，不是 Hanselman。

## 這件事，他應該比我清楚

我不是靠寫程式吃飯的人。可是我自己做東西之前，會先查有沒有人做過、同一個上游有沒有別的 fork 走得比較遠。這個月初我在弄讓 MSFS 2024 在 Mac 上跑的相容層，做到一半才發現別人的 fork 已經做得比我完整，當天就改成 fork 它。我也不是每次都先查到，重造輪子這件事，我目前也還在盡力避免。十月我也寫過〈[agent 讓重造輪子變便宜，我選擇 fork，再把改過的地方寫進 PATCHES.md](https://b-log.to/dev-philosophy/patchmd-reinventing-wheel/)〉。

保哥不一樣。他寫技術部落格、拍教學影片很多年了，粉專在 Google 上顯示超過 10 萬人追蹤，他創的「Generative AI 技術交流中心」社團超過 21.7 萬人。Windows 上有哪些 `top` 類的工具，他應該比我清楚得多。

而且他確實知道。那篇貼文底下有人說「可以參考 linux 的 btop」，保哥的回覆是：

> Windows Terminal 太弱，玩不起來 XD

btop 有 Windows 版，就是 btop4win，它的 README 推薦的終端機剛好就是 Windows Terminal。這個理由站不住。

## 他的留言區沒有人問

到 11/12 早上，那篇貼文有 400 個心情、16 則留言、48 次分享。有人回報實際 CPU 使用率在 2% 到 10% 之間，有人許願加 GPU 跟 VRAM，有人說用 WMIC 配 MRTG、走 SNMP 也能畫圖表。也有人貼了 gputaskman 的連結，寫的是「分享，GitHub 副總寫的」，語氣就是分享。除了那則 btop，沒有人問為什麼不用現成的。

保哥回了其中五則，gputaskman 那則沒有回。許願加 GPU 跟 VRAM 的那則，他是在 gputaskman 的連結貼出來大約五個小時之後才回，回的是自己 repo 的連結，請對方到那裡許願。逐一列出每個程序吃了多少 VRAM，正是 gputaskman 在做的事。

英文社群會問。r/StableDiffusion 11/7 那篇〈[Microsoft engineer built a tool that shows what's really using your GPU](https://www.reddit.com/r/StableDiffusion/comments/1xq94xa/microsoft_engineer_built_a_tool_that_shows_whats/)〉，排在前面的留言之一就是「So, nvidia-smi?」，62 分，底下接著「Looks like cross platform nvtop」。Hanselman 的 README 早就有一節「Why not just `nvidia-smi`?」，寫明在 GeForce 的 WDDM 驅動下，NVML 拿不到每個程序的 VRAM 用量。有人把這段原文貼到那則留言底下，開頭只加了一句「Reading is fun.」，拿到 72 分，比問題本身還高。

有些版已經把這個問題寫進版規。r/selfhosted 1 月起推〈[Vibe Code Friday](https://www.reddit.com/r/selfhosted/comments/1qfp2t0/mod_announcement_introducing_vibe_code_friday/)〉：成立不到一個月、只有一個真正的貢獻者、看得出是 vibe coding 的專案，只能在星期五貼。版主說，這類貼文多到一個程度之後，社群對它們的態度變得負面，有時候甚至帶敵意。r/opensource 10 月底更狠，版規標題是「Your tokens aren't valuable: No more AI.」，專案要成立滿一年、三個以上貢獻者，還不能是「common capstone project」，例子是筆記 app、PDF 閱讀器、CLI 音樂播放器。照版主 ssddanbrown 在[自己部落格](https://danb.me/blog/opensource-sub-rules/)的說法，這套規則是首席版主一個人定的，他不同意，隔天就卸下版主。規則訂得對不對另外說，至少那邊的人會問。

他的留言區不會。四百個心情、四十幾次分享，大家看到的是保哥做了一個很厲害的工具。社群不問，這個問題就只剩一個人能問，而最有能力回答的也是他。

我不覺得 WinTop 沒有理由存在。純 PowerShell、不用另外裝執行檔、從 PSGallery 一行裝好、內建繁體中文介面，對它的使用者都是真的差別。可是 README 裡沒有寫，btop4win、NTop、bottom 一個都沒提到，留言區給的理由又站不住。二十幾萬人看著的人，做一個別人做過的工具，該交代的應該比我多，不是比我少。

順帶一提，GitHub 上還有另一個 [WinTop](https://github.com/maniat1k/wintop)，2025 年 1 月建的，也是 PowerShell 寫的，README 說受 htop 啟發，第一次執行會把自己裝成 `top` 指令。一顆星。
