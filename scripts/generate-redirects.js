const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_PATH = path.join(ROOT_DIR, 'data/posts.json');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'post.html');

// 從集中式設定檔載入分類映射
const categoriesConfigPath = path.join(ROOT_DIR, 'config/categories.json');
const categoriesConfig = JSON.parse(fs.readFileSync(categoriesConfigPath, 'utf8'));
const categoryMapping = categoriesConfig.categoryMapping;
const knownCategorySlugs = new Set(Object.values(categoryMapping));

const postTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildHeroPreload(coverImage) {
  if (!coverImage) return '';

  return `  <link rel="preload" as="image" href="${coverImage}" fetchpriority="high">\n`;
}

function buildHeroMarkup(post) {
  if (!post.coverImage) {
    return '<div id="post-hero" class="article-hero"></div>';
  }

  const safeTitle = escapeHtml(post.title || post.slug || '');
  const safeCoverImage = escapeHtml(post.coverImage);
  return `<div id="post-hero" class="article-hero article-hero--image"><img class="article-hero__image" src="${safeCoverImage}" alt="" aria-hidden="true" fetchpriority="high" decoding="async"></div>`;
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
function generatePostHTML(post) {
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
  const baseUrl = 'https://b-log.to';
  const fullUrl = `${baseUrl}/${categorySlug}/${slug}/`;
  const heroPreload = buildHeroPreload(coverImage);
  const heroMarkup = buildHeroMarkup(post);

  // 生成 Open Graph 圖片 URL
  let ogImageUrl;
  if (coverImage) {
    const normalizedCoverImage = coverImage.startsWith('/') ? coverImage.slice(1) : coverImage;
    ogImageUrl = `${baseUrl}/${normalizedCoverImage}`;
  } else {
    // 使用 Cloudinary 動態生成圖片（支援中文 Noto Sans TC Bold 字型）
    const cloudName = 'dynj7181i';
    const backgroundId = 'og-background_cbst7j';
    const fontId = 'notosanstc-bold.ttf';
    const encodedTitle = encodeURIComponent(title || slug || 'Untitled');

    ogImageUrl =
      `https://res.cloudinary.com/${cloudName}/image/upload/` +
      `c_fill,w_1200,h_630/` +
      `co_rgb:ffffff,` +
      `l_text:${fontId}_60_center:${encodedTitle},w_1000,c_fit/` +
      `fl_layer_apply,g_center/` +
      `${backgroundId}.png`;
  }

  const tagsString = Array.isArray(tags) ? tags.map((tag) => escapeHtml(tag)).join(', ') : '';

  // 更新 meta tags
  html = html.replace(/<title>Reading - \(b\)-log<\/title>/, `<title>${safeTitle} - (b)-log</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${safeSummary}"`);
  html = html.replace(/<link rel="canonical" href="" id="canonical-url">/, `<link rel="canonical" href="${fullUrl}" id="canonical-url">`);
  html = html.replace(/<meta name="keywords" content="" id="meta-keywords">/, `<meta name="keywords" content="${tagsString}" id="meta-keywords">`);
  html = html.replace(/  <!-- 首圖 preload 會由生成腳本注入到這裡 -->\s*/,
    `  <!-- 首圖 preload 會由生成腳本注入到這裡 -->\n${heroPreload}`);
  html = html.replace(/<div id="post-hero" class="article-hero"><\/div>/, heroMarkup);

  // Open Graph
  html = html.replace(/<meta property="og:url" content="" id="og-url">/, `<meta property="og:url" content="${fullUrl}" id="og-url">`);
  html = html.replace(/<meta property="og:title" content="Loading - \(b\)-log" id="og-title">/, `<meta property="og:title" content="${safeTitle}" id="og-title">`);
  html = html.replace(/<meta property="og:description" content="" id="og-description">/, `<meta property="og:description" content="${safeSummary}" id="og-description">`);
  html = html.replace(/<meta property="og:image" content="" id="og-image">/, `<meta property="og:image" content="${ogImageUrl}" id="og-image">`);
  html = html.replace(/<meta property="article:published_time" content="" id="og-published-time">/, `<meta property="article:published_time" content="${publishedAt || ''}" id="og-published-time">`);
  html = html.replace(/<meta property="article:modified_time" content="" id="og-modified-time">/, `<meta property="article:modified_time" content="${updatedAt || publishedAt || ''}" id="og-modified-time">`);
  html = html.replace(/<meta property="article:section" content="" id="og-section">/, `<meta property="article:section" content="${safeCategory}" id="og-section">`);
  html = html.replace(/<meta property="article:tag" content="" id="og-tags">/, `<meta property="article:tag" content="${tagsString}" id="og-tags">`);

  // Twitter
  html = html.replace(/<meta property="twitter:url" content="" id="twitter-url">/, `<meta property="twitter:url" content="${fullUrl}" id="twitter-url">`);
  html = html.replace(/<meta property="twitter:title" content="Loading - \(b\)-log" id="twitter-title">/, `<meta property="twitter:title" content="${safeTitle}" id="twitter-title">`);
  html = html.replace(/<meta property="twitter:description" content="" id="twitter-description">/, `<meta property="twitter:description" content="${safeSummary}" id="twitter-description">`);
  html = html.replace(/<meta property="twitter:image" content="" id="twitter-image">/, `<meta property="twitter:image" content="${ogImageUrl}" id="twitter-image">`);

  return html;
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

// 主要函數
function generateRedirects() {
  console.log('開始生成 WordPress 風格文章頁面...\n');

  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));

  let createdCount = 0;
  let redirectCount = 0;
  let skippedCount = 0;
  let orphanRemovedCount = 0;
  let staleConvertedCount = 0;

  const slugToCurrentCategory = new Map();

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

  // 1) 先生成每篇文章當前分類下的完整靜態頁面
  for (const post of posts) {
    const { slug, title, category } = post;
    const categorySlug = categoryMapping[category];

    if (!categorySlug) continue;

    const categoryDir = path.join(ROOT_DIR, categorySlug);
    ensureDir(categoryDir);

    const postDir = path.join(categoryDir, slug);
    ensureDir(postDir);

    const indexPath = path.join(postDir, 'index.html');
    const html = generatePostHTML(post);
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

  // 2) 掃描既有分類目錄：
  //    - slug 不存在於 posts.json -> 刪除
  //    - slug 存在但分類已變更 -> 自動改寫為重定向頁
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

// 執行腳本
try {
  generateRedirects();
} catch (error) {
  console.error('❌ 錯誤：', error.message);
  process.exit(1);
}
