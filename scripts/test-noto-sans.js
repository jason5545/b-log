const cloudName = 'dynj7181i';
const publicId = 'og-background_cbst7j';

// 測試不同的 Noto Sans TC 字型名稱格式
const fontFormats = [
  'Noto Sans TC',
  'Noto%20Sans%20TC',
  'NotoSansTC',
  'notosanstc'
];

console.log('測試 Noto Sans TC 字型的不同格式：\n');

fontFormats.forEach((font, index) => {
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/` +
    `c_fill,w_1200,h_630/` +
    `co_rgb:ffffff,` +
    `l_text:${font}_80_center:測試中文顯示/` +
    `fl_layer_apply,g_center/` +
    `${publicId}.png`;

  console.log(`測試 ${index + 1}: ${font}`);
  console.log(`URL: ${url}\n`);
});

console.log('\n請在瀏覽器中測試上面的 URL。');
console.log('如果都無法顯示，則需要上傳 Noto Sans TC 字型檔。');
