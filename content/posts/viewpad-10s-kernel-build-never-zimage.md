# 當年我照著教學編 ViewPad 10s 的核心，一次也沒編出 zImage

Jelly Bean 那時，我在 ViewSonic ViewPad 10s 上試著自己編 Android 核心。教學一行一行複製、貼上，編了好幾次，每次都失敗。我很清楚記得 make 跑完應該會印出 `Kernel: arch/arm/boot/zImage is ready` 這一行，因為我在自己的電腦上一次也沒看過它。連 zImage 都沒有，後面的打包、刷機根本輪不到。

一直到 2026 年 10 月 2 日，我才第一次把自己編的核心刷進手機、正常跑起來。中間隔了十幾年。這陣子回頭查當年那次失敗，想弄清楚兩件事：我那時候的能力到哪裡為止，還有照著那種教學做，可能錯在哪裡。

## 舊站裡沒有這件事

這台平板是我爸當年讓我在 iPad 1 跟它之間選，我選的。2011 到 2013 年初，我在自己的舊站開了一個「Viewpad 10s 開發」分類，從 Wayback 撈回來的有五篇：VegaComb 3.2、Honey Ice、Vegacomb Build 9n、VegaCream RC2，最後是 2013 年 1 月 14 日我自己做的 CM10.1 Alpha 臺灣版。

這五篇寫的都是同一層的事：把英文更新列表翻成中文，寫刷機步驟，從裝驅動、進 nvflash 模式、進 CWM 全部清除，一路寫到刷 zip。臺灣版改的東西是時區、日期格式、預設繁體中文、臺灣的 GPS 修正、刪程式省 /system 空間、換繁體版的超級使用者、改 build.prop。這些全部不用編譯，改文字設定檔、換 APK、刪 APK 就做得到。

編核心的事，一篇都沒有。原因很簡單：以我那時候的個性，失敗的東西不會寫上去。所以舊站留下來的，剛好就是我能力範圍以內的那一塊。刷機流程、救磚模式、分割區在使用者這一端代表什麼、zip 裡的設定檔跟 APK，我都摸得到。再往下一層，從原始碼做出一個能開機的核心，舊文裡沒有任何一篇碰到。

2011 年 8 月那篇有一個小地方：我寫這包 ROM「適用於 Viewpad 10s、Advent Vega、POV Mobile 等 p10 核心的平板電腦」，那裡的「核心」指的其實是主機板平台 P10AN01，不是 kernel。到了 2012 年 7 月 VegaCream 那篇，我寫的是「採用 3.1.10 核心」「基於新版 NVidia rel-15r7 核心」，詞抄對了。但 rel-15r7 是一棵 git 原始碼樹的分支名稱，而且社群已經把它放上 GitHub，這兩件事我那時大概沒有意識到。

## 我當時是怎麼編的

電腦是一台 ASUS F3U：AMD Athlon 64 X2、ATI Radeon X1250 內建顯示、Windows Vista，銀色上蓋。這台跟比特幣差不多是同一個時期，我還拿它挖過比特幣，沒多久就停了。我那時還不會切雙系統的分割區，所以 Ubuntu 大概是用 Wubi 裝的，在 Vista 裡跑一個安裝程式，Ubuntu 變成 Vista 裡的一個大檔案，開機多一個選單。

教學主要照的是不分機型的通用版本：`export ARCH=arm`、`export CROSS_COMPILE=arm-eabi-`、`make menuconfig`，然後 make。另外我也看過 MoDaCo 跟 TabletROMs 上 Vega 社群的討論串，就是 Scanno、ejtagle 那一群人在的地方。打包跟拆 boot.img 的工具，mkbootimg、abootimg、split_bootimg.pl 我都用過。

原始碼是從哪裡抓的、make 到底報了什麼錯，我已經想不起來了。下面講的卡點，都只能寫成「可能」。

## 那種教學沒寫出來的前提

當年這類教學長什麼樣，XDA 上有一篇很典型：2011 年 8 月 1 日一篇教人編原廠 Android 核心的指南，機型是 ASUS 的 TF101。步驟就這幾個：從 ASUS 官網下載核心原始碼；用 `adb pull /proc/config.gz` 從正在跑的機器拉出設定檔；`git clone git://android.git.kernel.org/platform/prebuilt.git` 抓工具鏈，設好 `ARCH`、`CROSS_COMPILE` 跟 PATH；`make -j4`，拿到 `arch/arm/boot/zImage`。打包成 boot.img，請你去看另一篇。作者自己也說他不是核心或編譯器的專家，是靠 Google 加上一次次試錯學會的。

這篇背後有四個沒寫出來的前提：廠商公開的原始碼就是機器上在跑的那一份；機器上拉得到設定檔；那個 git 網址還活著；打包是另一回事，自己想辦法。

TF101 跟 ViewPad 10s 一樣是 Tegra 2，同一個年代。後來社群做的 VegaBean 甚至借用了 TF101 的系統指紋。兩台看起來近到像是可以直接套用。

## 這台平板偏偏不符合

到了 Jelly Bean 時期，ViewPad 10s 上跑的核心已經不是 ViewSonic 原廠那一份。拆開 Scanno 的 VegaBean 刷機包，裡面的核心版本字串是 `3.1.10-VegaCream`，是社群自己做的。教學的第一個前提，在這台上一開始就不成立。

這份社群核心的原始碼放在 Scanno 的 GitHub，倉庫叫 `rel-15r7`，2012 年 7 月 15 日建立，名字來自 NVIDIA 自己的 git 分支。麻煩在分支。GitHub 打開預設是 `master`，裡面的設定檔有 `tegra_android_defconfig` 這些，但沒有這台機器的。這台的板子代號叫 Shuttle，它的 `tegra_shuttle_defconfig` 只在另一個叫 `jb` 的分支裡，而且是 2012 年 12 月 3 日才加進去的。如果去 kernel.org 抓主線核心，情況更糟：v3.1 的主線根本沒有 `board-shuttle.c`，從一開始就是錯的那棵樹。

通用教學預設你手上有一份對的設定檔。我手上這台，對的設定檔藏在非預設的分支裡，2012 年 12 月以前甚至還不存在。這條跟「照教學做，make 一直失敗」最對得上，但只是推測，我記不得當時的錯誤訊息。

另一個可能更早就倒了。教學裡抓工具鏈那行 `git://android.git.kernel.org`，在 2011 年 kernel.org 出事之後停擺過，AOSP 後來搬到 Google 自己的 android.googlesource.com。如果我照抄的是 2011 年的教學，那一行 clone 很可能直接失敗，後面的交叉編譯器、PATH 也就跟著設不起來。

工具鏈版本倒不太像主因。同一個 3.1.10，VegaBean Beta 6 用 gcc 4.4.3 編，RC2 換成 gcc 4.6，兩包都正式發布了。比較可能出事的，是根本沒有裝好 ARM 交叉編譯器，或 PATH 指錯地方。

## 就算編過了，後面還有好幾關

這些關我都沒走到，但回頭看，就算那時 make 真的過了，離能用還很遠。

這台的 cmdline 要手動帶一整串 `mtdparts=tegra_nand:...`，寫著 NAND 上 7 個分割區的位置，還有 `mem=512M@0M nvmem=128M@512M`。重新打包時漏掉，核心就找不到 /system。系統分割區用的是 YAFFS2，VegaBean 為了把 4.1 塞進 155 MB 的 /system，又把好幾個目錄壓成 squashfs，開機時用 loop 掛上去，所以核心要內建 YAFFS2、SQUASHFS 跟 XZ 壓縮、loop 裝置，少一個就掛不起系統。Wi-Fi 驅動 `ar6000.ko` 是另外編的外部模組，核心的版本字串要跟它一字不差才載得進去；GitHub 上那份設定檔寫的版本字尾是 `-Shuttle_p10an01`，從 git 樹編核心還會自動在版本號後面多加一個「+」，Scanno 在 2013 年 2 月特地 commit 把它拿掉。這幾關，教學一個字都沒提。

## 當年不是沒有 Device Tree，是這台沒用

當年到底有沒有 Device Tree，我之前也好奇過。答案是有：ARM 的 Device Tree 支援在 Linux 3.0 就進了主線，Tegra 第一份 .dts 在 3.1 出現，主線到 3.7 才把 Tegra 的板級 C 檔刪光。這台的核心樹裡也有 .dts，只是都是別的板子的。Shuttle 用的是 `board-shuttle*.c` 這組 C 檔，核心設定裡 `CONFIG_MACH_TEGRA_DT` 沒有開。

所以那時候一顆核心只服務一塊板子，換一塊板子就要換一組 C 檔重編。別台機器的教學寫得再清楚，搬到這台上，最關鍵的那份設定檔跟板級程式碼都得自己找。

2026 年 10 月我編成功的，是 6.12.38 的 GKI 核心，一顆核心配很多機器，跟模組之間有統一的介面。當年還沒有 GKI，也沒有 KMI，每台機器都是自己一套。有一件事倒是當年就懂了：從上游 cherry-pick 修正，只動版本號最後一段。

回頭看那次失敗，我那時會的到 ROM 包為止。往下一層要先知道的事，對的原始碼在哪一棵樹、哪一個分支，設定檔從哪裡來，工具鏈的網址還在不在，教學都沒寫。我也不知道該問哪裡，身邊也沒有人可以問。那行 `zImage is ready`，我在那台 ASUS F3U 上始終沒等到。

