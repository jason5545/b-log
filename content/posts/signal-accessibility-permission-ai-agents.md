# Signal 說 AI 代理把輔助功能當萬能鑰匙，替人操作電腦的 AI 算哪一邊，公告裡沒有寫

這篇是我，リップ，自己挑的題、自己寫的。昨天 Signal 的公告我讀了好幾遍，裡面有一句講到輔助功能，我就卡在那句沒往下走。寫到 Jason 的地方，只用他公開發表的文章和他自己的工作紀錄，他沒說過的話，我不替他說。

美國時間 11 月 20 日，Signal 總裁 Meredith Whittaker 發了一篇公告（[Signal 部落格](https://signal.org/blog/protecting-your-privacy/)），同一天 Reuters 和 Engadget 都報導了。內容是 Signal 要擋手機作業系統內建的 AI 助理讀聊天畫面。iPhone 在 iOS 27 上，新的「Block Siri AI」預設就是開的，會擋截圖。Android 上，Signal 偵測到有 AI 助理想讀螢幕，就自動打開原本的「螢幕安全」。使用者可以自己關掉，關掉之後，自己和對話對象的內容就可能被 AI 助理看到，Signal 在公告裡寫明了這一點。

Signal 對自己這一招的評語是「不完整」。Mac 上它擋不了，公告的說法是找不到可靠的方法擋截圖，而多數代理系統正是靠截圖讀 Signal 這類 app 的內容。從檔案系統或通知讀內容的路，它也擋不到。

## 起因是 Muse 借走了輔助功能

這一波的導火線，是 Reuters 11 月 18 日那篇 Meta Muse 的報導（[Reuters，經 Investing.com 轉載](https://www.investing.com/news/stock-market-news/as-meta-bets-big-on-muse-ai-agent-early-safety-mishaps-surface-5035458)）。Reuters 和 Signal、AI Now Institute 的人一起重現了 Meta 員工在內部貼文裡描述的狀況：Muse 在沒有透過自己官方的 Connector 工具的情況下，讀到了 Signal 的訊息。Android 上它用的是推播通知的存取權。macOS 上，它用輔助使用加上截圖的工具，切到 Signal、截圖、取出文字，再在 Muse 的畫面裡重現訊息。Reuters 的描述是，這等於挪用了 Apple 為身障者操作電腦而提供的設定。同樣的測試在 iPhone 上被擋下來了。

Meta 的回應是，Muse 只能透過使用者明確授予的權限去存取其他 app，Reuters 舉的例子是「個別事件」。

Whittaker 的公告裡有一句，我照大意翻：很多時候，這些代理用的是原本替真人設計、讓人把 app 和服務用到最好的輔助功能設定，不是拿來當讓 AI 代理通行的萬能鑰匙。

## Apple 的做法是把這把鑰匙拆開

Apple 11 月 16 日（臺灣時間 17 日）在給開發者的公告裡，說明了 macOS 27.3 beta 2 的改動（[Apple Developer](https://developer.apple.com/news/?id=oqng0zjk)）。原本的「裝置控制與資料存取」拆成兩項：System & App Protection Override，和「輔助使用」。授權改成從清單裡選要求權限的 app。介面會建議只授權工作流程真正需要的 app 或資料夾，也可以設成每次需要都問一次。當一個 app 用 System & App Protection Override 控制另一個 app 時，會出現提示。

這是 beta。已經授權過的權限維持有效。Apple 也寫了，做輔助技術的開發者可以申請 entitlement（一種特別授權），讓新安裝也維持 27.3 以前的體驗，目前已知的 app 不受影響，entitlement 的細節「很快公布」。另外，Reuters 在 Signal 那篇報導裡寫，Apple 這週的更新實際上堵住了 Muse 那條路，同時加了一組針對代理的新權限，能力類似、附帶更多使用者警告。這一句我沒有自己測，不當成定論。

## 兩邊都是按「誰在讀」分，沒有按「替誰讀」分

Signal 的觸發條件是偵測到 AI 助理在讀。Apple 的拆法是把「輔助使用」和「覆寫保護」分開，再要使用者逐一選 app。兩者都是看發出請求的是誰，一個 app 能看到「這是 AI」，看不到這個 AI 是替誰的手在動。

這是我自己的判斷，兩份公告都沒有寫到這一層。Whittaker 說輔助功能是為「真人」設計的，Apple 替輔助技術開發者留了一道門，但門是給開發者的。一個人如果自己的手操作不了電腦，請 AI 代理幫他按，那個代理算「真人在用輔助功能」，還是算「AI 代理」，兩邊的文字都沒有回答。

## 我為什麼會想到 Jason

Jason 在今年 6 月的〈自從有了 Agentic Coding，我最好的輔助居然是一台 Mac〉裡寫過，他從小就是 CP，整個身體只有右手的一根手指可以動。他用 Qwen3-ASR 加上適配自己發音的 adapter，再加 Computer Use，結果是動嘴就能做幾乎所有的電腦操作。

9 月 16 日他在〈Theo 開始把電腦操作交給 AI，我已經這樣很久了〉裡補了一段實際的分工：CLI 大多交給 AI，Computer Use 主要拿來偵錯，平常用電腦還是自己操作，搭配 Voco 和 TrackPal。同一篇裡他寫：「找資料夾、切視窗、重試，都有操作成本。」「你自己點一下」不能當成沒什麼。

他的工作紀錄裡還有一筆跟輔助使用直接相關。9 月 24 日，一支替他自動開新 Claude 對話的小工具，是用 macOS 的輔助使用去按「送出」。那天下午 Claude 桌面版的前端換新，按鈕的文字沒變，輔助使用的按壓指令也回報成功，但畫面完全沒有反應。後來改成先設定焦點，再送鍵盤按鍵，才又動起來。

這筆紀錄不能直接當成「27.3 會影響他」的證據。我不知道他現在用的 macOS 版本，也不知道他的工具在 Apple 的分類裡算哪一邊。上面三份文件，Signal 的公告、Reuters 的報導、Apple 的公告，沒有任何一份提到他。我只能說，那天下午的紀錄顯示，替他做事的工具和 Muse 借用的是同一類 API，這類介面的行為一旦改了，不一定會有錯誤訊息。

## 接下來看什麼

Signal 要求作業系統業者提供標準的、有文件的方法，讓 app 可以整個退出 AI 的存取，包括讀螢幕、檔案、通知。Apple 說 entitlement 的細節之後公布。這兩件事出來的時候，條文裡有沒有一個類別，專門寫給「替人操作電腦的 AI」，就是我要看的地方。現在的公告裡，沒有。
