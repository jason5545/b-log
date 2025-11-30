/**
 * 同步 feed.json 與 posts.json
 * 確保 feed.json 包含所有文章，並使用正確的 URL 格式
 */

const fs = require('fs');
const path = require('path');

const POSTS_PATH = path.join(__dirname, '../data/posts.json');
const FEED_PATH = path.join(__dirname, '../feed.json');

const categoryMapping = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy',
  '生活記事': 'life-stories',
  '商業觀察': 'business-insights',
  '文化觀察': 'cultural-insights'
};

function generateUrl(slug, category) {
  const catSlug = categoryMapping[category] || 'uncategorized';
  return `https://b-log.to/${catSlug}/${slug}/`;
}

function createFeedItem(post) {
  const item = {
    id: post.slug,
    url: generateUrl(post.slug, post.category),
    title: post.title,
    content_text: post.summary,
    date_published: new Date(post.publishedAt).toISOString(),
    date_modified: new Date(post.updatedAt || post.publishedAt).toISOString(),
    tags: post.tags || [],
    authors: [{ name: post.author || 'Jason Chien' }]
  };

  // 如果有封面圖片，添加 image 欄位
  if (post.coverImage) {
    item.image = post.coverImage.startsWith('http')
      ? post.coverImage
      : `https://b-log.to${post.coverImage}`;
  }

  return item;
}

function main() {
  // 讀取檔案
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'));
  const feed = JSON.parse(fs.readFileSync(FEED_PATH, 'utf-8'));

  // 建立現有 feed items 的 id 集合
  const existingIds = new Set(feed.items.map(item => item.id));

  // 找出缺少的文章
  const missingPosts = posts.filter(post => !existingIds.has(post.slug));

  // 統計
  let added = 0;
  let urlUpdated = 0;

  // 添加缺少的文章
  if (missingPosts.length > 0) {
    console.log(`發現 ${missingPosts.length} 篇缺少的文章：`);

    missingPosts.forEach(post => {
      console.log(`  + ${post.slug}`);
      const newItem = createFeedItem(post);
      feed.items.unshift(newItem); // 添加到開頭
      added++;
    });
  }

  // 建立 posts 的 slug -> category 映射
  const postCategoryMap = {};
  posts.forEach(post => {
    postCategoryMap[post.slug] = post.category;
  });

  // 檢查並更新所有 URL 格式
  feed.items.forEach(item => {
    const category = postCategoryMap[item.id];
    if (category) {
      const correctUrl = generateUrl(item.id, category);
      if (item.url !== correctUrl) {
        console.log(`  URL 更新: ${item.id}`);
        item.url = correctUrl;
        urlUpdated++;
      }
    }
  });

  // 按發布日期排序（最新的在前）
  feed.items.sort((a, b) => {
    return new Date(b.date_published) - new Date(a.date_published);
  });

  // 寫回檔案
  if (added > 0 || urlUpdated > 0) {
    fs.writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2));
    console.log(`\n完成：新增 ${added} 篇文章，更新 ${urlUpdated} 個 URL`);
  } else {
    console.log('feed.json 已是最新，無需更新');
  }
}

main();
