const fs = require('fs');
const path = require('path');

// 中文分類到英文的映射
const categoryMapping = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy'
};

// 生成完整的文章頁面 HTML（複製 post.html 結構）
function generatePostHTML(title, slug) {
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

  // 更新初始標題（JavaScript 會動態更新）
  html = html.replace(/<title>Reading - b-log<\/title>/, `<title>${title} - b-log</title>`);

  return html;
}

// 主要函數
function generateRedirects() {
  console.log('開始生成 WordPress 風格文章頁面...\n');

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

    // 生成 index.html（使用完整的文章頁面結構）
    const indexPath = path.join(postDir, 'index.html');
    const html = generatePostHTML(title, slug);
    fs.writeFileSync(indexPath, html, 'utf8');

    console.log(`✅ 已建立：${categorySlug}/${slug}/index.html`);
    createdCount++;
  });

  console.log(`\n完成！共建立 ${createdCount} 個文章頁面`);
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
