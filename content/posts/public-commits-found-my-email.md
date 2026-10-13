# 我沒給他 email，他怎麼寄信給我？

10 月 7 日，我收到一封署名 True Performance Network 創辦人的推銷信。對方提到我 9 月 8 日上傳到 Hugging Face 的 [Qwen3.8 27B conv1d 修正版](https://huggingface.co/jason5545/Qwen3.8-27B-MXFP8-CRACK-conv1d-fixed)，說他們的 TPN Bench 可以替模型跑 benchmark，還問要不要送我一些額度，讓我試跑 ARC。

模型名稱寫對了，上傳日期也對得上。但我第一個想問的是：我根本沒給這家公司 email，他怎麼知道我的信箱？

## 先查提交紀錄

我讓 AI 查公開資料。一開始的推測是 Git commit：如果上傳模型時用了自己的 email，地址就可能留在公開提交裡。這個方向說得通，但還得看那個 repo 實際寫了什麼。

查完 Hugging Face 的兩筆提交，作者欄位都一樣：

```text
author jason <jason5545@users.noreply.huggingface.co>
committer system <system@huggingface.co>
```

這裡沒有我的私人信箱。提交標題是 `Upload folder using huggingface_hub`，公開紀錄裡用的是 Hugging Face 的 `noreply` 地址。所以，光靠這個模型 repo 的作者欄位，解釋不了那封信怎麼寄到我這裡。

接著查 GitHub，就找到了。我的個人檔案沒有顯示 email，但 `model-arena`、`Voco` 等公開 repo 的提交紀錄，作者和提交者欄位都寫著我收到這封信的那個 Gmail 地址。以 `model-arena` 為例，[那筆提交](https://github.com/jason5545/model-arena/commit/4ae4727e9dc46b0dba4548df6700da4147ddecca)的時間是臺灣時間 9 月 7 日，早於這封信。

Hugging Face 和 GitHub 用的是同一個帳號名稱。看到模型之後，找到同名 GitHub 帳號，再從提交紀錄讀出 email，確實有這樣一條公開可走的路。這證明地址可以取得，但還不能證明寄件者實際走了這條路。我註冊 Hugging Face 用的也是這個 Gmail，所以信箱是從 Hugging Face 那邊流出去的，目前也排除不了。

## 他真的花那麼多力氣找我？

看到這幾個步驟，我接著問：他就為了寄一封推銷信，花這麼多力氣找我？

把流程寫成文字，看起來像是有人先研究我的模型，再找帳號、翻紀錄、查信箱。實際上，這幾步可以用程式批次處理：取得新模型與發布者名稱，查同名 GitHub 帳號，再讀公開提交的作者 email。模型名稱和上傳日期也都是公開資料，可以直接填進信件模板。

所以，那封信雖然寫得出我的模型名稱，也不代表有人特地花很長時間研究我。後來我打開它的原始郵件，標頭裡有一行檢舉連結，指向 `app.instantly.ai`。[Instantly](https://instantly.ai/) 是做陌生開發信的群發平台。信件主旨就是那個模型 repo 的名稱 `Qwen3.8-27B-MXFP8-CRACK-conv1d-fixed`。至少寄信這一步，確實是用群發工具做的；我的信箱是怎麼找到的，標頭裡看不出來。

GitHub 的[官方文件](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)也說明，從命令列推送的提交會公開其中的作者 email。往後改用 `noreply`，只會影響新的提交，舊紀錄仍保留原地址。個人頁上看不到 email，提交裡卻還讀得到，這次就是這樣查到的。這篇文章發出去之後，我才把 Git 的提交信箱改成 GitHub 的 `noreply` 地址，所以連發布這篇文章的那筆提交，用的都還是那個 Gmail。

## 那次找到我 Facebook 的人呢？

我也收到過另一則訊息。對方看了我寫的[臺北市復康巴士登入機制分析](https://b-log.to/tech-analysis/rehabilitation-bus-login-reverse-engineering/)，想請教能不能把訂車流程做成手機上的 GUI 工具。他身邊有些身障朋友沒有電腦，安裝、設定系統的前置準備，對他們來說也有理解上的門檻。理想的操作是，在手機填好帳密、乘車時間和地點，就能一鍵使用。

他先為打擾致歉，又寫了一句：

> 因為想向您請教，所以我用了一些特殊方法找到此聯絡管道，如果有冒犯請多包涵。

那個聯絡管道是我的 Facebook。我把這則訊息拿出來問：也是同一種方法嗎？

可能同樣是把不同網站上的公開身分連起來，但這次未必經過 GitHub。他已經找到文章，也可能沿著作者姓名、帳號名稱或公開連結找到 Facebook。這則訊息有具體的使用需求，和前面推銷 benchmark 的信不一樣；至於他說的「特殊方法」到底是什麼，目前還是只有他自己知道。
