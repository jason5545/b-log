const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SITE_BASE_URL = 'https://b-log.to';
const MAX_AUDIO_PARTS = 20;

const paths = {
  posts: path.join(ROOT_DIR, 'data/posts.json'),
  feed: path.join(ROOT_DIR, 'feed.json'),
  sitemap: path.join(ROOT_DIR, 'sitemap.xml'),
  categories: path.join(ROOT_DIR, 'config/categories.json'),
  postsDir: path.join(ROOT_DIR, 'content/posts'),
  audioDir: path.join(ROOT_DIR, 'content/audio'),
};

const issues = {
  errors: [],
  warnings: [],
  notes: [],
};

// 洋紅只給 LiSA（AGENTS.md）：她的兩個分類，加上分類不是她的、但 Jason 9/26 確認算她的文章。
// HER_POST_SLUGS 在 main.js、generate-redirects.js、validate-content.js 三處要一致，下面會比對
const HER_CATEGORIES = ['シルシ', 'Crossing Field'];
const HER_POST_SLUGS = ['songshan-airport-jpop-parallel-world', 'birthday-avatar-ai-barrier'];
const HER_POST_SLUG_SOURCES = ['assets/main.js', 'scripts/generate-redirects.js'];
// 洋紅範圍：色相 285–350°、HSL 飽和度 > 35%
const MAGENTA_HUE_MIN = 285;
const MAGENTA_HUE_MAX = 350;
const MAGENTA_SATURATION_MIN = 35;
// 要掃的樣式：外部 CSS 與四個根目錄 HTML 的 inline style
const STYLE_SCAN_CSS_DIRS = ['assets/css'];
const STYLE_SCAN_CSS_FILES = ['assets/styles.css'];
const STYLE_SCAN_HTML_FILES = ['index.html', 'post.html', 'about.html', 'gadgets.html'];
// 可能落在洋紅範圍的 CSS 具名色（實際是否算洋紅仍用色相與飽和度判斷）
const NAMED_COLORS = {
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  hotpink: '#ff69b4',
  deeppink: '#ff1493',
  mediumvioletred: '#c71585',
  palevioletred: '#db7093',
  orchid: '#da70d6',
  mediumorchid: '#ba55d3',
  darkorchid: '#9932cc',
  violet: '#ee82ee',
  plum: '#dda0dd',
  darkmagenta: '#8b008b',
  purple: '#800080',
  pink: '#ffc0cb',
  lightpink: '#ffb6c1',
  crimson: '#dc143c',
};

function addError(message) {
  issues.errors.push(message);
}

function addWarning(message) {
  issues.warnings.push(message);
}

function addNote(message) {
  issues.notes.push(message);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addError(`${label} 不是有效 JSON：${error.message}`);
    return null;
  }
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    addError(`無法讀取 ${label}：${error.message}`);
    return '';
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : '';
}

function buildPostUrl(post, categoryMapping) {
  const categorySlug = categoryMapping[post.category];
  return `${SITE_BASE_URL}/${categorySlug}/${post.slug}/`;
}

function buildSitePath(post, categoryMapping) {
  const categorySlug = categoryMapping[post.category];
  return `/${categorySlug}/${post.slug}/`;
}

function buildAbsoluteUrl(resourcePath) {
  if (!resourcePath) return null;
  if (/^https?:\/\//.test(resourcePath)) return resourcePath;

  const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  return `${SITE_BASE_URL}${normalizedPath}`;
}

function getLocalPathFromSitePath(resourcePath) {
  if (typeof resourcePath !== 'string' || !resourcePath.trim()) {
    return null;
  }

  if (/^https?:\/\//.test(resourcePath)) {
    const url = new URL(resourcePath);
    if (url.origin !== SITE_BASE_URL) {
      return null;
    }
    resourcePath = url.pathname;
  }

  const pathname = resourcePath.split(/[?#]/)[0];
  if (!pathname.startsWith('/')) {
    return null;
  }

  const decodedPath = decodeURI(pathname);
  const localPath = path.join(ROOT_DIR, decodedPath);
  if (!localPath.startsWith(ROOT_DIR)) {
    return null;
  }

  return localPath;
}

function localSitePathExists(resourcePath) {
  const localPath = getLocalPathFromSitePath(resourcePath);
  if (!localPath) return true;
  return fs.existsSync(localPath);
}

function isHerPost(post) {
  return HER_CATEGORIES.includes(post.category) || HER_POST_SLUGS.includes(post.slug);
}

// 把 #rgb、#rrggbb、rgb()、hsl() 轉成 HSL（色相 0–360、飽和度與亮度 0–100）
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return { h: 0, s: 0, l: lightness * 100 };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
  else hue = 60 * ((rn - gn) / delta + 4);
  if (hue < 0) hue += 360;
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

function hexToHsl(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3 || value.length === 4) {
    value = value.slice(0, 3).split('').map((char) => char + char).join('');
  }
  value = value.slice(0, 6);
  return rgbToHsl(
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  );
}

function isMagentaRange({ h, s }) {
  return h >= MAGENTA_HUE_MIN && h <= MAGENTA_HUE_MAX && s > MAGENTA_SATURATION_MIN;
}

function formatHsl({ h, s }) {
  return `色相 ${h.toFixed(1)}°、飽和度 ${s.toFixed(1)}%`;
}

// 找出一段 CSS 值裡的所有顏色
function extractColors(value) {
  const colors = [];
  for (const match of value.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi)) {
    colors.push({ text: match[0], hsl: hexToHsl(match[0]) });
  }
  for (const match of value.matchAll(/rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/gi)) {
    colors.push({ text: match[0], hsl: rgbToHsl(Number(match[1]), Number(match[2]), Number(match[3])) });
  }
  for (const match of value.matchAll(/hsla?\(\s*(-?\d+(?:\.\d+)?)(?:deg)?[\s,]+(\d+(?:\.\d+)?)%[\s,]+(\d+(?:\.\d+)?)%/gi)) {
    const hue = ((Number(match[1]) % 360) + 360) % 360;
    colors.push({ text: match[0], hsl: { h: hue, s: Number(match[2]), l: Number(match[3]) } });
  }
  // 具名色要是獨立的字，var(--magenta) 裡的 magenta 是 token 名稱，不算
  for (const match of value.matchAll(/(?<![\w-])([a-z]+)(?![\w-])/gi)) {
    const named = NAMED_COLORS[match[1].toLowerCase()];
    if (named) colors.push({ text: match[0], hsl: hexToHsl(named) });
  }
  return colors;
}

// 掃一段 CSS 的每一條宣告，回傳洋紅範圍的顏色。
// 樣式表只看最內層 {} 裡的宣告，選擇器裡的 #id 不會被當成色碼；style 屬性整段都是宣告
function findMagentaDeclarations(cssText, { isDeclarationList = false } = {}) {
  const results = [];
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const blocks = isDeclarationList
    ? [{ text: withoutComments, offset: 0 }]
    : [...withoutComments.matchAll(/\{([^{}]*)\}/g)].map((match) => ({ text: match[1], offset: match.index + 1 }));

  for (const block of blocks) {
    for (const match of block.text.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;]+)/gi)) {
      const [, property, value] = match;
      for (const color of extractColors(value)) {
        if (!isMagentaRange(color.hsl)) continue;
        const line = withoutComments.slice(0, block.offset + match.index).split('\n').length;
        results.push({ property: property.toLowerCase(), color, line });
      }
    }
  }
  return results;
}

// (a) accentColor 在洋紅範圍的，只准出現在她的文章
function validateAccentColors(posts) {
  let withAccent = 0;
  const magentaAccents = [];

  for (const post of posts) {
    if (post.accentColor === undefined) continue;
    const context = post.slug || '(沒有 slug)';
    if (typeof post.accentColor !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(post.accentColor)) {
      addError(`${context} 的 accentColor 必須是 #rgb 或 #rrggbb：${post.accentColor}`);
      continue;
    }

    withAccent += 1;
    const hsl = hexToHsl(post.accentColor);
    if (!isMagentaRange(hsl)) continue;

    magentaAccents.push(post.slug);
    if (!isHerPost(post)) {
      addError(`${context} 的 accentColor ${post.accentColor} 在洋紅範圍（${formatHsl(hsl)}），洋紅只給 LiSA 的文章`);
    }
  }

  const violations = magentaAccents.filter((slug) => !isHerPost(posts.find((post) => post.slug === slug)));
  addNote(`洋紅檢查 (a) accentColor：${withAccent} 篇有 accentColor，洋紅範圍 ${magentaAccents.length} 篇，違規 ${violations.length} 篇${magentaAccents.length ? `（${magentaAccents.join('、')}）` : ''}`);
}

// (b) 樣式表與根目錄 HTML 的 inline style，洋紅範圍的色碼只准出現在 --magenta 宣告
function validateMagentaInStyles() {
  const sources = [];

  for (const file of STYLE_SCAN_CSS_FILES) {
    sources.push({ label: file, css: readText(path.join(ROOT_DIR, file), file) });
  }
  for (const dir of STYLE_SCAN_CSS_DIRS) {
    const dirPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter((name) => name.endsWith('.css')).sort()) {
      const relativePath = `${dir}/${file}`;
      sources.push({ label: relativePath, css: readText(path.join(dirPath, file), relativePath) });
    }
  }
  for (const file of STYLE_SCAN_HTML_FILES) {
    const html = readText(path.join(ROOT_DIR, file), file);
    for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      const startLine = html.slice(0, match.index).split('\n').length - 1;
      sources.push({ label: `${file} <style>`, css: match[1], lineOffset: startLine });
    }
    for (const match of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const line = html.slice(0, match.index).split('\n').length;
      sources.push({ label: `${file} style=""`, css: match[1] ?? match[2] ?? '', fixedLine: line, isDeclarationList: true });
    }
  }

  let allowed = 0;
  let violations = 0;
  for (const source of sources) {
    for (const { property, color, line } of findMagentaDeclarations(source.css, source)) {
      const location = source.fixedLine ?? (line + (source.lineOffset || 0));
      if (property === '--magenta') {
        allowed += 1;
        continue;
      }
      violations += 1;
      addError(`${source.label}:${location} 的 ${property} 用了洋紅範圍的 ${color.text}（${formatHsl(color.hsl)}），洋紅只能經由 --magenta token`);
    }
  }

  const fileCount = new Set(sources.map((source) => source.label.split(' ')[0])).size;
  addNote(`洋紅檢查 (b) 樣式：掃 ${fileCount} 個檔案（${sources.length} 段樣式），洋紅範圍色碼 ${allowed + violations} 處，${allowed} 處是 --magenta 宣告，違規 ${violations} 處`);
}

// 白名單三處一致：main.js 與 generate-redirects.js 的 HER_POST_SLUGS 要跟這裡一樣
function validateHerPostSlugSources() {
  const expected = JSON.stringify([...HER_POST_SLUGS].sort());
  for (const file of HER_POST_SLUG_SOURCES) {
    const source = readText(path.join(ROOT_DIR, file), file);
    const match = source.match(/const HER_POST_SLUGS = \[([^\]]*)\]/);
    if (!match) {
      addError(`${file} 找不到 HER_POST_SLUGS 白名單`);
      continue;
    }
    const slugs = [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((item) => item[1] ?? item[2]).sort();
    if (JSON.stringify(slugs) !== expected) {
      addError(`${file} 的 HER_POST_SLUGS 跟 validate-content.js 不一致：${slugs.join('、')}`);
    }
  }
}

function extractAudioMarkers(markdown) {
  return [...markdown.matchAll(/<!--\s*audio:\s*(.+?)\s*-->/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function getAudioPartIndexes(audioFile) {
  const ext = path.extname(audioFile);
  const basename = audioFile.slice(0, -ext.length);
  const prefix = `${basename}-part`;

  if (!ext || !fs.existsSync(paths.audioDir)) {
    return [];
  }

  return fs.readdirSync(paths.audioDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith(ext))
    .map((file) => file.slice(prefix.length, -ext.length))
    .filter((part) => /^\d+$/.test(part))
    .map((part) => Number.parseInt(part, 10))
    .sort((a, b) => a - b);
}

function validateAudioFile(audioFile, context) {
  const directPath = path.join(paths.audioDir, audioFile);
  const ext = path.extname(audioFile);
  const basename = audioFile.slice(0, -ext.length);
  const hasDirectFile = fs.existsSync(directPath);
  const partIndexes = getAudioPartIndexes(audioFile);

  if (!ext) {
    addError(`${context} 的音訊檔沒有副檔名：${audioFile}`);
    return;
  }

  if (!hasDirectFile && partIndexes.length === 0) {
    addError(`${context} 的音訊檔不存在：content/audio/${audioFile}`);
    return;
  }

  if (partIndexes.length === 0) {
    return;
  }

  const uniquePartIndexes = [...new Set(partIndexes)];

  if (!uniquePartIndexes.includes(0)) {
    addError(`${context} 的音訊分段缺少 part0：${basename}-part0${ext}`);
    return;
  }

  for (let expectedIndex = 0; expectedIndex < uniquePartIndexes.length; expectedIndex += 1) {
    if (uniquePartIndexes[expectedIndex] !== expectedIndex) {
      addError(`${context} 的音訊分段不連續，缺少 part${expectedIndex}：${basename}-part${expectedIndex}${ext}`);
      return;
    }
  }

  const lastPartIndex = uniquePartIndexes[uniquePartIndexes.length - 1];
  if (lastPartIndex >= MAX_AUDIO_PARTS) {
    addError(`${context} 的音訊分段超過前端支援上限 ${MAX_AUDIO_PARTS} 段：${basename}-part${lastPartIndex}${ext}`);
  }
}

// posts.json 的選填欄位 status：{ resolved, procedures, inop, open }，都是選填的字串陣列
const STATUS_KEYS = ['resolved', 'procedures', 'inop', 'open'];

function validateStatus(status, context) {
  if (!isPlainObject(status)) {
    addError(`${context} 的 status 必須是物件`);
    return;
  }

  for (const key of Object.keys(status)) {
    if (!STATUS_KEYS.includes(key)) {
      addError(`${context} 的 status 有未知欄位：${key}（只接受 ${STATUS_KEYS.join('、')}）`);
    }
  }

  for (const key of STATUS_KEYS) {
    if (status[key] === undefined) continue;
    if (!Array.isArray(status[key])) {
      addError(`${context} 的 status.${key} 必須是字串陣列`);
      continue;
    }
    if (status[key].some((item) => typeof item !== 'string' || !item.trim())) {
      addError(`${context} 的 status.${key} 含有空值或非字串`);
    }
  }

  const hasItems = STATUS_KEYS.some((key) => Array.isArray(status[key]) && status[key].length > 0);
  if (!hasItems) {
    addWarning(`${context} 的 status 沒有任何項目，不會顯示 STATUS 面板`);
  }
}

function validateCategories(categoriesConfig) {
  if (!isPlainObject(categoriesConfig) || !isPlainObject(categoriesConfig.categoryMapping)) {
    addError('config/categories.json 缺少 categoryMapping 物件');
    return {};
  }

  const values = Object.values(categoriesConfig.categoryMapping);
  const duplicateSlugs = values.filter((slug, index) => values.indexOf(slug) !== index);
  for (const slug of new Set(duplicateSlugs)) {
    addError(`分類 URL slug 重複：${slug}`);
  }

  for (const [category, slug] of Object.entries(categoriesConfig.categoryMapping)) {
    if (!category.trim()) {
      addError('分類名稱不可為空字串');
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      addError(`分類「${category}」的 URL slug 不安全：${slug}`);
    }
  }

  return categoriesConfig.categoryMapping;
}

function validatePosts(posts, categoryMapping) {
  if (!Array.isArray(posts)) {
    addError('data/posts.json 必須是陣列');
    return;
  }

  const seenSlugs = new Set();

  posts.forEach((post, index) => {
    const context = `第 ${index + 1} 篇文章${post?.slug ? ` (${post.slug})` : ''}`;

    if (!isPlainObject(post)) {
      addError(`${context} 不是物件`);
      return;
    }

    for (const field of ['slug', 'title', 'summary', 'category', 'author', 'publishedAt']) {
      if (typeof post[field] !== 'string' || !post[field].trim()) {
        addError(`${context} 缺少必要欄位：${field}`);
      }
    }

    if (typeof post.slug === 'string') {
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(post.slug)) {
        addError(`${context} 的 slug 不安全：${post.slug}`);
      }
      if (seenSlugs.has(post.slug)) {
        addError(`slug 重複：${post.slug}`);
      }
      seenSlugs.add(post.slug);
    }

    if (post.category && !categoryMapping[post.category]) {
      addError(`${context} 使用未知分類：${post.category}`);
    }

    if (post.previousCategory && !categoryMapping[post.previousCategory]) {
      addError(`${context} 的 previousCategory 不在分類設定內：${post.previousCategory}`);
    }

    const publishedAt = parseDate(post.publishedAt);
    if (!publishedAt) {
      addError(`${context} 的 publishedAt 不是有效日期：${post.publishedAt}`);
    }

    if (post.updatedAt) {
      const updatedAt = parseDate(post.updatedAt);
      if (!updatedAt) {
        addError(`${context} 的 updatedAt 不是有效日期：${post.updatedAt}`);
      } else if (publishedAt && updatedAt < publishedAt) {
        addWarning(`${context} 的 updatedAt 早於 publishedAt`);
      }
    }

    if (!Array.isArray(post.tags)) {
      addError(`${context} 的 tags 必須是陣列`);
    } else if (post.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
      addError(`${context} 的 tags 含有空值或非字串`);
    }

    if (post.status !== undefined) {
      validateStatus(post.status, context);
    }

    if (post.coverImage && !localSitePathExists(post.coverImage)) {
      addError(`${context} 的 coverImage 找不到檔案：${post.coverImage}`);
    }

    const markdownPath = path.join(paths.postsDir, `${post.slug}.md`);
    if (!post.slug || !fs.existsSync(markdownPath)) {
      addError(`${context} 找不到 Markdown：content/posts/${post.slug}.md`);
      return;
    }

    const markdown = readText(markdownPath, `content/posts/${post.slug}.md`);
    const firstNonEmptyLine = markdown.split(/\r?\n/).find((line) => line.trim());
    if (firstNonEmptyLine && !firstNonEmptyLine.startsWith('# ')) {
      addWarning(`${context} 第一個非空行不是 H1 標題`);
    }

    const audioMarkers = extractAudioMarkers(markdown);
    if (audioMarkers.length > 1) {
      addError(`${context} 有多個 audio 註解，前端目前只會處理第一個`);
    }

    for (const audioFile of audioMarkers) {
      validateAudioFile(audioFile, context);
    }

    if (post.hasAudio === true && audioMarkers.length === 0) {
      addError(`${context} 設了 hasAudio，但 Markdown 沒有 audio 註解`);
    }

    if (audioMarkers.length > 0 && post.hasAudio !== true) {
      addError(`${context} 有 audio 註解，但 posts.json 沒有 hasAudio: true`);
    }
  });
}

function validateFeed(feed, posts, categoryMapping) {
  if (!isPlainObject(feed) || !Array.isArray(feed.items)) {
    addError('feed.json 缺少 items 陣列');
    return;
  }

  const feedItemsById = new Map();
  for (const item of feed.items) {
    if (!item.id) {
      addError('feed.json 有 item 缺少 id');
      continue;
    }
    if (feedItemsById.has(item.id)) {
      addError(`feed.json id 重複：${item.id}`);
    }
    feedItemsById.set(item.id, item);
  }

  for (const post of posts) {
    const item = feedItemsById.get(post.slug);
    if (!item) {
      addError(`feed.json 缺少文章：${post.slug}`);
      continue;
    }

    const expectedUrl = buildPostUrl(post, categoryMapping);
    const expectedPublishedAt = toIsoString(post.publishedAt);
    const expectedUpdatedAt = toIsoString(post.updatedAt || post.publishedAt);
    const expectedImage = post.coverImage ? buildAbsoluteUrl(post.coverImage) : undefined;

    if (item.url !== expectedUrl) {
      addError(`feed.json ${post.slug} URL 不同步：${item.url} !== ${expectedUrl}`);
    }
    if (item.title !== post.title) {
      addError(`feed.json ${post.slug} title 不同步`);
    }
    if (item.content_text !== post.summary) {
      addError(`feed.json ${post.slug} content_text 不同步`);
    }
    if (item.date_published !== expectedPublishedAt) {
      addError(`feed.json ${post.slug} date_published 不同步`);
    }
    if (item.date_modified !== expectedUpdatedAt) {
      addError(`feed.json ${post.slug} date_modified 不同步`);
    }
    if (JSON.stringify(item.tags || []) !== JSON.stringify(post.tags || [])) {
      addError(`feed.json ${post.slug} tags 不同步`);
    }
    if ((item.image || undefined) !== expectedImage) {
      addError(`feed.json ${post.slug} image 不同步`);
    }
  }

  for (const item of feed.items) {
    if (!posts.some((post) => post.slug === item.id)) {
      addError(`feed.json 有 posts.json 不存在的文章：${item.id}`);
    }
  }

  const sortedItems = [...feed.items].sort((a, b) => new Date(b.date_published) - new Date(a.date_published));
  if (JSON.stringify(feed.items.map((item) => item.id)) !== JSON.stringify(sortedItems.map((item) => item.id))) {
    addError('feed.json items 沒有依 date_published 由新到舊排序');
  }
}

function parseSitemapUrls(sitemapXml) {
  const urls = new Map();
  const blocks = sitemapXml.match(/<url>[\s\S]*?<\/url>/g) || [];

  for (const block of blocks) {
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
    if (loc) {
      urls.set(loc, { lastmod });
    }
  }

  return urls;
}

function validateSitemap(sitemapXml, posts, categoryMapping) {
  const urls = parseSitemapUrls(sitemapXml);
  const latestPostDate = posts.reduce((latest, post) => {
    const postDate = post.updatedAt || post.publishedAt;
    return postDate > latest ? postDate : latest;
  }, '');

  const staticUrls = [
    [`${SITE_BASE_URL}/`, latestPostDate],
    [`${SITE_BASE_URL}/about.html`, latestPostDate],
  ];

  for (const [url, lastmod] of staticUrls) {
    if (!urls.has(url)) {
      addError(`sitemap.xml 缺少 URL：${url}`);
    } else if (urls.get(url).lastmod !== lastmod) {
      addError(`sitemap.xml ${url} lastmod 不同步`);
    }
  }

  for (const post of posts) {
    const url = buildPostUrl(post, categoryMapping);
    const expectedLastmod = post.updatedAt || post.publishedAt;
    if (!urls.has(url)) {
      addError(`sitemap.xml 缺少文章 URL：${url}`);
    } else if (urls.get(url).lastmod !== expectedLastmod) {
      addError(`sitemap.xml ${post.slug} lastmod 不同步`);
    }
  }
}

function isRedirectPage(html) {
  return (
    html.includes('meta http-equiv="refresh"') ||
    html.includes('window.location.replace(') ||
    html.includes('meta name="robots" content="noindex"')
  );
}

function validateGeneratedRoutes(posts, categoryMapping) {
  const knownCategorySlugs = new Set(Object.values(categoryMapping));
  const slugToCurrentPath = new Map();

  for (const post of posts) {
    const routePath = buildSitePath(post, categoryMapping);
    const indexPath = path.join(ROOT_DIR, routePath, 'index.html');
    slugToCurrentPath.set(post.slug, routePath);

    if (!fs.existsSync(indexPath)) {
      addError(`缺少文章靜態頁：${routePath}index.html`);
      continue;
    }

    const html = readText(indexPath, `${routePath}index.html`);
    const canonical = `<link rel="canonical" href="${buildPostUrl(post, categoryMapping)}" id="canonical-url">`;
    const ogUrl = `<meta property="og:url" content="${buildPostUrl(post, categoryMapping)}" id="og-url">`;

    if (!html.includes(canonical)) {
      addError(`${routePath}index.html canonical 不同步`);
    }
    if (!html.includes(ogUrl)) {
      addError(`${routePath}index.html og:url 不同步`);
    }
  }

  for (const categorySlug of knownCategorySlugs) {
    const categoryDir = path.join(ROOT_DIR, categorySlug);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const indexPath = path.join(categoryDir, entry.name, 'index.html');
      if (!fs.existsSync(indexPath)) continue;

      const routePath = `/${categorySlug}/${entry.name}/`;
      const currentPath = slugToCurrentPath.get(entry.name);
      if (!currentPath) {
        addError(`發現 posts.json 不存在的 generated route：${routePath}`);
        continue;
      }

      if (routePath !== currentPath) {
        const html = readText(indexPath, `${routePath}index.html`);
        if (!isRedirectPage(html) || !html.includes(currentPath)) {
          addError(`${routePath}index.html 應該重定向到 ${currentPath}`);
        }
      }
    }
  }
}

function main() {
  const categoriesConfig = readJson(paths.categories, 'config/categories.json');
  const posts = readJson(paths.posts, 'data/posts.json') || [];
  const feed = readJson(paths.feed, 'feed.json');
  const sitemapXml = readText(paths.sitemap, 'sitemap.xml');

  const categoryMapping = validateCategories(categoriesConfig);
  validatePosts(posts, categoryMapping);

  if (feed) {
    validateFeed(feed, posts, categoryMapping);
  }

  if (sitemapXml) {
    validateSitemap(sitemapXml, posts, categoryMapping);
  }

  validateGeneratedRoutes(posts, categoryMapping);

  if (Array.isArray(posts)) {
    validateAccentColors(posts);
  }
  validateMagentaInStyles();
  validateHerPostSlugSources();

  for (const note of issues.notes) {
    console.log(`ℹ️  ${note}`);
  }

  for (const warning of issues.warnings) {
    console.warn(`⚠️  ${warning}`);
  }

  if (issues.errors.length > 0) {
    console.error(`\n❌ 內容驗證失敗，共 ${issues.errors.length} 個錯誤：`);
    for (const error of issues.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`✅ 內容驗證通過：${posts.length} 篇文章、${Object.keys(categoryMapping).length} 個分類`);
}

main();
