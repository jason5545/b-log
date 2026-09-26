const fs = require('fs');
const path = require('path');
const marked = require('../assets/marked.min.js');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_PATH = path.join(ROOT_DIR, 'data/posts.json');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'post.html');
const HOMEPAGE_PATH = path.join(ROOT_DIR, 'index.html');
// 頁尾年份要跟著產生時間走的根目錄頁面（文章靜態頁另外在產生時替換）
const FOOTER_YEAR_PAGES = ['index.html', 'post.html', 'about.html', 'gadgets.html'];
const FOOTER_YEAR_PATTERN = /(<span class="foot__year" data-footer-year>)\d{4}(<\/span>)/g;
const POSTS_DIR = path.join(ROOT_DIR, 'content/posts');
const SITE_BASE_URL = 'https://b-log.to';
const META_DATE_LOCALE = 'en-US';
const META_DATE_TIME_ZONE = 'Asia/Taipei';
const CLOUDINARY_OG_IMAGE_CONFIG = {
  cloudName: 'dynj7181i',
  backgroundId: 'og-background_cbst7j',
  fontId: 'notosanstc-bold.ttf'
};
const HOME_FEATURED_PRELOAD_START = '<!-- HOME_FEATURED_PRELOAD_START -->';
const HOME_FEATURED_PRELOAD_END = '<!-- HOME_FEATURED_PRELOAD_END -->';
const HOME_FEATURED_START = '<!-- HOME_FEATURED_START -->';
const HOME_FEATURED_END = '<!-- HOME_FEATURED_END -->';
const ARTICLE_TAGS_START = '<!-- ARTICLE_TAGS_START -->';
const ARTICLE_TAGS_END = '<!-- ARTICLE_TAGS_END -->';
const HERO_IMAGE_WIDTHS = [480, 828, 1200];
// 首頁 LATEST：760px 以下封面滿版，760–960px 約半欄，1216px 以下約 400px，更寬時跟著左欄變寬（約 36vw）
const HOME_HERO_SIZES = '(max-width: 760px) calc(100vw - 32px), (max-width: 960px) 48vw, (max-width: 1216px) 400px, 36vw';
// 文章頁封面：手機扣掉左右 16px；1216px 以下欄寬約 736px；更寬時文章欄最多 52.875rem（2560px 約 1060px）
const ARTICLE_HERO_SIZES = '(max-width: 800px) calc(100vw - 32px), (max-width: 1216px) 736px, 1060px';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// LiSA 的兩個分類：洋紅只給她，旁邊直接寫出這個分類是什麼
const HER_CATEGORY_HINTS = {
  'シルシ': '我和她的事',
  'Crossing Field': '她說的話',
};
// 分類不是她的、但 Jason 9/26 確認算她的文章。accentColor 一律顯示洋紅。
// 這份白名單在 main.js、generate-redirects.js、validate-content.js 三處要一致（validate 會比對）
const HER_POST_SLUGS = ['songshan-airport-jpop-parallel-world', 'birthday-avatar-ai-barrier'];
const STATUS_SECTIONS = {
  resolved: { key: '已修', className: 'ok' },
  procedures: { key: '程序', className: 'proc' },
  inop: { title: 'INOP SYS' },
  open: { title: '未定' },
};

// 從集中式設定檔載入分類映射
const categoriesConfigPath = path.join(ROOT_DIR, 'config/categories.json');
const categoriesConfig = JSON.parse(fs.readFileSync(categoriesConfigPath, 'utf8'));
const categoryMapping = categoriesConfig.categoryMapping;
const knownCategorySlugs = new Set(Object.values(categoryMapping));

// 產生時的年份（台北時間），前端再用當下年份覆寫
const FOOTER_YEAR = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  timeZone: META_DATE_TIME_ZONE,
}).format(new Date());

function applyFooterYear(html) {
  return html.replace(FOOTER_YEAR_PATTERN, (_, open, close) => `${open}${FOOTER_YEAR}${close}`);
}

function syncFooterYearPages() {
  for (const page of FOOTER_YEAR_PAGES) {
    const filePath = path.join(ROOT_DIR, page);
    const html = fs.readFileSync(filePath, 'utf8');
    if (html.search(FOOTER_YEAR_PATTERN) === -1) {
      throw new Error(`${page} 找不到頁尾年份 data-footer-year`);
    }
    const updated = applyFooterYear(html);
    if (updated !== html) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`📅 已更新 ${page} 頁尾年份：${FOOTER_YEAR}`);
    }
  }
}

// post.html 範本在 syncGeneratedContent() 裡先同步年份再讀
let postTemplate = '';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// 去掉每行行尾空白，但 <pre> 裡的行原樣保留（程式碼的行尾空白是內容的一部分）
function stripTrailingWhitespace(html) {
  let inPre = false;
  return html
    .split('\n')
    .map((line) => {
      const startsInPre = inPre;
      for (const match of line.matchAll(/<(\/?)pre\b/gi)) {
        inPre = match[1] !== '/';
      }
      return startsInPre || inPre ? line : line.trimEnd();
    })
    .join('\n');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function imageUrlToPath(imageUrl) {
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) return null;
  return path.join(ROOT_DIR, imageUrl.replace(/^\//, ''));
}

function buildResponsiveImageSrcset(imageUrl) {
  const imagePath = imageUrlToPath(imageUrl);
  if (!imagePath) return '';

  const parsed = path.parse(imagePath);
  return HERO_IMAGE_WIDTHS
    .map((width) => {
      const variantPath = path.join(parsed.dir, `${parsed.name}-${width}w${parsed.ext}`);
      if (!fs.existsSync(variantPath)) return null;
      const variantUrl = imageUrl.replace(/(\.[^/.]+)$/, `-${width}w$1`);
      return `${variantUrl} ${width}w`;
    })
    .filter(Boolean)
    .join(', ');
}

function buildHeroImageAttributes(coverImage, sizes, decoding = 'async') {
  const safeCoverImage = escapeHtml(coverImage);
  const srcset = buildResponsiveImageSrcset(coverImage);
  const srcsetAttr = srcset ? ` srcset="${escapeHtml(srcset)}" sizes="${escapeHtml(sizes)}"` : '';
  return `src="${safeCoverImage}"${srcsetAttr} alt="" aria-hidden="true" fetchpriority="high" decoding="${decoding}"`;
}

function buildHeroPreload(coverImage, sizes = ARTICLE_HERO_SIZES) {
  if (!coverImage) return '';

  const safeCoverImage = escapeHtml(coverImage);
  const srcset = buildResponsiveImageSrcset(coverImage);
  const responsiveAttrs = srcset
    ? ` imagesrcset="${escapeHtml(srcset)}" imagesizes="${escapeHtml(sizes)}"`
    : '';

  return `  <link rel="preload" as="image" href="${safeCoverImage}"${responsiveAttrs} fetchpriority="high">\n`;
}

function buildHeroMarkup(post, hideCover = false) {
  if (!post.coverImage || hideCover) {
    return '<figure id="post-hero" class="post__cover" hidden></figure>';
  }

  return `<figure id="post-hero" class="post__cover"><img class="post__cover-img" ${buildHeroImageAttributes(post.coverImage, ARTICLE_HERO_SIZES)}></figure>`;
}

// 範本裡的 placeholder 一定要存在，找不到就直接失敗，避免產出半套頁面
function replaceRequired(html, placeholder, replacement) {
  if (!html.includes(placeholder)) {
    throw new Error(`post.html 找不到 placeholder：${placeholder}`);
  }
  return html.replace(placeholder, () => replacement);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceMarkedBlock(html, startMarker, endMarker, replacement = '') {
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`);
  if (!pattern.test(html)) {
    throw new Error(`找不到首頁 marker：${startMarker}`);
  }

  const block = replacement ? `${startMarker}\n${replacement}\n${endMarker}` : `${startMarker}\n${endMarker}`;
  return html.replace(pattern, block);
}

function extractMetaPropertyContent(html, property) {
  const pattern = new RegExp(`<meta\\s+property="${escapeRegExp(property)}"\\s+content="([^"]*)"`);
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`找不到 meta property：${property}`);
  }

  return match[1];
}

function replaceMetaPropertyContent(html, property, content) {
  const pattern = new RegExp(`(<meta\\s+property="${escapeRegExp(property)}"\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) {
    throw new Error(`找不到 meta property：${property}`);
  }

  return html.replace(pattern, (_, prefix, suffix) => `${prefix}${escapeHtml(content)}${suffix}`);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ECAM 日期格式：24SEP26（台北時間）
function formatEcamDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat(META_DATE_LOCALE, {
    year: '2-digit',
    month: 'numeric',
    day: '2-digit',
    timeZone: META_DATE_TIME_ZONE,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  const month = MONTHS[Number.parseInt(get('month'), 10) - 1] || '';
  return `${get('day')}${month}${get('year')}`;
}

function formatReadingTime(post) {
  const value = String(post.readingTime || '').trim();
  return value ? value.toUpperCase() : '';
}

function isHerCategory(category) {
  return Object.prototype.hasOwnProperty.call(HER_CATEGORY_HINTS, category);
}

function isHerPost(post) {
  return isHerCategory(post.category) || HER_POST_SLUGS.includes(post.slug);
}

// accentColor：她的文章一律洋紅 token，其他用存的色碼，沒有就不畫
function resolveAccent(post) {
  if (isHerPost(post)) return 'var(--magenta)';
  const color = String(post.accentColor || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '';
}

// RELATED／LATEST 側欄列（跟 main.js 的 buildSideRow 同一個結構）。
// 靜態輸出，側欄在第一屏時不會因為 JS 補內容而把 LATEST 往下推
function buildSideRowMarkup(post) {
  const accent = resolveAccent(post);
  const styleAttr = accent ? ` style="--row-accent:${escapeHtml(accent)}"` : '';
  const categoryMarkup = post.category
    ? ` · <span${isHerCategory(post.category) ? ' class="her-cat"' : ''}>${escapeHtml(post.category)}</span>`
    : '';
  const audioIndicator = post.hasAudio ? buildAudioIndicatorMarkup() : '';
  return `<li${styleAttr}><a href="${escapeHtml(slugToPath(post.slug, post.category))}"><span class="side-row__meta">${escapeHtml(formatEcamDate(post.publishedAt))}${categoryMarkup}</span><span class="side-row__title">${escapeHtml(post.title || post.slug)}${audioIndicator}</span></a></li>`;
}

// 選文規則跟 main.js 的 renderRelatedPosts 一樣：同分類或有共同標籤，新到舊取 3 篇
function buildRelatedListMarkup(sortedPosts, currentPost) {
  const related = sortedPosts
    .filter((post) => post.slug !== currentPost.slug)
    .filter((post) => {
      if (currentPost.category && post.category && post.category === currentPost.category) return true;
      if (!Array.isArray(currentPost.tags) || !Array.isArray(post.tags)) return false;
      return currentPost.tags.some((tag) => post.tags.includes(tag));
    })
    .slice(0, 3);

  const items = related.length
    ? related.map(buildSideRowMarkup).join('')
    : '<li class="row--empty">More posts arriving soon.</li>';
  return `<ol id="related-list" class="side-list" data-prerendered="true">${items}</ol>`;
}

function buildLatestListMarkup(sortedPosts, currentPost) {
  const latest = sortedPosts.filter((post) => post.slug !== currentPost.slug).slice(0, 3);
  return `<ol id="latest-sidebar" class="side-list" data-prerendered="true">${latest.map(buildSideRowMarkup).join('')}</ol>`;
}

function buildAccentMarkup(post) {
  const accent = resolveAccent(post);
  if (!accent) {
    return '<div id="post-accent" class="post__accent" aria-hidden="true"></div>';
  }
  return `<div id="post-accent" class="post__accent" aria-hidden="true" style="--post-accent:${escapeHtml(accent)}"></div>`;
}

// 去掉 https://b-log.to 與 -480w／-828w／-1200w 後綴，再補上開頭的 /
function normalizeImagePath(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/b-log\.to/i, '')
    .replace(/^(?!\/)/, '/')
    .replace(/-(?:480|828|1200)w(\.[a-z0-9]+)$/i, '$1');
}

// 封面跟內文任一張圖是同一張時，文章頁頂部不放封面，只留內文那張（main.js 同一條規則）
function coverAppearsInBody(coverImage, bodyHtml) {
  if (!coverImage) return false;
  const cover = normalizeImagePath(coverImage);
  for (const match of bodyHtml.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const src = (match[1] ?? match[2] ?? '').replace(/&amp;/g, '&');
    if (normalizeImagePath(src) === cover) return true;
  }
  return false;
}

// 文章 meta 行：24SEP26 · 技術開發 · 5 MIN · JASON CHIEN
function formatStaticMetaParts(post, { includeAuthor = true } = {}) {
  const parts = [];
  const publishedDate = formatEcamDate(post.publishedAt);
  if (publishedDate) {
    parts.push(publishedDate);
  }

  if (post.category) {
    parts.push(post.category);
  }

  const readingTime = formatReadingTime(post);
  if (readingTime) {
    parts.push(readingTime);
  }

  if (includeAuthor && post.author) {
    const author = post.author.toUpperCase();
    parts.push(post.category === 'Crossing Field' ? `${author} 譯` : author);
  }

  const updatedDate = formatEcamDate(post.updatedAt || post.publishedAt);
  if (updatedDate && updatedDate !== publishedDate) {
    parts.push(`UPDATED ${updatedDate}`);
  }

  return parts;
}

function slugToPath(slug, category) {
  const categorySlug = categoryMapping[category] || 'uncategorized';
  return `/${categorySlug}/${slug}/`;
}

function buildAudioIndicatorMarkup(isHero = false) {
  const className = isHero ? 'audio-indicator audio-indicator--hero' : 'audio-indicator';
  return `<span class="${className}" aria-label="有語音版" title="此文章有語音版"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg></span>`;
}

function buildAudioPlayerHTML(audioFile) {
  const safeAudioFile = escapeHtml(audioFile);
  return `<div class="audio-player" data-audio-file="${safeAudioFile}">
  <audio preload="metadata">
    <source src="/content/audio/${safeAudioFile}" type="audio/mp4">
    您的瀏覽器不支援音訊播放。
  </audio>
  <div class="audio-controls">
    <button class="audio-btn play-pause" aria-label="播放/暫停">
      <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
      </svg>
    </button>
    <div class="audio-progress-container">
      <input type="range" class="audio-progress" min="0" max="100" value="0" step="0.1" aria-label="播放進度">
      <div class="audio-time">
        <span class="current-time">0:00</span>
        <span class="duration">0:00</span>
      </div>
      <div class="playlist-info" style="display:none">
        片段 <span class="current-part">1</span> / <span class="total-parts">1</span>
      </div>
    </div>
    <div class="audio-speed">
      <button class="speed-btn" aria-label="播放速度">1.0x</button>
      <div class="speed-menu" style="display:none">
        <button data-speed="0.75">0.75x</button>
        <button data-speed="1.0" class="active">1.0x</button>
        <button data-speed="1.25">1.25x</button>
        <button data-speed="1.5">1.5x</button>
        <button data-speed="2.0">2.0x</button>
      </div>
    </div>
    <div class="audio-volume">
      <button class="volume-btn" aria-label="音量">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
      </button>
      <input type="range" class="volume-slider" min="0" max="100" value="100" aria-label="音量控制">
    </div>
  </div>
  <div class="audio-attribution">
    Powered by <a href="https://notebooklm.google/" target="_blank" rel="noopener noreferrer">NotebookLM</a>. You may check facts.
  </div>
</div>`;
}

function stripMarkdownTitle(markdown) {
  const lines = markdown.split('\n');
  if (lines[0]?.trim().startsWith('#')) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }
  return lines.join('\n');
}

function renderMarkdownForStaticPage(post) {
  const markdownPath = path.join(POSTS_DIR, `${post.slug}.md`);
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`找不到 Markdown 檔案：content/posts/${post.slug}.md`);
  }

  let markdown = stripMarkdownTitle(fs.readFileSync(markdownPath, 'utf8'));
  markdown = markdown.replace(/<!--\s*audio:\s*(.+?)\s*-->/g, (_, audioFile) => buildAudioPlayerHTML(audioFile.trim()));

  let html = marked
    .parse(markdown)
    .replace(/\b(src|srcset)="content\//g, '$1="/content/');

  if (post.category === 'Crossing Field') {
    html = buildCrossingFieldSource(html);
  }
  if (post.category === 'シルシ') {
    html = markLisaQuoteCitations(html);
  }

  return html;
}

function buildArticleMetaMarkup(post) {
  return escapeHtml(formatStaticMetaParts(post).join(' · '));
}

function buildArticleTagsMarkup(tags = []) {
  if (!Array.isArray(tags) || !tags.length) {
    return '<div id="post-tags" class="tags" hidden></div>';
  }

  const tagMarkup = tags
    .filter(Boolean)
    .map((tag) => `<a href="/?tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`)
    .join('');

  return `<div id="post-tags" class="tags"><span class="meta">TAGS</span>${tagMarkup}</div>`;
}

function buildBreadcrumbMarkup(post) {
  if (!post.category) {
    return '<span id="breadcrumb-current"></span>';
  }

  const herClass = isHerCategory(post.category) ? ' class="her-cat"' : '';
  return `<span id="breadcrumb-current"><a href="/?category=${encodeURIComponent(post.category)}"${herClass}>${escapeHtml(post.category)}</a></span>`;
}

function buildCatlineMarkup(post) {
  if (!isHerCategory(post.category)) {
    return '<p id="post-catline" class="catline" hidden></p>';
  }

  return `<p id="post-catline" class="catline">${escapeHtml(post.category.toUpperCase())} <span>${escapeHtml(HER_CATEGORY_HINTS[post.category])}</span></p>`;
}

// STATUS 面板：posts.json 的選填欄位 status
function buildStatusInnerMarkup(status) {
  if (!isPlainObject(status)) return '';

  const listItems = (key) => (Array.isArray(status[key]) ? status[key].filter((item) => typeof item === 'string' && item.trim()) : []);
  const leftItems = ['resolved', 'procedures']
    .flatMap((key) => listItems(key).map((item) => {
      const { key: label, className } = STATUS_SECTIONS[key];
      return `<li class="${className}"><span class="k">${label}</span>${escapeHtml(item)}</li>`;
    }));
  const rightGroups = ['inop', 'open']
    .map((key) => {
      const items = listItems(key);
      if (!items.length) return '';
      const listMarkup = items.map((item) => `<li class="caut">${escapeHtml(item)}</li>`).join('');
      return `<h3 class="status__sub">${STATUS_SECTIONS[key].title}</h3><ul>${listMarkup}</ul>`;
    })
    .filter(Boolean);

  if (!leftItems.length && !rightGroups.length) return '';

  const columns = [];
  if (leftItems.length) columns.push(`<ul>${leftItems.join('')}</ul>`);
  if (rightGroups.length) columns.push(`<div>${rightGroups.join('')}</div>`);
  const gridClass = columns.length === 1 ? 'status__grid status__grid--single' : 'status__grid';

  return `<h2 class="status__title" id="status-title">STATUS</h2><div class="${gridClass}">${columns.join('')}</div>`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function buildStatusMarkup(post) {
  const inner = buildStatusInnerMarkup(post.status);
  if (!inner) {
    return '<section id="post-status" class="status" aria-labelledby="status-title" hidden></section>';
  }

  return `<section id="post-status" class="status" aria-labelledby="status-title">${inner}</section>`;
}

// Crossing Field：開頭的「翻譯報導／翻譯整理」引用改成原文出處資料表
function splitSourceRow(paragraphHtml) {
  const leadText = paragraphHtml.split('<')[0];
  let separatorIndex = leadText.indexOf('：');
  if (separatorIndex === -1) separatorIndex = leadText.indexOf('／');
  if (separatorIndex <= 0 || separatorIndex > 12) return null;

  const key = leadText.slice(0, separatorIndex).trim();
  const value = paragraphHtml.slice(separatorIndex + 1).trim().replace(/<\/?code>/g, '');
  if (!key || !value) return null;
  return { key, value };
}

function buildCrossingFieldSource(html) {
  return html.replace(/<blockquote>\s*<p>(翻譯報導|翻譯整理)<\/p>([\s\S]*?)<\/blockquote>/, (match, kind, rest) => {
    if (rest.replace(/<p>[\s\S]*?<\/p>/g, '').trim()) return match;

    const rows = [];
    for (const paragraph of rest.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
      const row = splitSourceRow(paragraph[1].trim());
      if (!row) return match;
      rows.push(row);
    }
    if (!rows.length) return match;

    const rowMarkup = rows.map(({ key, value }) => `<dt>${key}</dt><dd>${value}</dd>`).join('');
    return `<div class="cf-source" role="group" aria-label="${kind}"><p class="cf-source__kind">${kind}</p><dl>${rowMarkup}</dl></div>`;
  });
}

// シルシ：引用的最後一行以「——」開頭時，是她的歌詞出處
function markLisaQuoteCitations(html) {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, inner) => {
    const lastParagraph = inner.match(/^([\s\S]*)<p>([\s\S]*?)<\/p>(\s*)$/);
    if (!lastParagraph) return match;

    const [, before, paragraph, trailing] = lastParagraph;
    const lines = paragraph.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine.startsWith('——')) return match;

    const remaining = lines.slice(0, -1).join('\n').trim();
    const paragraphMarkup = remaining ? `<p>${remaining}</p>\n` : '';
    return `<blockquote>${before}${paragraphMarkup}<cite class="her-cite">${lastLine}</cite>${trailing}</blockquote>`;
  });
}

function buildStructuredData(post, fullUrl, imageUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title || post.slug || 'Untitled',
    description: post.summary || '',
    author: {
      '@type': 'Person',
      name: post.author || 'Jason Chien',
    },
    publisher: {
      '@type': 'Person',
      name: 'Jason Chien',
    },
    datePublished: post.publishedAt || '',
    dateModified: post.updatedAt || post.publishedAt || '',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': fullUrl,
    },
    url: fullUrl,
    inLanguage: 'zh-Hant-TW',
  };

  if (imageUrl) {
    schema.image = [imageUrl];
  }

  if (Array.isArray(post.tags) && post.tags.length) {
    schema.keywords = post.tags.join(', ');
  }

  if (post.category) {
    schema.articleSection = post.category;
  }

  return `  <script type="application/ld+json">${escapeJsonForScript(schema)}</script>\n`;
}

function buildCloudinaryOgImage(title) {
  const encodedTitle = encodeURIComponent(title || 'Untitled');
  return (
    `https://res.cloudinary.com/${CLOUDINARY_OG_IMAGE_CONFIG.cloudName}/image/upload/` +
    'c_fill,w_1200,h_630/' +
    'co_rgb:ffffff,' +
    `l_text:${CLOUDINARY_OG_IMAGE_CONFIG.fontId}_60_center:${encodedTitle},w_1000,c_fit/` +
    'fl_layer_apply,g_center/' +
    `${CLOUDINARY_OG_IMAGE_CONFIG.backgroundId}.png`
  );
}

function buildArticleTagMetaBlock(tags = []) {
  if (!Array.isArray(tags) || !tags.length) {
    return '';
  }

  return tags
    .filter(Boolean)
    .map((tag) => `  <meta property="article:tag" content="${escapeHtml(tag)}">`)
    .join('\n');
}

function buildHomepageHeroMedia(post) {
  if (post.coverImage) {
    return `          <div class="lead__media" id="hero-media"><img class="lead__img" ${buildHeroImageAttributes(post.coverImage, HOME_HERO_SIZES, 'sync')}></div>`;
  }
  // 無封面：不輸出 media 區塊，LATEST 改用純文字版型
  return '';
}

function buildHomepageFeaturedSection(post) {
  if (!post) {
    return `      <section id="featured" class="lead lead--text-only" aria-labelledby="lead-label" hidden data-featured-slug="" data-featured-cover="">
        <h2 class="label" id="lead-label">LATEST <span>最新一篇</span></h2>
        <a class="lead__link" id="hero-link" href="#">
          <div class="lead__text">
            <p class="meta" id="hero-meta"></p>
            <h3 class="lead__title" id="hero-title"></h3>
            <p class="lead__sum" id="hero-summary"></p>
          </div>
        </a>
      </section>`;
  }

  const safeSlug = escapeHtml(post.slug || '');
  const safeCoverImage = escapeHtml(post.coverImage || '');
  const safeTitle = escapeHtml(post.title || post.slug || 'Untitled');
  const safeSummary = escapeHtml(post.summary || '');
  const safeMeta = escapeHtml(formatStaticMetaParts(post, { includeAuthor: false }).join(' · '));
  const safePath = escapeHtml(slugToPath(post.slug, post.category));
  const audioIndicator = post.hasAudio ? buildAudioIndicatorMarkup(true) : '';
  const sectionClass = post.coverImage ? 'lead' : 'lead lead--text-only';
  const mediaBlock = post.coverImage ? `\n${buildHomepageHeroMedia(post)}` : '';

  return `      <section id="featured" class="${sectionClass}" aria-labelledby="lead-label" data-featured-slug="${safeSlug}" data-featured-cover="${safeCoverImage}">
        <h2 class="label" id="lead-label">LATEST <span>最新一篇</span></h2>
        <a class="lead__link" id="hero-link" href="${safePath}">
          <div class="lead__text">
            <p class="meta" id="hero-meta">${safeMeta}</p>
            <h3 class="lead__title" id="hero-title">${safeTitle}${audioIndicator}</h3>
            <p class="lead__sum" id="hero-summary">${safeSummary}</p>
          </div>${mediaBlock}
        </a>
      </section>`;
}

function syncHomepage(posts) {
  const sortedPosts = sortPostsByPublishedAt(posts);
  const featuredPost = sortedPosts[0] || null;
  const homepageTemplate = fs.readFileSync(HOMEPAGE_PATH, 'utf8');
  const homepageOgTitle = extractMetaPropertyContent(homepageTemplate, 'og:title');
  const homepageOgImage = buildCloudinaryOgImage(homepageOgTitle);

  let updatedHomepage = replaceMarkedBlock(
    homepageTemplate,
    HOME_FEATURED_PRELOAD_START,
    HOME_FEATURED_PRELOAD_END,
    buildHeroPreload(featuredPost?.coverImage || '', HOME_HERO_SIZES).trimEnd()
  );

  updatedHomepage = replaceMarkedBlock(
    updatedHomepage,
    HOME_FEATURED_START,
    HOME_FEATURED_END,
    buildHomepageFeaturedSection(featuredPost)
  );

  updatedHomepage = replaceMetaPropertyContent(updatedHomepage, 'og:image', homepageOgImage);
  updatedHomepage = replaceMetaPropertyContent(updatedHomepage, 'twitter:image', homepageOgImage);

  if (updatedHomepage !== homepageTemplate) {
    fs.writeFileSync(HOMEPAGE_PATH, updatedHomepage, 'utf8');
    console.log('🏠 已同步首頁 featured 區塊');
  } else {
    console.log('🏠 首頁 featured 區塊已是最新');
  }
}

function removeEmptyDirsUpward(startDir, stopDir) {
  let current = startDir;
  while (current.startsWith(stopDir) && current !== stopDir) {
    if (!fs.existsSync(current)) break;

    const entries = fs.readdirSync(current);
    if (entries.length > 0) break;

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function isRedirectPage(html) {
  if (!html) return false;
  return (
    html.includes('meta http-equiv="refresh"') ||
    html.includes('window.location.replace(') ||
    html.includes('meta name="robots" content="noindex"')
  );
}

function listGeneratedIndexFiles() {
  const files = [];

  for (const categorySlug of knownCategorySlugs) {
    const categoryDir = path.join(ROOT_DIR, categorySlug);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const indexPath = path.join(categoryDir, entry.name, 'index.html');
      if (!fs.existsSync(indexPath)) continue;

      files.push({
        categorySlug,
        slug: entry.name,
        indexPath,
      });
    }
  }

  return files;
}

// 生成完整的文章頁面 HTML（複製 post.html 結構）
function generatePostHTML(post, sortedPosts) {
  const {
    slug,
    title,
    summary,
    category,
    coverImage,
    publishedAt,
    updatedAt,
    tags,
  } = post;

  const categorySlug = categoryMapping[category];
  const safeTitle = escapeHtml(title || slug || 'Untitled');
  const safeSummary = escapeHtml(summary || '');
  const safeCategory = escapeHtml(category || '');
  const categoryThemeAttr = categorySlug ? ` data-category-theme="${escapeHtml(categorySlug)}"` : '';

  // 調整相對路徑，因為文章頁面在 /category/slug/ 目錄下
  // 需要往上兩層才能到根目錄
  let html = postTemplate
    .replace(/href="assets\//g, 'href="../../assets/')
    .replace(/src="assets\//g, 'src="../../assets/')
    .replace(/href="\.\/"/g, 'href="../../"')
    .replace(/href="about\.html"/g, 'href="../../about.html"')
    .replace(/href="gadgets\.html"/g, 'href="../../gadgets.html"')
    .replace(/href="feed\.json"/g, 'href="../../feed.json"');

  // 生成完整的 URL
  const fullUrl = `${SITE_BASE_URL}/${categorySlug}/${slug}/`;
  const staticPostContent = renderMarkdownForStaticPage(post);
  const hideCover = coverAppearsInBody(coverImage, staticPostContent);
  const heroPreload = hideCover ? '' : buildHeroPreload(coverImage);
  const heroMarkup = buildHeroMarkup(post, hideCover);
  const staticMetaMarkup = buildArticleMetaMarkup(post);
  const staticTagsMarkup = buildArticleTagsMarkup(tags);

  // 生成 Open Graph 圖片 URL
  let ogImageUrl;
  if (coverImage) {
    const normalizedCoverImage = coverImage.startsWith('/') ? coverImage.slice(1) : coverImage;
    ogImageUrl = `${SITE_BASE_URL}/${normalizedCoverImage}`;
  } else {
    ogImageUrl = buildCloudinaryOgImage(title || slug || 'Untitled');
  }

  const tagsString = Array.isArray(tags) ? tags.map((tag) => escapeHtml(tag)).join(', ') : '';

  // 更新 meta tags
  html = html.replace(/<title>Reading - \(b\)-log<\/title>/, `<title>${safeTitle} - (b)-log</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${safeSummary}"`);
  html = html.replace(/<link rel="canonical" href="[^"]*" id="canonical-url">/, `<link rel="canonical" href="${fullUrl}" id="canonical-url">`);
  html = html.replace(/<meta name="keywords" content="" id="meta-keywords">/, `<meta name="keywords" content="${tagsString}" id="meta-keywords">`);
  html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index, follow">');
  html = html.replace(/  <!-- 首圖 preload 會由生成腳本注入到這裡 -->\s*/,
    `  <!-- 首圖 preload 會由生成腳本注入到這裡 -->\n${heroPreload}`);
  html = replaceRequired(html, '<article class="post" id="post-article">', `<article class="post" id="post-article"${categoryThemeAttr}>`);
  html = replaceRequired(html, '<figure id="post-hero" class="post__cover" hidden></figure>', heroMarkup);
  html = replaceRequired(html, '<span id="breadcrumb-current"></span>', buildBreadcrumbMarkup(post));
  html = replaceRequired(html, '<div id="post-accent" class="post__accent" aria-hidden="true"></div>', buildAccentMarkup(post));
  html = replaceRequired(html, '<ol id="related-list" class="side-list"></ol>', buildRelatedListMarkup(sortedPosts, post));
  html = replaceRequired(html, '<ol id="latest-sidebar" class="side-list"></ol>', buildLatestListMarkup(sortedPosts, post));
  html = replaceRequired(html, '<p id="post-meta" class="meta"></p>', `<p id="post-meta" class="meta">${staticMetaMarkup}</p>`);
  html = replaceRequired(html, '<p id="post-catline" class="catline" hidden></p>', buildCatlineMarkup(post));
  html = replaceRequired(html, '<h1 id="post-title" class="post__title">Loading</h1>', `<h1 id="post-title" class="post__title">${safeTitle}</h1>`);
  html = replaceRequired(html, '<div id="post-content" class="post__body article-body"></div>', `<div id="post-content" class="post__body article-body" data-prerendered="true">${staticPostContent}</div>`);
  html = replaceRequired(html, '<section id="post-status" class="status" aria-labelledby="status-title" hidden></section>', buildStatusMarkup(post));
  html = replaceRequired(html, '<div id="post-tags" class="tags" hidden></div>', staticTagsMarkup);
  html = replaceMarkedBlock(
    html,
    ARTICLE_TAGS_START,
    ARTICLE_TAGS_END,
    buildArticleTagMetaBlock(tags)
  );

  // Open Graph
  html = html.replace(/<meta property="og:url" content="" id="og-url">/, `<meta property="og:url" content="${fullUrl}" id="og-url">`);
  html = html.replace(/<meta property="og:title" content="Loading - \(b\)-log" id="og-title">/, `<meta property="og:title" content="${safeTitle}" id="og-title">`);
  html = html.replace(/<meta property="og:description" content="" id="og-description">/, `<meta property="og:description" content="${safeSummary}" id="og-description">`);
  html = html.replace(/<meta property="og:image" content="" id="og-image">/, `<meta property="og:image" content="${ogImageUrl}" id="og-image">`);
  html = html.replace(/<meta property="article:published_time" content="" id="og-published-time">/, `<meta property="article:published_time" content="${publishedAt || ''}" id="og-published-time">`);
  html = html.replace(/<meta property="article:modified_time" content="" id="og-modified-time">/, `<meta property="article:modified_time" content="${updatedAt || publishedAt || ''}" id="og-modified-time">`);
  html = html.replace(/<meta property="article:section" content="" id="og-section">/, `<meta property="article:section" content="${safeCategory}" id="og-section">`);

  // Twitter
  html = html.replace(/<meta property="twitter:url" content="" id="twitter-url">/, `<meta property="twitter:url" content="${fullUrl}" id="twitter-url">`);
  html = html.replace(/<meta property="twitter:title" content="Loading - \(b\)-log" id="twitter-title">/, `<meta property="twitter:title" content="${safeTitle}" id="twitter-title">`);
  html = html.replace(/<meta property="twitter:description" content="" id="twitter-description">/, `<meta property="twitter:description" content="${safeSummary}" id="twitter-description">`);
  html = html.replace(/<meta property="twitter:image" content="" id="twitter-image">/, `<meta property="twitter:image" content="${ogImageUrl}" id="twitter-image">`);
  html = html.replace('</head>', `${buildStructuredData(post, fullUrl, ogImageUrl)}</head>`);
  html = applyFooterYear(html);

  return stripTrailingWhitespace(html);
}

// 生成重定向頁面 HTML
function generateRedirectHTML(newCategorySlug, slug) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=/${newCategorySlug}/${slug}/">
    <meta name="robots" content="noindex">
    <link rel="canonical" href="https://b-log.to/${newCategorySlug}/${slug}/">
    <title>重定向中...</title>
    <script>
        window.location.replace('/${newCategorySlug}/${slug}/');
    </script>
</head>
<body>
    <p>頁面已移動至 <a href="/${newCategorySlug}/${slug}/">新位置</a>...</p>
</body>
</html>`;
}

function buildCurrentRouteMap(posts) {
  const slugToCurrentCategory = new Map();
  let skippedCount = 0;

  for (const post of posts) {
    const { slug, title, category } = post;
    const categorySlug = categoryMapping[category];

    if (!categorySlug) {
      console.warn(`⚠️  警告：未知的分類 "${category}"，跳過文章 "${title}"`);
      skippedCount++;
      continue;
    }

    if (slugToCurrentCategory.has(slug)) {
      throw new Error(`重複的 slug：${slug}`);
    }

    slugToCurrentCategory.set(slug, categorySlug);
  }

  return {
    skippedCount,
    slugToCurrentCategory,
  };
}

function sortPostsByPublishedAt(posts) {
  return [...posts].sort((a, b) => {
    const timeA = parseDate(a.publishedAt)?.getTime() || 0;
    const timeB = parseDate(b.publishedAt)?.getTime() || 0;
    return timeB - timeA;
  });
}

function writeCurrentPostPages(posts) {
  let createdCount = 0;
  let redirectCount = 0;
  const sortedPosts = sortPostsByPublishedAt(posts);

  for (const post of posts) {
    const { slug, title, category } = post;
    const categorySlug = categoryMapping[category];

    if (!categorySlug) continue;

    const categoryDir = path.join(ROOT_DIR, categorySlug);
    ensureDir(categoryDir);

    const postDir = path.join(categoryDir, slug);
    ensureDir(postDir);

    const indexPath = path.join(postDir, 'index.html');
    const html = generatePostHTML(post, sortedPosts);
    fs.writeFileSync(indexPath, html, 'utf8');

    console.log(`✅ 已建立：${categorySlug}/${slug}/index.html`);
    createdCount++;

    if (post.previousCategory) {
      const previousCategorySlug = categoryMapping[post.previousCategory];
      if (previousCategorySlug && previousCategorySlug !== categorySlug) {
        const oldPostDir = path.join(ROOT_DIR, previousCategorySlug, slug);
        ensureDir(oldPostDir);

        const redirectPath = path.join(oldPostDir, 'index.html');
        const redirectHTML = generateRedirectHTML(categorySlug, slug);
        fs.writeFileSync(redirectPath, redirectHTML, 'utf8');

        console.log(`🔀 已建立重定向：${previousCategorySlug}/${slug}/ → ${categorySlug}/${slug}/`);
        redirectCount++;
      }
    }
  }

  return {
    createdCount,
    redirectCount,
  };
}

function reconcileGeneratedRoutes(slugToCurrentCategory) {
  let orphanRemovedCount = 0;
  let staleConvertedCount = 0;
  const existingIndexFiles = listGeneratedIndexFiles();

  for (const fileInfo of existingIndexFiles) {
    const { categorySlug, slug, indexPath } = fileInfo;
    const currentCategorySlug = slugToCurrentCategory.get(slug);

    // 不在 posts.json 的孤兒頁面
    if (!currentCategorySlug) {
      fs.unlinkSync(indexPath);
      removeEmptyDirsUpward(path.dirname(indexPath), ROOT_DIR);
      console.log(`🧹 已刪除孤兒頁面：${categorySlug}/${slug}/index.html`);
      orphanRemovedCount++;
      continue;
    }

    // 分類已變更：覆蓋成重定向
    if (categorySlug !== currentCategorySlug) {
      const existingHtml = fs.readFileSync(indexPath, 'utf8');
      const targetPath = `/${currentCategorySlug}/${slug}/`;
      const alreadyCorrectRedirect = isRedirectPage(existingHtml) && existingHtml.includes(targetPath);

      if (!alreadyCorrectRedirect) {
        const redirectHTML = generateRedirectHTML(currentCategorySlug, slug);
        fs.writeFileSync(indexPath, redirectHTML, 'utf8');
        console.log(`♻️  已修正分類殘留頁：${categorySlug}/${slug}/ → ${currentCategorySlug}/${slug}/`);
        staleConvertedCount++;
      }
    }
  }

  return {
    orphanRemovedCount,
    staleConvertedCount,
  };
}

function printSyncSummary({
  createdCount,
  redirectCount,
  skippedCount,
  orphanRemovedCount,
  staleConvertedCount,
}) {
  console.log(`\n完成！共建立 ${createdCount} 個文章頁面`);
  if (redirectCount > 0) {
    console.log(`🔀 額外建立 ${redirectCount} 個顯式重定向頁面`);
  }
  if (staleConvertedCount > 0) {
    console.log(`♻️  自動修正 ${staleConvertedCount} 個舊分類殘留頁面`);
  }
  if (orphanRemovedCount > 0) {
    console.log(`🧹 清理 ${orphanRemovedCount} 個孤兒頁面`);
  }
  if (skippedCount > 0) {
    console.log(`⚠️  跳過 ${skippedCount} 個文章`);
  }
}

function syncGeneratedContent() {
  console.log('開始同步內容產物與 WordPress 風格文章頁面...\n');

  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
  syncFooterYearPages();
  postTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  syncHomepage(posts);

  const routeState = buildCurrentRouteMap(posts);
  const writeSummary = writeCurrentPostPages(posts);
  const reconcileSummary = reconcileGeneratedRoutes(routeState.slugToCurrentCategory);

  printSyncSummary({
    ...routeState,
    ...writeSummary,
    ...reconcileSummary,
  });
}

// 執行腳本
try {
  syncGeneratedContent();
} catch (error) {
  console.error('❌ 錯誤：', error.message);
  process.exit(1);
}
