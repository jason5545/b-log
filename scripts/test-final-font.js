const cloudName = 'dynj7181i';
const publicId = 'og-background_cbst7j';
const fontPublicId = 'notosanstc-bold.ttf';

// 測試文字
const testTexts = [
  { text: '測試中文顯示', size: 80 },
  { text: 'OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲', size: 60 },
  { text: 'AI 分析', size: 100 }
];

console.log('使用正確格式的 Noto Sans TC Bold 字型測試：\n');

testTexts.forEach((item, index) => {
  const encodedText = encodeURIComponent(item.text);

  // 使用自訂字型的正確格式
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `c_fill,w_1200,h_630/` +
    `co_rgb:ffffff,` +
    `l_text:${fontPublicId}_${item.size}_center:${encodedText}/` +
    `fl_layer_apply,g_center/` +
    `${publicId}.png`;

  console.log(`測試 ${index + 1}: ${item.text}`);
  console.log(`字型大小: ${item.size}px`);
  console.log(`URL: ${url}\n`);
});

console.log('\n=== 推薦使用的配置 ===\n');

// 生成最終推薦的 URL 格式
const recommendedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
  `c_fill,w_1200,h_630/` +
  `co_rgb:ffffff,` +
  `l_text:${fontPublicId}_70_center:${encodeURIComponent('測試中文顯示')}/` +
  `fl_layer_apply,g_center/` +
  `${publicId}.png`;

console.log('推薦 URL:');
console.log(recommendedUrl);
console.log('\n請複製上面的 URL 到瀏覽器測試！');
