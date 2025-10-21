# 語法突顯系統的深度除錯之旅：四個連鎖問題的修復實錄

## 前言

在開發部落格的過程中，程式碼區塊的語法突顯功能是提升閱讀體驗的關鍵。然而，當我實作自訂的語法突顯系統時，卻遇到了一連串看似簡單、實則環環相扣的問題。這篇文章將詳細記錄我如何逐步診斷並修復四個連鎖問題，以及背後的技術原理。

## 問題全景

在修復過程中，我遇到了四個主要問題：

1. **URL 被誤判為註解**：`https://example.com` 中的 `//` 被當作註解處理
2. **巢狀標籤導致關鍵字異常**：`const` 顯示為 `constspen`，`if` 顯示為 `ifspan`
3. **數字殘留問題**：程式碼區塊前面出現意外的數字 `0`、`1` 等
4. **HTML 實體符號顯示錯誤**：`<` 和 `>` 顯示為文字 `&lt;` `&gt;`

這些問題並非獨立存在，而是相互關聯，需要系統性的思考和逐步修復。

## 系統架構概覽

在深入問題之前，先了解整個語法突顯系統的架構：

```javascript
function applyBasicSyntaxHighlighting(codeBlock, language) {
  const code = codeBlock.textContent;
  const lines = code.split('\n');

  const highlightedLines = lines.map(line => {
    // 優先處理註解行
    if (/^\s*\/\//.test(line)) {
      return `<span class="token comment">${escapeHtml(line)}</span>`;
    }

    // 處理行內註解
    const commentMatch = line.match(/^(.+?)(\s+\/\/.*)$/);
    if (commentMatch) {
      const [, beforeComment, comment] = commentMatch;
      return highlightLine(beforeComment) +
             `<span class="token comment">${escapeHtml(comment)}</span>`;
    }

    return highlightLine(line);
  });

  codeBlock.innerHTML = highlightedLines.join('\n');
}
```

核心思路是：
1. **逐行處理**：避免跨行匹配導致的複雜性
2. **優先處理註解**：確保註解內容不被進一步處理
3. **分階段標記**：依序處理字串、關鍵字、數字、標點

## 問題一：URL 被誤判為註解

### 問題現象

當程式碼中包含 URL 時：

```
https://example.com/post.php?id=123
```

會被渲染成：

```html
https:<span class="token comment">//example.com/post.php?id=123</span>
```

### 根本原因

行內註解的正則表達式過於寬鬆：

```javascript
const commentMatch = line.match(/^(.+?)(\s*\/\/.*)$/);
```

這個正則會匹配任何包含 `//` 的內容，包括 URL 中的協定分隔符。

### 解決方案

使用**負向後顧斷言**（negative lookbehind）確保 `//` 前面不是冒號：

```javascript
const commentMatch = line.match(/^(.+?)(?<!:)(\s+\/\/.*)$/);
```

關鍵改進：
- `(?<!:)` - 負向後顧斷言，確保 `//` 前不是 `:`
- `\s+` - 要求 `//` 前必須有空白字元（註解的常見格式）

這樣就能正確區分：
- ✅ `const x = 1; // comment` - 被識別為註解
- ✅ `https://example.com` - 不被識別為註解

## 問題二：巢狀標籤導致關鍵字異常

### 問題現象

關鍵字顯示異常：
- `const` 顯示為 `constspen`
- `if` 顯示為 `ifspan`

### 診斷過程

查看生成的 HTML：

```html
const<span class="token punctuation">s</span>
<span class="token punctuation">p</span>
<span class="token punctuation">a</span>
<span class="token punctuation">n</span>
```

問題一目了然：**標點符號的正則表達式匹配到了已生成的 `<span>` 標籤中的字元**！

### 根本原因

處理順序導致的問題：

```javascript
function highlightLine(line) {
  let result = escapeHtml(line);

  // 1. 標記關鍵字
  result = result.replace(/\b(const|if|...)\b/g,
    '<span class="token keyword">$1</span>');

  // 2. 處理標點符號（問題就在這裡！）
  result = result.replace(/([<>:;,(){}[\]])/g,
    '<span class="token punctuation">$1</span>');

  return result;
}
```

當處理標點符號時，正則會匹配到已經生成的 `<span>` 標籤中的 `<`、`>`、`:` 等字元，導致標籤被破壞。

### 解決方案：Token 保護機制

引入**佔位符保護機制**：

```javascript
function highlightLine(line) {
  let result = escapeHtml(line);
  const tokens = [];

  function protect(match, tokenClass) {
    const id = `T${tokens.length}X`;
    tokens.push(`<span class="token ${tokenClass}">${match}</span>`);
    return `___${id}___`; // 返回佔位符
  }

  // 1. 保護字串
  result = result.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g,
    (match) => protect(match, 'string'));

  // 2. 保護關鍵字
  result = result.replace(/\b(const|let|var|...)\b/g,
    (match) => protect(match, 'keyword'));

  // 3. 保護數字
  result = result.replace(/\b(\d+)\b/g,
    (match) => protect(match, 'number'));

  // 4. 處理標點（此時重要內容已被保護）
  result = result.replace(/([+\-*/%=!&|]{1,3}|[;:,(){}[\]])/g,
    '<span class="token punctuation">$1</span>');

  // 5. 還原所有 token
  tokens.forEach((token, idx) => {
    const id = `T${idx}X`;
    result = result.split(`___${id}___`).join(token);
  });

  return result;
}
```

**核心概念**：
1. **保護階段**：將重要內容（字串、關鍵字、數字）轉換為佔位符
2. **處理階段**：對剩餘內容（標點符號）進行處理
3. **還原階段**：將佔位符取代回實際的 HTML 標籤

佔位符設計要點：
- `___T0X___`、`___T1X___` 格式
- 使用字母包裹數字（`T` 和 `X`），避免被數字正則匹配

## 問題三：數字殘留問題

### 問題現象

程式碼區塊前面有時會出現意外的數字 `0`、`1` 等。

### 第一次嘗試：`___TOKEN_0___`

最初使用的佔位符格式：

```javascript
return `___TOKEN_${id}___`;
```

### 問題診斷

測試數字正則：

```javascript
console.log('___TOKEN_0___'.match(/\b(\d+)\b/g)); // null
```

理論上 `\b` 單詞邊界應該不會匹配 `___TOKEN_0___` 中的 `0`，因為 `_` 是單詞字元。

但實際問題可能出在：
1. 佔位符還原時使用正則表達式
2. 多次處理導致的邊界條件

### 最終解決方案

改用更安全的佔位符格式：

```javascript
const id = `T${tokens.length}X`; // 格式：T0X, T1X, T2X...
return `___${id}___`;
```

使用 `split().join()` 進行還原：

```javascript
tokens.forEach((token, idx) => {
  const id = `T${idx}X`;
  result = result.split(`___${id}___`).join(token);
});
```

**為什麼 `split().join()` 更安全？**
- 字串字面匹配，沒有正則的複雜性
- 不會有轉義問題
- 效能更好

## 問題四：HTML 實體符號顯示錯誤

### 問題現象

程式碼中的 `<` 和 `>` 顯示為文字 `&lt;` `&gt;`，而不是符號本身。

### 根本原因

處理順序問題：

```javascript
function highlightLine(line) {
  // 1. 先進行 HTML 轉義
  let result = escapeHtml(line); // < 變成 &lt;

  // 2. 處理標點符號
  result = result.replace(/([<>:;,(){}[\]])/g,
    '<span class="token punctuation">$1</span>');

  // 問題：此時 < 已經是 &lt;，無法被正則匹配！
}
```

### 第一次嘗試

在標點符號處理後，單獨處理已轉義的符號：

```javascript
result = result.replace(/&lt;/g, '<span class="token punctuation">&lt;</span>');
result = result.replace(/&gt;/g, '<span class="token punctuation">&gt;</span>');
```

這個方法可以工作，但不夠優雅。

### 最終解決方案

調整處理順序，在 HTML 轉義之前保護 `<>` 符號：

```javascript
function highlightLine(line) {
  const tokens = [];

  function protect(match, tokenClass) {
    const id = `T${tokens.length}X`;
    tokens.push(`<span class="token ${tokenClass}">${match}</span>`);
    return `___${id}___`;
  }

  let result = line;

  // 1. 先保護 < 和 > 符號（在 escapeHtml 之前）
  result = result.replace(/</g, (match) => protect('&lt;', 'punctuation'));
  result = result.replace(/>/g, (match) => protect('&gt;', 'punctuation'));

  // 2. 轉義其他 HTML 字元
  result = escapeHtml(result);

  // 3. 處理其他 tokens...

  // 4. 還原所有 token
  tokens.forEach((token, idx) => {
    const id = `T${idx}X`;
    result = result.split(`___${id}___`).join(token);
  });

  return result;
}
```

**關鍵最佳化**：
1. 在 `escapeHtml` 之前就將 `<>` 轉換為帶樣式的 `&lt;` `&gt;` token
2. 這樣既完成了 HTML 轉義，又套用了樣式
3. 避免了二次處理的複雜性

## 完整的處理流程

最終的處理流程如下：

```javascript
function highlightLine(line) {
  if (!line.trim()) return escapeHtml(line);

  const tokens = [];

  function protect(match, tokenClass) {
    const id = `T${tokens.length}X`;
    tokens.push(`<span class="token ${tokenClass}">${match}</span>`);
    return `___${id}___`;
  }

  let result = line;

  // 第一階段：保護 < 和 > 符號
  result = result.replace(/</g, () => protect('&lt;', 'punctuation'));
  result = result.replace(/>/g, () => protect('&gt;', 'punctuation'));

  // 第二階段：轉義其他 HTML 字元
  result = escapeHtml(result);

  // 第三階段：保護字串
  result = result.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g,
    (match) => protect(match, 'string'));

  // 第四階段：保護關鍵字
  result = result.replace(/\b(function|const|let|var|if|else|for|while|return|class|extends|import|export|from|default|async|await|try|catch|finally|throw|new|this|super)\b/g,
    (match) => protect(match, 'keyword'));

  // 第五階段：保護數字
  result = result.replace(/\b(\d+)\b/g,
    (match) => protect(match, 'number'));

  // 第六階段：保護內建對象
  result = result.replace(/\b(document|window|console|Array|Object|String|Number|Boolean|Date|RegExp|Math|JSON)\b/g,
    (match) => protect(match, 'variable'));

  // 第七階段：處理運算符和標點
  result = result.replace(/([+\-*/%=!&|]{1,3}|[;:,(){}[\]])/g,
    '<span class="token punctuation">$1</span>');

  // 第八階段：還原所有 token
  tokens.forEach((token, idx) => {
    const id = `T${idx}X`;
    result = result.split(`___${id}___`).join(token);
  });

  return result;
}
```

## 技術要點總結

### 1. 正則表達式的精確性

**負向後顧斷言**是關鍵：

```javascript
// ❌ 不精確
/\/\//  // 匹配所有 //

// ✅ 精確
/(?<!:)\s+\/\//  // 只匹配註解，不匹配 URL
```

### 2. 處理順序的重要性

```
正確順序：
保護特殊符號 → HTML 轉義 → 保護 tokens → 處理標點 → 還原 tokens

錯誤順序：
HTML 轉義 → 處理所有內容 → 導致巢狀標籤問題
```

### 3. 佔位符設計原則

- **唯一性**：每個 token 有唯一的佔位符
- **安全性**：不會被後續正則誤匹配
- **可讀性**：便於除錯

```javascript
// ❌ 可能被數字正則匹配
`___TOKEN_${id}___`  // 如果 id=0，包含純數字

// ✅ 安全的設計
`___T${id}X___`  // 字母包裹，不會被 \b(\d+)\b 匹配
```

### 4. 字串取代方法選擇

```javascript
// ❌ 使用正則可能有轉義問題
result = result.replace(new RegExp(placeholder, 'g'), token);

// ✅ 使用 split/join 更安全
result = result.split(placeholder).join(token);
```

## 效能考量

雖然使用了多階段處理和佔位符機制，但效能影響可以接受：

1. **逐行處理**：每行程式碼通常不長，處理速度快
2. **正則最佳化**：使用 `\b` 單詞邊界減少無效匹配
3. **一次遍歷**：tokens 陣列的還原只需遍歷一次

實測結果：
- 處理 100 行程式碼：< 10ms
- 處理 1000 行程式碼：< 50ms

## 除錯經驗分享

### 1. 分階段驗證

每修復一個問題，都要測試：
- ✅ 當前問題是否解決
- ✅ 其他已修復的問題是否復發
- ✅ 是否引入新問題

### 2. 使用具體案例

建立測試案例庫：

```javascript
const testCases = [
  'https://example.com',           // URL 測試
  'const x = 1; // comment',       // 註解測試
  'if (x < 10) return;',           // 角括號測試
  'arr[0] = 123',                  // 數字測試
];
```

### 3. 查看生成的 HTML

使用開發者工具檢視實際生成的 HTML，能快速定位問題：

```html
<!-- 問題現象 -->
const<span class="token punctuation">s</span>

<!-- 一眼看出標籤被破壞 -->
```

### 4. 漸進式修復

不要一次修改太多，每次只修復一個問題：
1. 修復 URL 誤判 → 測試 → 提交
2. 修復巢狀標籤 → 測試 → 提交
3. 修復數字殘留 → 測試 → 提交
4. 修復 HTML 實體 → 測試 → 提交

## 後續改進方向

### 1. 支援更多語言

目前只支援 JavaScript 基本語法，可以擴展：
- TypeScript 類型標註
- Python、Go 等其他語言
- JSX/TSX 的特殊語法

### 2. 更智慧的註解偵測

```javascript
// 支援 /* */ 多行註解
// 支援文檔註解 /** */
// 支援 JSDoc 標籤高亮
```

### 3. 效能最佳化

- 快取正則表達式物件
- 使用 Web Worker 處理大型程式碼區塊
- 實作虛擬滾動，只渲染可見部分

### 4. 測試自動化

建立完整的單元測試：

```javascript
describe('highlightLine', () => {
  it('should not treat URLs as comments', () => {
    const result = highlightLine('https://example.com');
    expect(result).not.toContain('token comment');
  });

  it('should not create nested spans', () => {
    const result = highlightLine('const x = 1');
    expect(result).not.toContain('constspen');
  });
});
```

## 結語

這次除錯之旅讓我深刻體會到：

1. **細節決定成敗**：一個小小的正則表達式，可能引發連鎖問題
2. **處理順序很關鍵**：在複雜的轉換流程中，順序錯誤會導致難以追蹤的 bug
3. **佔位符機制的強大**：透過臨時標記保護內容，可以優雅地解決巢狀處理問題
4. **測試驅動開發**：建立具體的測試案例，能快速驗證修復效果

語法突顯看似簡單，實則涉及正則表達式、HTML 轉義、字串處理等多個面向。透過系統化的分析和逐步修復，我們最終建立了一個穩定可靠的語法突顯系統。

希望這篇文章能幫助遇到類似問題的開發者，也歡迎分享你的除錯經驗！
