# 我只是叫 Codex 開網頁，結果一路查到瀏覽器信任邊界

有時候一個技術問題最麻煩的地方，不是它看起來很難。

是它看起來太簡單。

我只是叫 Codex 開一個網頁。照理說，這不應該是一件需要寫文章的事。瀏覽器在那裡，Chrome extension 也在那裡，native host 也連著，下一步不就是開 tab、goto URL、確認頁面載入嗎？

結果真正卡住的不是「怎麼開網頁」。

真正卡住的是：Codex 這次到底是透過哪一條被信任的路在控制瀏覽器。

## 這不是一般的瀏覽器自動化

如果只是測本機頁面，Codex 有 in-app browser。那條路很乾淨，localhost、file URL、截圖、點選、驗證畫面，都可以放在一個相對隔離的環境裡做。

但有些任務不能用那條路。

使用者已經登入的網站、既有 Chrome 分頁、profile 裡的 extension、cookies、遠端服務的 session，這些東西不在 in-app browser 裡。要碰到它們，就得走使用者真正的 Chromium 瀏覽器，也就是 Chrome 或 Helium 這類環境。

這時候問題就不只是「瀏覽器能不能被操作」。

問題變成一條管線：

```text
Codex
  -> Node REPL
  -> browser-client.mjs
  -> Chrome extension / native host
  -> 使用者的瀏覽器分頁
```

每一層都要對。

模型會不會寫 JavaScript 反而不是重點。重點是那段 JavaScript 有沒有拿到真正被允許的 browser bridge。

## 第一個問題：不是 client 壞，是路徑不被信任

原本直覺會走 Chrome plugin 裡快取的 client：

```text
~/.codex/plugins/cache/openai-bundled/chrome/.../scripts/browser-client.mjs
```

聽起來合理。plugin 在那裡，script 也在那裡，直接 import 起來用，不是很正常嗎？

麻煩就在這裡。

那份快取路徑的 `browser-client.mjs` 可能會被 runtime 判定成不 trusted，然後出現這類錯誤：

```text
browser-client is not trusted
privileged native pipe bridge is not available
```

這句錯誤如果只看字面，很容易以為 extension 沒裝好、native host 沒連上、或是 Chrome 本身沒有回應。

但真正的問題比較低階：不是瀏覽器不在，也不是 extension 不能用，而是目前 import 的 client 路徑沒有被授權拿那條 privileged bridge。

這個差別很重要。

因為如果判斷錯，你會去修錯東西。你會重裝 extension、重開瀏覽器、查 profile、甚至開始懷疑 Helium 和 Chrome 的差異。那些都可能有用，但這次最關鍵的不是那些。

這次關鍵是改走 bundled marketplace 裡那份被信任的 client：

```text
~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/chrome/scripts/browser-client.mjs
```

同樣都是 `browser-client.mjs`，但 runtime 在意的是它從哪裡來。

這很像 macOS 的權限問題。你以為你在跑同一個 app，但系統看的是 bundle identity、簽章、路徑、權限授權的那條鏈。檔案內容看起來一樣，不代表系統願意把同樣的能力交給它。

## 不能為了能動就繞過去

這種時候最危險的修法，是開始想辦法自己打 native host、自己走 socket、自己繞過官方 runtime。

我不是不能接受 debug 時做低階檢查。raw socket ping 有時候可以幫你確認 bridge 到底活不活著。

但拿它當正式控制路徑，我不太接受。

因為這裡碰到的是使用者真正的瀏覽器環境。裡面有登入狀態、有私人分頁、有 extension、有 profile。這種能力本來就該被放在一條有邊界的路上，而不是因為 plugin 快取路徑出問題，就臨時挖一條旁門。

真正該修的是信任路徑，不是把信任邊界拆掉。

所以 `chrome-trusted` 這個 skill 的存在其實很窄：它不是重做 Chrome automation，也不是另外發明瀏覽器控制協議。它只是要求 Codex 走 bundled marketplace 那份 trusted `browser-client.mjs`，然後仍然使用官方 browser API。

這個邊界留住，事情才不會變成「能動就好」。

## 健康檢查比開頁成功更重要

bootstrap 之後，第一件事不是急著開網頁。

我會先做一個很小的健康檢查：

```js
const tabs = await browser.user.openTabs();
nodeRepl.write(JSON.stringify({ ok: true, tabCount: tabs.length }, null, 2));
```

這段看起來沒什麼，但它回答了一個很關鍵的問題：trusted path 真的能跟 extension backend 說話嗎？

如果這裡過了，就代表問題不是 privileged bridge。後面如果導航失敗、DOM 操作失敗、分頁狀態不對，可以往 browser API 或頁面本身查。

如果這裡沒過，就不要假裝是網站問題。

這是我這次最在意的地方。很多 browser automation 的錯誤看起來都像「頁面沒載好」，但其實前面根本沒有拿到控制權。你如果沒有先確認那條路是通的，後面的 debug 都會歪掉。

後來我用 `gh` 去翻 openai/codex 的 issue，找到一個很像的外部錨點：[Chrome plugin file upload setFiles fails with Not allowed and upload forms can hang](https://github.com/openai/codex/issues/21597)。

那個 issue 講的不是 trusted path，而是另一層 browser plugin 問題：`openTabs()` 會動，分頁可以列出來，導航也成功，甚至一開始還能讀到頁面文字。但進到 authenticated upload form 之後，`tab.playwright.locator()`、`tab.dom_cua.get_visible_dom()`、截圖、file chooser 這些呼叫開始 timeout，最後要等到 runtime reset。

這件事剛好把問題講得更清楚：分頁還在，不等於 automation bridge 還健康；URL 導到了，不等於 DOM/CUA 那層真的可控。

我喜歡那個 issue 裡真正指出的產品問題：Chrome plugin 不應該卡到 runtime reset，至少要 fail fast，給一個能判斷的錯誤。這跟我這次遇到的信任路徑問題是同一類成本。最麻煩的不是它失敗，而是它失敗時讓你不知道該查哪一層。

## 第二個問題：這個 tab 不是 Playwright page

trusted path 通了之後，開新分頁其實很順：

```js
globalThis.tab = await browser.tabs.new();
await tab.goto("https://example.com");
```

然後我很自然地寫了：

```js
await tab.evaluate(() => ({
  title: document.title,
  url: location.href
}));
```

它回我：

```text
tab.evaluate is not a function
```

這個錯誤很小，但很有代表性。

因為這不是 Playwright page。這個 `tab` 是 browser-client wrapper。它上面有 `goto()`、`back()`、`reload()`、`screenshot()` 這種 top-level helper，但 Playwright 風格的能力在 `tab.playwright` 下面。

所以正確寫法是：

```js
await tab.playwright.waitForLoadState("domcontentloaded");
const pageInfo = await tab.playwright.evaluate(() => ({
  title: document.title,
  url: location.href
}));
```

這不是語法小事。

它代表這個工具的抽象不是「把 Playwright 原封不動丟給你」。它包了一層，因為它同時要處理使用者分頁、extension backend、能力清單、clipboard、content export、CUA 操作。你如果把它當成標準 Playwright page，就會在一個看起來很熟的地方摔倒。

我不討厭這層 wrapper。它有存在理由。

但 skill 裡必須把這個邊界寫清楚。不然下一個 agent 看到 `tab.goto()` 可以用，就會自然假設 `tab.evaluate()` 也可以用。這就是小坑變成重複成本的方式。

## 第三個問題：finalize 不是裝飾

Chrome browser tool 最後還有一個動作：

```js
await browser.tabs.finalize({ keep: [{ tab, status: "deliverable" }] });
```

這行看起來像收尾，其實是控制權邊界。

你可以把分頁留給使用者，這很好。但 finalize 之後，舊的 control object 不一定還能在後續 call 裡繼續用。分頁還在，使用者看得到；只是你手上的那個控制物件可能已經失效了。

這件事如果沒寫清楚，也很容易誤判。

你會看到「分頁明明還在，為什麼操作說 Tab not found？」然後又開始懷疑 extension 或網站。其實只是你已經把那個 session 收掉了。

所以比較穩的工作流是：互動、檢查、截圖或讀 DOM，都在 finalize 前做完。真的需要後續接手，就重新從 `browser.user.openTabs()` 拿目前的分頁物件，再 claim。

分頁可見，不等於控制權還在。

## Helium 也讓事情更容易被誤會

這次還有一層背景：Helium 是 Chromium-based，Codex Chrome Extension 可以在裡面工作，但 backend 可能仍然回報自己叫 Chrome。

這不代表使用者一定在用 Google Chrome。

如果你用名稱去判斷環境，很容易走錯診斷方向。真正該看的不是它叫什麼，而是 extension instance 有沒有連上、trusted client 有沒有拿到 bridge、openTabs 能不能列出目前分頁。

profile 診斷也一樣。Helium 的資料夾不會跟 Google Chrome 一樣。真的要做 profile check，才需要指定：

```bash
CODEX_CHROME_USER_DATA_DIR="$HOME/Library/Application Support/net.imput.helium"
```

但那只是診斷，不是正常控制路徑。

正常控制路徑還是 trusted `browser-client.mjs`。

## 這就是為什麼要寫成 skill

我以前對這種 skill 的看法比較簡單：它就是把一段可重複操作記下來。

這次比較明顯的是，skill 更像是把「不要再走錯路」記下來。

`chrome-trusted` 不需要寫成一本文件。它只需要把幾個會害人重踩的點釘住：

第一，別 import plugin cache 裡那份 client。

第二，走 bundled marketplace 的 trusted client。

第三，通過 `openTabs()` 健康檢查後再做瀏覽器操作。

第四，`tab` 不是 Playwright page，Playwright 能力在 `tab.playwright`。

第五，finalize 之後不要假設舊 control object 還活著。

這些都不是很深奧的技術。

但它們很適合變成 skill，因為模型每次重來都會自然掉進同一個洞。不是因為模型笨，而是因為它看到的 API 形狀太像另一個熟悉的東西。`tab.goto()` 可以用，於是它以為 `tab.evaluate()` 也可以用。快取資料夾裡有 `browser-client.mjs`，於是它以為那就是該 import 的檔案。

這些錯誤很合理。

合理到你不把它寫下來，它下次一定還會發生。

## 我這次真正改變的判斷

表面上，這只是一次開網頁。

但我後來在意的不是那個頁面有沒有打開，而是 Codex 在打開它的時候，知不知道自己站在哪一條被允許的路上。

AI coding agent 的信任問題，不只在模型會不會亂寫 code。

很多時候，真正讓人不舒服的是工具層的抽象看起來接好了，但底下其實差一條授權路徑、一個 wrapper 邊界、一個 session 收尾時機。壞掉時，你會以為是模型不會用工具，其實是工具把自己包成一個很像熟悉東西的形狀，卻沒有把差異講清楚。

我不是不能接受工具壞。

寫 code 的人都知道，東西一定會壞。

但我希望它壞的時候，能讓我很快判斷是哪一層壞。是 trusted path 沒拿到 bridge？是 extension 沒連？是 tab wrapper 被當成 Playwright page？是 finalize 後控制權已經收掉？

這些問題分得出來，debug 才會變短。

下一次我叫 Codex 開網頁，我不只是在測它會不會導航。

我是在確認它有沒有走在那條真正被允許的路上。
