const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

// 樣式表內嵌進四個根目錄 HTML 的 <head>，不用 <link>（原因見 AGENTS.md「CSS 內嵌在 HTML」）。
// 原檔照舊改 assets/css/*.css 與 assets/styles.css，執行 npm run build:assets 會重新寫進下面四個 HTML
// 兩組標記之間；文章頁由 generate-redirects.js 從 post.html 複製，會一起帶過去。
// validate-content.js 也用這裡比對 HTML 裡的內容是不是最新的。

const ROOT_DIR = path.join(__dirname, '..');
const INLINE_CSS_PAGES = ['index.html', 'post.html', 'about.html', 'gadgets.html'];

// 兩塊分開放，維持原本 <link> 的位置與 cascade 順序：
// CRITICAL 在各頁的關鍵 <style> 前面，SITE 在後面（各頁關鍵 CSS 與 styles.css 有同權重的規則，順序不能換）
const INLINE_CSS_BLOCKS = [
  { name: 'CRITICAL', sources: ['assets/css/fonts.css', 'assets/css/critical-shared.css'], level: 1 },
  { name: 'SITE', sources: ['assets/styles.css'], level: 2 },
];

function markersFor(name) {
  return {
    start: `<!-- INLINE_CSS_${name}_START -->`,
    end: `<!-- INLINE_CSS_${name}_END -->`,
  };
}

function minify(source, level) {
  const result = new CleanCSS({ level }).minify(source);
  if (result.errors.length > 0) {
    throw new Error(result.errors.join('\n'));
  }
  return result.styles;
}

// 回傳 { CRITICAL: '...', SITE: '...' }。SITE 跟 assets/styles.min.css 是同一份壓縮結果
function buildInlineCssBlocks() {
  const blocks = {};
  for (const { name, sources, level } of INLINE_CSS_BLOCKS) {
    const source = sources
      .map((relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8'))
      .join('\n');
    const css = minify(source, level);
    if (/<\/style/i.test(css)) {
      throw new Error(`${sources.join('、')} 含有 </style，不能內嵌`);
    }
    blocks[name] = css;
  }
  return blocks;
}

function findBlock(html, name, label) {
  const { start, end } = markersFor(name);
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex || html.indexOf(start, startIndex + 1) !== -1) {
    throw new Error(`${label} 找不到唯一一組 ${start} … ${end}`);
  }
  return { contentStart: startIndex + start.length, contentEnd: endIndex };
}

function renderBlock(css) {
  return `\n  <style>${css}</style>\n  `;
}

// 把 blocks 寫進 html 的標記之間（用 slice，不用 String.replace，CSS 裡的 $ 不會被當成替換符號）
function applyInlineCss(html, blocks, label) {
  let output = html;
  for (const { name } of INLINE_CSS_BLOCKS) {
    const { contentStart, contentEnd } = findBlock(output, name, label);
    output = output.slice(0, contentStart) + renderBlock(blocks[name]) + output.slice(contentEnd);
  }
  return output;
}

// 回傳沒同步的頁面清單
function findStaleInlineCssPages(blocks = buildInlineCssBlocks()) {
  const stale = [];
  for (const page of INLINE_CSS_PAGES) {
    const html = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
    if (applyInlineCss(html, blocks, page) !== html) {
      stale.push(page);
    }
  }
  return stale;
}

function writeInlineCss(blocks = buildInlineCssBlocks()) {
  for (const page of INLINE_CSS_PAGES) {
    const filePath = path.join(ROOT_DIR, page);
    const html = fs.readFileSync(filePath, 'utf8');
    const output = applyInlineCss(html, blocks, page);
    if (output !== html) {
      fs.writeFileSync(filePath, output, 'utf8');
    }
  }
}

module.exports = {
  INLINE_CSS_PAGES,
  INLINE_CSS_BLOCKS,
  buildInlineCssBlocks,
  findStaleInlineCssPages,
  writeInlineCss,
};
