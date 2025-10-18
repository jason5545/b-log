/**
 * 自動更新 Markdown 文章中的圖片參照為 <picture> 標籤
 *
 * 功能：
 * - 掃描所有 Markdown 文章
 * - 找出 ![alt](path) 格式的圖片
 * - 如果有對應的 .webp 檔案，轉換為 <picture> 標籤
 * - 提供 WebP + 原始格式的降級方案
 *
 * 使用方式：node scripts/update-image-refs.js
 */

const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
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
  // 將相對路徑轉換為絕對路徑
  const absolutePath = path.resolve(markdownDir, imagePath);
  const parsedPath = path.parse(absolutePath);
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);

  return fs.existsSync(webpPath);
}

/**
 * 將 Markdown 圖片語法轉換為 <picture> 標籤
 */
function convertToPictureTag(match, alt, imagePath, markdownDir) {
  const parsedPath = path.parse(imagePath);
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);

  // 檢查 WebP 是否存在
  if (!hasWebPVersion(imagePath, markdownDir)) {
    return match; // 沒有 WebP 版本，保持原樣
  }

  // 正規化路徑：將反斜線轉換為正斜線（Web 標準）
  const normalizedWebpPath = webpPath.replace(/\\/g, '/');
  const normalizedImagePath = imagePath.replace(/\\/g, '/');

  // 生成 <picture> 標籤
  return `<picture>
  <source srcset="${normalizedWebpPath}" type="image/webp">
  <img src="${normalizedImagePath}" alt="${alt}" loading="lazy">
</picture>`;
}

/**
 * 更新單一 Markdown 檔案
 */
function updateMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const markdownDir = path.dirname(filePath);
  let updated = false;
  let convertedCount = 0;

  // 正則表達式：匹配 ![alt](path) 格式
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const newContent = content.replace(imageRegex, (match, alt, imagePath) => {
    // 跳過外部連結
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return match;
    }

    // 檢查是否已經是 <picture> 標籤（避免重複處理）
    const contextBefore = content.substring(Math.max(0, content.indexOf(match) - 100), content.indexOf(match));
    if (contextBefore.includes('<picture>')) {
      return match;
    }

    const result = convertToPictureTag(match, alt, imagePath, markdownDir);
    if (result !== match) {
      updated = true;
      convertedCount++;
    }

    return result;
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

  // 顯示統計
  console.log('\n' + '='.repeat(50));
  console.log('📊 更新統計');
  console.log('='.repeat(50));
  console.log(`✅ 已更新: ${results.updated.length} 個檔案`);
  console.log(`⏭️  已跳過: ${results.skipped.length} 個檔案`);

  if (results.updated.length > 0) {
    const totalConverted = results.updated.reduce((sum, r) => sum + r.count, 0);
    console.log(`\n🖼️  總共轉換了 ${totalConverted} 個圖片參照`);
  }

  console.log('='.repeat(50));
}

// 執行
main();
