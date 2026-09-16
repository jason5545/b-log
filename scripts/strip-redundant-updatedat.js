#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 移除與 publishedAt 完全相同的 updatedAt。
//
// 兩者相同時，這個欄位不帶任何資訊，但會讓 feed.json 的 date_modified、
// 文章靜態頁的 dateModified 與 sitemap.xml 的 lastmod 看起來像被改過。
// 只處理能解析、且與 publishedAt 同一時間點的情況；解析不出來的留著，
// 讓 validate-content.js 去報錯，不靜默刪掉看不懂的資料。

const postsPath = path.join(__dirname, '../data/posts.json');

const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

const stripped = [];
const kept = [];

for (const post of posts) {
  if (!post.updatedAt) continue;

  const updated = Date.parse(post.updatedAt);
  const published = Date.parse(post.publishedAt);

  if (Number.isNaN(updated) || Number.isNaN(published)) {
    kept.push(post.slug);
    continue;
  }

  if (updated === published) {
    delete post.updatedAt;
    stripped.push(post.slug);
  } else {
    kept.push(post.slug);
  }
}

if (stripped.length === 0) {
  console.log('沒有與 publishedAt 相同的 updatedAt。');
  process.exit(0);
}

fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2) + '\n');

console.log(`已移除 ${stripped.length} 筆與 publishedAt 相同的 updatedAt：`);
for (const slug of stripped) console.log(`  - ${slug}`);

if (kept.length > 0) {
  console.log(`保留 ${kept.length} 筆 updatedAt（與 publishedAt 不同，或無法解析）：`);
  for (const slug of kept) console.log(`  - ${slug}`);
}
