// 首頁 LATEST 摘要下面接的文章開頭：Markdown 轉成純文字，只取一般段落。
// scripts/generate-redirects.js（靜態首頁）與 assets/main.js（分類、標籤、搜尋換篇時）共用這一份。
// 寫成 CommonJS：Node 端直接 require，瀏覽器端由 esbuild 打包進 main.min.js。

const LEAD_EXCERPT_MAX_CHARS = 1200;

// 段落開頭是這些符號的整段略過：標題、表格、清單、HTML、圖片、分隔線（引用保留，只拿掉 >）
const SKIP_BLOCK = /^(#{1,6}\s|\||[-*+]\s|\d+[.)]\s|<|!\[|(-{3,}|\*{3,}|_{3,})\s*$)/;
// 段落裡夾著清單、表格、標題行的也整段略過（多半是「影響:」加一串清單，只留引導句讀起來不通）
const SKIP_LINE = /^(#{1,6}\s|\||[-*+]\s|\d+[.)]\s|!\[)/;
// Crossing Field 開頭的出處引用（「> 翻譯報導」「> 翻譯整理」加原文、發佈日期）
const CREDIT_QUOTE = /^翻譯(報導|整理)\s*$/;
// Crossing Field 的導言是寫好的開場，放在最前面
const CROSSING_FIELD_LEAD = /<p class="crossing-field-intro__lead">([\s\S]*?)<\/p>/;
const CJK_END = /[　-〿㐀-鿿豈-﫿＀-￯]$/;
const CJK_START = /^[　-〿㐀-鿿豈-﫿＀-￯]/;

function joinText(left, right) {
  if (!left) return right;
  if (!right) return left;
  return CJK_END.test(left) && CJK_START.test(right) ? left + right : `${left} ${right}`;
}

function inlineToText(text) {
  // 行內程式碼先收起來，裡面的 <x.h>、** 之類不當成標記處理
  const codeSpans = [];
  return text
    .replace(/`([^`]*)`/g, (_, code) => `\u0000${codeSpans.push(code) - 1}\u0000`)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
}

function markdownToLeadExcerpt(markdown, maxChars = LEAD_EXCERPT_MAX_CHARS) {
  const source = String(markdown || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*#\s[^\n]*\n/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');

  const introLead = source.match(CROSSING_FIELD_LEAD);
  let excerpt = introLead ? inlineToText(introLead[1].replace(/\s*\n\s*/g, ' ')).trim() : '';
  for (const block of source.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed || SKIP_BLOCK.test(trimmed)) continue;

    // 引用行只拿掉開頭的 >
    const lines = trimmed.split('\n').map((line) => line.trim().replace(/^>\s?/, ''));
    if (CREDIT_QUOTE.test(lines[0]) || lines.some((line) => SKIP_LINE.test(line))) continue;

    const text = lines
      .map(inlineToText)
      .filter(Boolean)
      .reduce(joinText, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!text) continue;

    excerpt = joinText(excerpt, text);
    if (excerpt.length >= maxChars) break;
  }

  return Array.from(excerpt).slice(0, maxChars).join('');
}

module.exports = { LEAD_EXCERPT_MAX_CHARS, markdownToLeadExcerpt };
