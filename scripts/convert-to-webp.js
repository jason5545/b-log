/**
 * 自動將 content/img/ 目錄下的圖片轉換為 WebP 格式
 *
 * 功能：
 * - 掃描所有 .jpg, .jpeg, .png, .svg 檔案
 * - 檢查是否已有對應的 .webp 檔案
 * - 使用 sharp 進行高品質轉換
 * - 保留原始檔案（作為降級方案）
 *
 * 使用方式：node scripts/convert-to-webp.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 設定
const CONFIG = {
  imgDir: path.join(__dirname, '..', 'content', 'img'),
  quality: 85,
  alphaQuality: 85,
  method: 6, // 0-6，數字越大壓縮越好但越慢
  supportedFormats: ['.jpg', '.jpeg', '.png', '.svg'],
};

/**
 * 遞迴掃描目錄，找出所有圖片檔案
 */
function findImages(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findImages(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (CONFIG.supportedFormats.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * 轉換單一圖片為 WebP
 */
async function convertToWebP(imagePath) {
  const parsedPath = path.parse(imagePath);
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);
  const isSvg = parsedPath.ext.toLowerCase() === '.svg';
  const webpExists = fs.existsSync(webpPath);

  // SVG 封面可能是用來替換既有封面，必須覆寫對應的 WebP
  if (webpExists && !isSvg) {
    console.log(`⏭️  跳過（已存在）: ${path.relative(CONFIG.imgDir, webpPath)}`);
    return { skipped: true };
  }

  try {
    const source = isSvg
      ? sharp(imagePath, { density: 300 }).resize({ width: 1600 })
      : sharp(imagePath);
    const info = await source
      .webp({
        quality: CONFIG.quality,
        alphaQuality: CONFIG.alphaQuality,
        method: CONFIG.method,
      })
      .toFile(webpPath);

    const originalSize = fs.statSync(imagePath).size;
    const webpSize = info.size;
    const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);

    console.log(`✅ ${webpExists ? '已覆寫' : '已轉換'}: ${path.relative(CONFIG.imgDir, imagePath)}`);
    console.log(`   → ${path.relative(CONFIG.imgDir, webpPath)}`);
    console.log(`   原始: ${(originalSize / 1024).toFixed(1)} KB → WebP: ${(webpSize / 1024).toFixed(1)} KB (減少 ${savings}%)`);

    return {
      converted: true,
      originalPath: imagePath,
      webpPath,
      originalSize,
      webpSize,
      savings: parseFloat(savings)
    };
  } catch (error) {
    console.error(`❌ 轉換失敗: ${imagePath}`);
    console.error(`   錯誤: ${error.message}`);
    return { error: true };
  }
}

/**
 * 主函式
 */
async function main() {
  console.log('🖼️  開始掃描圖片...\n');

  // 檢查目錄是否存在
  if (!fs.existsSync(CONFIG.imgDir)) {
    console.log('❌ 圖片目錄不存在:', CONFIG.imgDir);
    return;
  }

  // 找出所有圖片
  const images = findImages(CONFIG.imgDir);
  console.log(`📁 找到 ${images.length} 個圖片檔案\n`);

  if (images.length === 0) {
    console.log('沒有需要處理的圖片');
    return;
  }

  // 轉換所有圖片
  const results = {
    converted: [],
    skipped: [],
    errors: [],
  };

  for (const imagePath of images) {
    const result = await convertToWebP(imagePath);

    if (result.converted) {
      results.converted.push(result);
    } else if (result.skipped) {
      results.skipped.push(imagePath);
    } else if (result.error) {
      results.errors.push(imagePath);
    }
  }

  // 顯示統計
  console.log('\n' + '='.repeat(50));
  console.log('📊 轉換統計');
  console.log('='.repeat(50));
  console.log(`✅ 已轉換: ${results.converted.length} 個`);
  console.log(`⏭️  已跳過: ${results.skipped.length} 個`);
  console.log(`❌ 轉換失敗: ${results.errors.length} 個`);

  if (results.converted.length > 0) {
    const totalOriginal = results.converted.reduce((sum, r) => sum + r.originalSize, 0);
    const totalWebP = results.converted.reduce((sum, r) => sum + r.webpSize, 0);
    const totalSavings = ((1 - totalWebP / totalOriginal) * 100).toFixed(1);

    console.log(`\n💾 總節省空間: ${((totalOriginal - totalWebP) / 1024).toFixed(1)} KB (${totalSavings}%)`);
  }

  console.log('='.repeat(50));
}

// 執行
main().catch(console.error);
