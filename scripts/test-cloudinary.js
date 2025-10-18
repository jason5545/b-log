const cloudName = 'dynj7181i';
const publicId = 'og-background_cbst7j';

// 測試文字
const testTexts = [
  'OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲',
  '測試中文顯示',
  'AI 分析'
];

console.log('Cloudinary 中文文字覆蓋測試 URL：\n');

testTexts.forEach((text, index) => {
  // Cloudinary 文字需要進行特殊編碼
  // 1. 先進行 URI 編碼
  const encodedText = encodeURIComponent(text);

  // 2. 構建 Cloudinary URL
  // 使用 Arial Unicode MS 或 WenQuanYi Zen Hei 字型
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `c_fill,w_1200,h_630/` +  // 裁切並調整尺寸
    `co_rgb:ffffff,` +          // 文字顏色：白色
    `l_text:Arial_80_center:${encodedText}/` +  // 文字覆蓋
    `fl_layer_apply,g_center/` + // 文字置中
    `${publicId}.png`;

  console.log(`測試 ${index + 1}: ${text}`);
  console.log(`URL: ${url}\n`);
});

console.log('\n請在瀏覽器中開啟上面的 URL 查看效果。');
console.log('\n如果 Arial 不支援中文，請嘗試以下字型：');
console.log('- WenQuanYi Zen Hei (文泉驛正黑)');
console.log('- Noto Sans TC (需要先上傳到 Cloudinary)');
console.log('\n使用方法：將 URL 中的 "Arial" 替換為 "WenQuanYi%20Zen%20Hei"\n');

// 生成使用 WenQuanYi Zen Hei 的測試 URL
console.log('=== 使用 WenQuanYi Zen Hei 字型的 URL ===\n');
const wenquanyiUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
  `c_fill,w_1200,h_630/` +
  `co_rgb:ffffff,` +
  `l_text:WenQuanYi%20Zen%20Hei_80_center:${encodeURIComponent('測試中文顯示')}/` +
  `fl_layer_apply,g_center/` +
  `${publicId}.png`;

console.log(`測試 URL: ${wenquanyiUrl}\n`);
