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
};

function addError(message) {
  issues.errors.push(message);
}

function addWarning(message) {
  issues.warnings.push(message);
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
