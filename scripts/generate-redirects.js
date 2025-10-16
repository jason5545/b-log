const fs = require('fs');
const path = require('path');

// 中文分類到英文的映射
const categoryMapping = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy'
};

// 生成重定向 HTML 頁面的模板
function generateRedirectHTML(title, slug) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - b-log</title>
  <meta http-equiv="refresh" content="0; url=/post.html?slug=${slug}">
  <link rel="canonical" href="https://b-log.to/post.html?slug=${slug}">
  <script>
    // 立即重定向
    window.location.replace('/post.html?slug=${slug}');
  </script>
</head>
<body>
  <p>正在重定向至 <a href="/post.html?slug=${slug}">${title}</a>...</p>
</body>
</html>`;
}

// 主要函數
function generateRedirects() {
  console.log('開始生成重定向頁面...\n');

  // 讀取 posts.json
  const postsPath = path.join(__dirname, '../data/posts.json');
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

  let createdCount = 0;
  let skippedCount = 0;

  // 為每篇文章生成重定向頁面
  posts.forEach(post => {
    const { slug, title, category } = post;
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

    // 生成 index.html
    const indexPath = path.join(postDir, 'index.html');
    const html = generateRedirectHTML(title, slug);
    fs.writeFileSync(indexPath, html, 'utf8');

    console.log(`✅ 已建立：${categorySlug}/${slug}/index.html`);
    createdCount++;
  });

  console.log(`\n完成！共建立 ${createdCount} 個重定向頁面`);
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
