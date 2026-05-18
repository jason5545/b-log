const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_PATH = path.join(ROOT_DIR, 'data/posts.json');
const RESPONSIVE_WIDTHS = [480, 828, 1200];
const FORCE = process.argv.includes('--force');

function imageUrlToPath(imageUrl) {
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) return null;
  return path.join(ROOT_DIR, imageUrl.replace(/^\//, ''));
}

function getVariantPath(imagePath, width) {
  const parsed = path.parse(imagePath);
  return path.join(parsed.dir, `${parsed.name}-${width}w${parsed.ext}`);
}

function variantNeedsUpdate(imagePath, variantPath) {
  if (FORCE || !fs.existsSync(variantPath)) return true;

  const sourceStat = fs.statSync(imagePath);
  const variantStat = fs.statSync(variantPath);
  return sourceStat.mtimeMs > variantStat.mtimeMs;
}

async function generateVariant(imagePath, width, sourceWidth) {
  const variantPath = getVariantPath(imagePath, width);
  const existed = fs.existsSync(variantPath);
  if (sourceWidth <= width || !variantNeedsUpdate(imagePath, variantPath)) return false;

  await sharp(imagePath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 82, method: 6 })
    .toFile(variantPath);

  console.log(`✅ 已${existed ? '更新' : '產生'} ${path.relative(ROOT_DIR, variantPath)}`);
  return true;
}

async function main() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
  const coverImages = new Set(posts.map((post) => post.coverImage).filter(Boolean));
  let generatedCount = 0;

  for (const coverImage of coverImages) {
    const imagePath = imageUrlToPath(coverImage);
    if (!imagePath || !fs.existsSync(imagePath)) continue;

    const ext = path.extname(imagePath).toLowerCase();
    if (ext !== '.webp') continue;

    const metadata = await sharp(imagePath).metadata();
    if (!metadata.width) continue;

    for (const width of RESPONSIVE_WIDTHS) {
      if (await generateVariant(imagePath, width, metadata.width)) {
        generatedCount++;
      }
    }
  }

  if (generatedCount === 0) {
    console.log('✅ 回應式圖片變體已是最新');
  } else {
    console.log(`完成！共產生 ${generatedCount} 個回應式圖片變體`);
  }
}

main().catch((error) => {
  console.error('❌ 產生回應式圖片失敗：', error);
  process.exit(1);
});
