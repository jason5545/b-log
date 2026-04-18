const fs = require('fs');
const path = require('path');
const terser = require('terser');
const CleanCSS = require('clean-css');

const ROOT_DIR = path.join(__dirname, '..');
const JS_TARGETS = [
  ['assets/main.js', 'assets/main.min.js'],
  ['assets/main-static.js', 'assets/main-static.min.js']
];
const CSS_TARGETS = [
  ['assets/styles.css', 'assets/styles.min.css']
];

function resolvePath(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

async function minifyJs(inputRelativePath, outputRelativePath) {
  const inputPath = resolvePath(inputRelativePath);
  const outputPath = resolvePath(outputRelativePath);
  const source = fs.readFileSync(inputPath, 'utf8');
  const result = await terser.minify(source, {
    module: true,
    compress: {
      passes: 2,
    },
    mangle: true,
    format: {
      comments: false,
    },
  });

  if (!result.code) {
    throw new Error(`無法壓縮 ${inputRelativePath}`);
  }

  fs.writeFileSync(outputPath, `${result.code}\n`, 'utf8');
  console.log(`✅ 已同步 ${outputRelativePath}`);
}

function minifyCss(inputRelativePath, outputRelativePath) {
  const inputPath = resolvePath(inputRelativePath);
  const outputPath = resolvePath(outputRelativePath);
  const source = fs.readFileSync(inputPath, 'utf8');
  const result = new CleanCSS({ level: 2 }).minify(source);

  if (result.errors.length > 0) {
    throw new Error(result.errors.join('\n'));
  }

  fs.writeFileSync(outputPath, `${result.styles}\n`, 'utf8');
  console.log(`✅ 已同步 ${outputRelativePath}`);
}

async function main() {
  for (const [inputPath, outputPath] of JS_TARGETS) {
    await minifyJs(inputPath, outputPath);
  }

  for (const [inputPath, outputPath] of CSS_TARGETS) {
    minifyCss(inputPath, outputPath);
  }
}

main().catch((error) => {
  console.error('❌ 建置 minified assets 失敗：', error);
  process.exit(1);
});
