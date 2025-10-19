const fs = require('fs');
const path = require('path');

// 從集中式設定檔載入分類映射
const categoriesConfigPath = path.join(__dirname, '../config/categories.json');
const categoriesConfig = JSON.parse(fs.readFileSync(categoriesConfigPath, 'utf8'));
const categoryMapping = categoriesConfig.categoryMapping;

// 生成完整的文章頁面 HTML（複製 post.html 結構）
function generatePostHTML(post) {
  const { slug, title, summary, category, coverImage, accentColor, publishedAt, updatedAt, tags } = post;
  const categorySlug = categoryMapping[category];

  // 讀取 post.html 模板
  const templatePath = path.join(__dirname, '../post.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // 調整相對路徑，因為文章頁面在 /category/slug/ 目錄下
  // 需要往上兩層才能到根目錄
  html = html.replace(/href="assets\//g, 'href="../../assets/');
  html = html.replace(/src="assets\//g, 'src="../../assets/');
  html = html.replace(/href="\.\/"/g, 'href="../../"');
  html = html.replace(/href="about\.html"/g, 'href="../../about.html"');
  html = html.replace(/href="feed\.json"/g, 'href="../../feed.json"');

  // 生成完整的 URL
  const baseUrl = 'https://b-log.to';
  const fullUrl = `${baseUrl}/${categorySlug}/${slug}/`;

  // 生成 Open Graph 圖片 URL
  let ogImageUrl;
  if (coverImage) {
    ogImageUrl = `${baseUrl}/${coverImage}`;
  } else {
    // 使用 Cloudinary 動態生成圖片（支援中文 Noto Sans TC Bold 字型）
    const cloudName = 'dynj7181i';
    const backgroundId = 'og-background_cbst7j';
    const fontId = 'notosanstc-bold.ttf';
    const encodedTitle = encodeURIComponent(title);

    ogImageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
      `c_fill,w_1200,h_630/` +                      // 背景尺寸
      `co_rgb:ffffff,` +                             // 文字顏色：白色
      `l_text:${fontId}_60_center:${encodedTitle},w_1000,c_fit/` +  // 文字覆蓋（60px，限寬 1000px）
      `fl_layer_apply,g_center/` +                   // 文字置中
      `${backgroundId}.png`;                         // 背景圖片
  }

  // 生成 tags 字串
  const tagsString = tags ? tags.join(', ') : '';

  // 更新 meta tags
  html = html.replace(/<title>Reading - \(b\)-log<\/title>/, `<title>${title} - (b)-log</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${summary}"`);
  html = html.replace(/<link rel="canonical" href="" id="canonical-url">/, `<link rel="canonical" href="${fullUrl}" id="canonical-url">`);
  html = html.replace(/<meta name="keywords" content="" id="meta-keywords">/, `<meta name="keywords" content="${tagsString}" id="meta-keywords">`);

  // Open Graph
  html = html.replace(/<meta property="og:url" content="" id="og-url">/, `<meta property="og:url" content="${fullUrl}" id="og-url">`);
  html = html.replace(/<meta property="og:title" content="Loading - \(b\)-log" id="og-title">/, `<meta property="og:title" content="${title}" id="og-title">`);
  html = html.replace(/<meta property="og:description" content="" id="og-description">/, `<meta property="og:description" content="${summary}" id="og-description">`);
  html = html.replace(/<meta property="og:image" content="" id="og-image">/, `<meta property="og:image" content="${ogImageUrl}" id="og-image">`);
  html = html.replace(/<meta property="article:published_time" content="" id="og-published-time">/, `<meta property="article:published_time" content="${publishedAt}" id="og-published-time">`);
  html = html.replace(/<meta property="article:modified_time" content="" id="og-modified-time">/, `<meta property="article:modified_time" content="${updatedAt}" id="og-modified-time">`);
  html = html.replace(/<meta property="article:section" content="" id="og-section">/, `<meta property="article:section" content="${category}" id="og-section">`);
  html = html.replace(/<meta property="article:tag" content="" id="og-tags">/, `<meta property="article:tag" content="${tagsString}" id="og-tags">`);

  // Twitter
  html = html.replace(/<meta property="twitter:url" content="" id="twitter-url">/, `<meta property="twitter:url" content="${fullUrl}" id="twitter-url">`);
  html = html.replace(/<meta property="twitter:title" content="Loading - \(b\)-log" id="twitter-title">/, `<meta property="twitter:title" content="${title}" id="twitter-title">`);
  html = html.replace(/<meta property="twitter:description" content="" id="twitter-description">/, `<meta property="twitter:description" content="${summary}" id="twitter-description">`);
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

  // 讀取 posts.json
  const postsPath = path.join(__dirname, '../data/posts.json');
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

  let createdCount = 0;
  let redirectCount = 0;
  let skippedCount = 0;

  // 為每篇文章生成重定向頁面
  posts.forEach(post => {
    const { slug, title, category, previousCategory } = post;
    const categorySlug = categoryMapping[category];

    if (!categorySlug) {
      console.warn(`⚠️  警告：未知的分類 "${category}"，跳過文章 "${title}"`);
      skippedCount++;
      return;
    }

    // 建立分類目錄
    const categoryDir = path.join(__dirname, '..', categorySlug);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log(`📁 建立目錄：${categorySlug}/`);
    }

    // 建立文章目錄
    const postDir = path.join(categoryDir, slug);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    // 生成 index.html（使用完整的文章頁面結構，包含 Open Graph meta tags）
    const indexPath = path.join(postDir, 'index.html');
    const html = generatePostHTML(post);
    fs.writeFileSync(indexPath, html, 'utf8');

    console.log(`✅ 已建立：${categorySlug}/${slug}/index.html`);
    createdCount++;

    // 如果存在 previousCategory，在舊分類目錄建立重定向頁面
    if (previousCategory) {
      const previousCategorySlug = categoryMapping[previousCategory];

      if (previousCategorySlug && previousCategorySlug !== categorySlug) {
        const oldCategoryDir = path.join(__dirname, '..', previousCategorySlug);
        const oldPostDir = path.join(oldCategoryDir, slug);

        // 建立舊目錄（如果不存在）
        if (!fs.existsSync(oldPostDir)) {
          fs.mkdirSync(oldPostDir, { recursive: true });
        }

        // 生成重定向頁面
        const redirectPath = path.join(oldPostDir, 'index.html');
        const redirectHTML = generateRedirectHTML(categorySlug, slug);
        fs.writeFileSync(redirectPath, redirectHTML, 'utf8');

        console.log(`🔀 已建立重定向：${previousCategorySlug}/${slug}/ → ${categorySlug}/${slug}/`);
        redirectCount++;
      }
    }
  });

  console.log(`\n完成！共建立 ${createdCount} 個文章頁面`);
  if (redirectCount > 0) {
    console.log(`🔀 建立 ${redirectCount} 個重定向頁面`);
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
