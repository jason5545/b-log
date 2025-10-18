const cloudName = 'dynj7181i';
const publicId = 'og-background_cbst7j';
const fontPublicId = 'notosanstc-bold.ttf';

// 測試不同的文字排版配置
const testConfigs = [
  {
    name: '配置 1：限制寬度 + 自動換行 (w_1000)',
    fontSize: 60,
    width: 1000,
    params: 'c_fit'
  },
  {
    name: '配置 2：較小字號 + 較寬範圍 (w_1100)',
    fontSize: 55,
    width: 1100,
    params: 'c_fit'
  },
  {
    name: '配置 3：最保守配置 (w_950)',
    fontSize: 50,
    width: 950,
    params: 'c_fit'
  }
];

const longTitle = 'OpenAI的矛盾：一邊降溫一邊加熱的危險遊戲';
const encodedTitle = encodeURIComponent(longTitle);

console.log('測試不同的文字排版配置（避免白邊）：\n');

testConfigs.forEach((config, index) => {
  // Cloudinary 文字覆蓋 URL，加入寬度限制和自動換行
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `c_fill,w_1200,h_630/` +
    `co_rgb:ffffff,` +
    `l_text:${fontPublicId}_${config.fontSize}_center:${encodedTitle},w_${config.width},${config.params}/` +
    `fl_layer_apply,g_center/` +
    `${publicId}.png`;

  console.log(`${config.name}`);
  console.log(`字型大小: ${config.fontSize}px, 文字寬度: ${config.width}px`);
  console.log(`URL: ${url}\n`);
});

console.log('=== 說明 ===');
console.log('- w_1000 = 限制文字區域寬度為 1000px（左右各留 100px 空白）');
console.log('- c_fit = 文字自動縮放以適應指定寬度');
console.log('- 文字會自動換行，避免超出圖片邊界\n');

console.log('請在瀏覽器中測試上面的 URL，選擇最合適的配置！');
