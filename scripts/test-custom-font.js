const cloudName = 'dynj7181i';
const publicId = 'og-background_cbst7j';
const fontPublicId = 'NotoSansTC-Bold_i1elwz';

// 測試文字
const testTexts = [
  { text: '測試中文顯示', size: 80 },
  { text: 'OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲', size: 60 },
  { text: 'AI 分析', size: 100 }
];

console.log('使用自訂 Noto Sans TC Bold 字型的測試 URL：\n');

testTexts.forEach((item, index) => {
  const encodedText = encodeURIComponent(item.text);

  // 使用自訂字型的 Cloudinary URL 格式
  // 格式：l_text:{fontPublicId.ttf}_{size}_{alignment}:{text}
  const url = `https://res.cloudinary.com/dynj7181i/image/upload/` +
    `c_fill,w_1200,h_630/` +
    `co_rgb:ffffff,` +
    `l_text:${fontPublicId}.ttf_${item.size}_center:${encodedText}/` +
    `fl_layer_apply,g_center/` +
    `${publicId}.png`;

  console.log(`測試 ${index + 1}: ${item.text}`);
  console.log(`字型大小: ${item.size}px`);
  console.log(`URL: ${url}\n`);
});

console.log('\n=== 長文字測試（自動換行）===\n');

// 測試長標題，需要調整佈局
const longTitle = 'OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲';
const encodedLongTitle = encodeURIComponent(longTitle);

// 使用較小字號和文字框寬度限制
const longTitleUrl = `https://res.cloudinary.com/dynj7181i/image/upload/` +
  `c_fill,w_1200,h_630/` +
  `co_rgb:ffffff,` +
  `l_text:${fontPublicId}.ttf_70_center:${encodedLongTitle},w_1100,c_fit/` +
  `fl_layer_apply,g_center/` +
  `${publicId}.png`;

console.log(`長標題測試:`);
console.log(`URL: ${longTitleUrl}\n`);

console.log('=== 說明 ===');
console.log('- 使用自訂字型格式：{fontPublicId}.ttf_{size}_{alignment}');
console.log('- w_1100,c_fit 用於限制文字寬度並自動換行');
console.log('- 請在瀏覽器中測試上面的 URL\n');
