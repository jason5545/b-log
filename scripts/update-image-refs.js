/**
 * 自動更新圖片參照為 WebP
 *
 * 功能：
 * - 掃描 Markdown 文章，將圖片路徑直接改為 .webp
 * - 更新 posts.json 和 feed.json 中的封面圖片路徑
 *
 * 使用方式：node scripts/update-image-refs.js
 */

const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  rootDir: path.join(__dirname, '..'),
  postsDir: path.join(__dirname, '..', 'content', 'posts'),
  imgDir: path.join(__dirname, '..', 'content', 'img'),
};

/**
 * 找出所有 Markdown 檔案
 */
function findMarkdownFiles(dir) {
  const files = fs.readdirSync(dir);
  return files
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(dir, file));
}

/**
 * 檢查 WebP 檔案是否存在
 */
function hasWebPVersion(imagePath, markdownDir) {
  const absolutePath = imagePath.startsWith('/')
    ? path.join(CONFIG.rootDir, imagePath.substring(1))
    : path.resolve(markdownDir, imagePath);
  const parsedPath = path.parse(absolutePath);
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);

  return fs.existsSync(webpPath);
}

/**
 * 更新單一 Markdown 檔案中的圖片路徑為 WebP
 */
function updateMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const markdownDir = path.dirname(filePath);
  let updated = false;
  let convertedCount = 0;

  // 匹配 ![alt](path) 格式的圖片
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const newContent = content.replace(imageRegex, (match, alt, imagePath) => {
    // 跳過外部連結
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return match;
    }

    // 跳過已經是 .webp 的路徑
    if (imagePath.endsWith('.webp')) {
      return match;
    }

    // 檢查是否有對應的 WebP 檔案
    if (!hasWebPVersion(imagePath, markdownDir)) {
      return match;
    }

    // 直接替換副檔名為 .webp
    const webpImagePath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    updated = true;
    convertedCount++;
    return `![${alt}](${webpImagePath})`;
  });

  if (updated) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ 已更新: ${path.basename(filePath)}`);
    console.log(`   轉換了 ${convertedCount} 個圖片參照`);
    return { updated: true, count: convertedCount };
  } else {
    console.log(`⏭️  跳過（無需更新）: ${path.basename(filePath)}`);
    return { updated: false };
  }
}

/**
 * 更新 posts.json 和 feed.json 中的封面圖片路徑為 WebP
 */
function updateCoverImageRefs() {
  const postsJsonPath = path.join(CONFIG.rootDir, 'data', 'posts.json');
  const feedJsonPath = path.join(CONFIG.rootDir, 'feed.json');
  let updatedCount = 0;

  // 更新 posts.json 的 coverImage
  if (fs.existsSync(postsJsonPath)) {
    const posts = JSON.parse(fs.readFileSync(postsJsonPath, 'utf8'));
    let postsChanged = false;

    posts.forEach(post => {
      if (!post.coverImage) return;
      const ext = path.extname(post.coverImage).toLowerCase();
      if (ext === '.webp') return;

      // 檢查對應的 WebP 檔案是否存在
      const coverPath = post.coverImage.startsWith('/')
        ? path.join(CONFIG.rootDir, post.coverImage.substring(1))
        : path.join(CONFIG.rootDir, post.coverImage);
      const parsed = path.parse(coverPath);
      const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);

      if (fs.existsSync(webpPath)) {
        post.coverImage = post.coverImage.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        console.log(`✅ posts.json: ${post.slug} coverImage → .webp`);
        postsChanged = true;
        updatedCount++;
      }
    });

    if (postsChanged) {
      fs.writeFileSync(postsJsonPath, JSON.stringify(posts, null, 2) + '\n', 'utf8');
    }
  }

  // 更新 feed.json 的 image
  if (fs.existsSync(feedJsonPath)) {
    const feed = JSON.parse(fs.readFileSync(feedJsonPath, 'utf8'));
    let feedChanged = false;

    (feed.items || []).forEach(item => {
      if (!item.image) return;
      const ext = path.extname(item.image).toLowerCase();
      if (ext === '.webp') return;

      // 從完整 URL 提取路徑來檢查 WebP 檔案
      const urlPath = item.image.replace(/^https?:\/\/[^/]+\//, '');
      const localPath = path.join(CONFIG.rootDir, urlPath);
      const parsed = path.parse(localPath);
      const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);

      if (fs.existsSync(webpPath)) {
        item.image = item.image.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        console.log(`✅ feed.json: ${item.id} image → .webp`);
        feedChanged = true;
        updatedCount++;
      }
    });

    if (feedChanged) {
      fs.writeFileSync(feedJsonPath, JSON.stringify(feed, null, 2) + '\n', 'utf8');
    }
  }

  return updatedCount;
}

/**
 * 主函式
 */
function main() {
  console.log('📝 開始掃描 Markdown 文章...\n');

  // 檢查目錄是否存在
  if (!fs.existsSync(CONFIG.postsDir)) {
    console.log('❌ 文章目錄不存在:', CONFIG.postsDir);
    return;
  }

  // 找出所有 Markdown 檔案
  const markdownFiles = findMarkdownFiles(CONFIG.postsDir);
  console.log(`📁 找到 ${markdownFiles.length} 個 Markdown 檔案\n`);

  if (markdownFiles.length === 0) {
    console.log('沒有需要處理的檔案');
    return;
  }

  // 更新所有檔案
  const results = {
    updated: [],
    skipped: [],
  };

  markdownFiles.forEach(filePath => {
    const result = updateMarkdownFile(filePath);

    if (result.updated) {
      results.updated.push({ path: filePath, count: result.count });
    } else {
      results.skipped.push(filePath);
    }
  });

  // 更新 posts.json 和 feed.json 中的封面圖片路徑
  console.log('\n📋 檢查封面圖片路徑...\n');
  const coverUpdated = updateCoverImageRefs();

  // 顯示統計
  console.log('\n' + '='.repeat(50));
  console.log('📊 更新統計');
  console.log('='.repeat(50));
  console.log(`✅ 已更新: ${results.updated.length} 個 Markdown 檔案`);
  console.log(`⏭️  已跳過: ${results.skipped.length} 個 Markdown 檔案`);

  if (results.updated.length > 0) {
    const totalConverted = results.updated.reduce((sum, r) => sum + r.count, 0);
    console.log(`\n🖼️  總共轉換了 ${totalConverted} 個圖片參照`);
  }

  if (coverUpdated > 0) {
    console.log(`📋 更新了 ${coverUpdated} 個封面圖片路徑為 WebP`);
  }

  console.log('='.repeat(50));
}

// 執行
main();
