const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const AUDIO_DIR = path.join(__dirname, '../content/audio');
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const SEGMENT_DURATION_MINUTES = 10; // 每段 10 分鐘

/**
 * 尋找 ffmpeg 和 ffprobe 的路徑
 */
function findFFmpeg() {
  // 常見的 ffmpeg 安裝位置
  const possiblePaths = [
    // WinGet 安裝路徑
    path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0-full_build/bin'),
    // 標準安裝路徑
    'C:/ffmpeg/bin',
    'C:/Program Files/ffmpeg/bin',
    'C:/Program Files (x86)/ffmpeg/bin',
  ];

  // 首先嘗試從 PATH 執行
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' };
  } catch (error) {
    // PATH 中找不到，嘗試絕對路徑
    for (const dir of possiblePaths) {
      const ffmpegPath = path.join(dir, 'ffmpeg.exe');
      const ffprobePath = path.join(dir, 'ffprobe.exe');

      if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
        console.log(`✅ 找到 ffmpeg：${ffmpegPath}`);
        return {
          ffmpeg: `"${ffmpegPath}"`,
          ffprobe: `"${ffprobePath}"`
        };
      }
    }
  }

  throw new Error('找不到 ffmpeg！請執行：winget install Gyan.FFmpeg');
}

// 全域 ffmpeg 路徑
let FFMPEG_PATHS;
try {
  FFMPEG_PATHS = findFFmpeg();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

/**
 * 取得音訊檔案的時長（秒）
 */
function getAudioDuration(filePath) {
  try {
    const output = execSync(
      `${FFMPEG_PATHS.ffprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(output.trim());
  } catch (error) {
    console.error(`❌ 無法取得檔案時長：${path.basename(filePath)}`);
    return null;
  }
}

/**
 * 分割音訊檔案
 */
function splitAudioFile(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const fileExt = path.extname(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log(`\n📦 處理檔案：${path.basename(filePath)}`);
  console.log(`   大小：${fileSizeMB} MB`);

  // 取得音訊時長
  const duration = getAudioDuration(filePath);
  if (!duration) {
    return;
  }

  const durationMinutes = (duration / 60).toFixed(1);
  console.log(`   時長：${durationMinutes} 分鐘`);

  // 計算需要分割成幾段
  const estimatedSegments = Math.ceil(fileSize / MAX_SIZE_BYTES);
  const segmentDuration = Math.ceil(duration / estimatedSegments);

  console.log(`   預計分割：${estimatedSegments} 段`);
  console.log(`   每段時長：約 ${Math.floor(segmentDuration / 60)} 分鐘`);

  // 建立輸出目錄
  const outputDir = path.join(AUDIO_DIR, 'parts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 分割音訊
  try {
    // 使用 ffmpeg 的 segment muxer 分割
    // -f segment: 使用分段格式
    // -segment_time: 每段的秒數
    // -c copy: 不重新編碼，直接複製（快速且無損）
    // -reset_timestamps 1: 重設每段的時間戳
    const outputPattern = path.join(outputDir, `${fileName}-part%d${fileExt}`);

    console.log(`\n🔧 執行分割...`);

    execSync(
      `${FFMPEG_PATHS.ffmpeg} -i "${filePath}" -f segment -segment_time ${segmentDuration} -c copy -reset_timestamps 1 "${outputPattern}"`,
      { stdio: 'inherit' }
    );

    // 檢查生成的檔案
    const parts = fs.readdirSync(outputDir)
      .filter(f => f.startsWith(fileName) && f.includes('-part'))
      .sort();

    console.log(`\n✅ 分割完成！生成 ${parts.length} 個檔案：`);
    parts.forEach((part, index) => {
      const partPath = path.join(outputDir, part);
      const partSize = (fs.statSync(partPath).size / 1024 / 1024).toFixed(2);
      console.log(`   ${index + 1}. ${part} (${partSize} MB)`);

      // 將檔案移回主目錄
      const targetPath = path.join(AUDIO_DIR, part);
      fs.renameSync(partPath, targetPath);
    });

    // 刪除臨時目錄
    if (fs.existsSync(outputDir)) {
      fs.rmdirSync(outputDir);
    }

    // 將原始檔案移到備份目錄
    const backupDir = path.join(AUDIO_DIR, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, path.basename(filePath));
    fs.renameSync(filePath, backupPath);
    console.log(`\n📁 原始檔案已移至：backup/${path.basename(filePath)}`);

    // 提示更新 Markdown
    console.log(`\n📝 請更新 Markdown 標記：`);
    console.log(`   從：<!-- audio: ${path.basename(filePath)} -->`);
    console.log(`   改為：<!-- audio: ${fileName}-part*.m4a -->`);

  } catch (error) {
    console.error(`\n❌ 分割失敗：${error.message}`);
  }
}

/**
 * 主函數
 */
function main() {
  console.log('🎵 音訊檔案分割工具\n');
  console.log(`📂 掃描目錄：${AUDIO_DIR}`);
  console.log(`📏 大小限制：${MAX_SIZE_MB} MB\n`);

  if (!fs.existsSync(AUDIO_DIR)) {
    console.error(`❌ 錯誤：找不到目錄 ${AUDIO_DIR}`);
    process.exit(1);
  }

  // 掃描所有音訊檔案
  const files = fs.readdirSync(AUDIO_DIR)
    .filter(f => f.endsWith('.m4a') && !f.includes('-part'))
    .map(f => ({
      name: f,
      path: path.join(AUDIO_DIR, f),
      size: fs.statSync(path.join(AUDIO_DIR, f)).size
    }));

  console.log(`找到 ${files.length} 個音訊檔案\n`);

  // 找出需要分割的檔案
  const largeFiles = files.filter(f => f.size > MAX_SIZE_BYTES);

  if (largeFiles.length === 0) {
    console.log('✅ 所有檔案都在大小限制內，無需分割');
    return;
  }

  console.log(`⚠️  發現 ${largeFiles.length} 個超過 ${MAX_SIZE_MB} MB 的檔案：\n`);
  largeFiles.forEach(f => {
    const sizeMB = (f.size / 1024 / 1024).toFixed(2);
    console.log(`   - ${f.name} (${sizeMB} MB)`);
  });

  // 分割每個大檔案
  largeFiles.forEach(f => {
    splitAudioFile(f.path);
  });

  console.log(`\n✨ 完成！`);
}

// 執行腳本
try {
  main();
} catch (error) {
  console.error('❌ 錯誤：', error.message);
  process.exit(1);
}
