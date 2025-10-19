const POSTS_JSON = '/data/posts.json';
const POSTS_ROOT = '/content/posts/';
const GITHUB_USERNAME = 'jason5545';
const GITHUB_REPO = 'b-log';
// 全域變數儲存分類映射（從設定檔載入）
let categoryMapping = null;

// 載入分類設定
async function loadCategoryMapping() {
  if (categoryMapping) return categoryMapping;
  
  try {
    const response = await fetch('/config/categories.json');
    const config = await response.json();
    categoryMapping = config.categoryMapping;
    return categoryMapping;
  } catch (error) {
    console.error('無法載入分類設定，使用預設值', error);
    // 降級方案：使用硬編碼的映射
    categoryMapping = {
      'AI 分析': 'ai-analysis',
      '技術開發': 'tech-development',
      '技術分析': 'tech-analysis',
      '開發哲學': 'dev-philosophy',
      '生活記事': 'life-stories'
    };
    return categoryMapping;
  }
}


// Decode all network responses as UTF-8 to keep non-ASCII content intact.
async function readUtf8Text(response) {
  try {
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`UTF-8 decode failed: ${message}`);
  }
}

// 深色模式管理
const ThemeManager = {
  STORAGE_KEY: 'theme-preference',
  THEMES: ['light', 'dark', 'auto'],

  init() {
    // 從 localStorage 載入偏好，預設為 auto
    const saved = localStorage.getItem(this.STORAGE_KEY) || 'auto';
    this.setTheme(saved, false);

    // 監聽系統深色模式變化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.getCurrentTheme() === 'auto') {
        this.applyTheme();
      }
    });
  },

  getCurrentTheme() {
    return localStorage.getItem(this.STORAGE_KEY) || 'auto';
  },

  setTheme(theme, save = true) {
    if (!this.THEMES.includes(theme)) {
      theme = 'auto';
    }

    if (save) {
      localStorage.setItem(this.STORAGE_KEY, theme);
    }

    this.applyTheme();
    this.updateToggleButton();
  },

  applyTheme() {
    const currentTheme = this.getCurrentTheme();
    const root = document.documentElement;

    if (currentTheme === 'auto') {
      // 移除 data-theme 屬性，讓 CSS 的 @media (prefers-color-scheme: dark) 生效
      root.removeAttribute('data-theme');
    } else {
      // 設定 data-theme 屬性
      root.setAttribute('data-theme', currentTheme);
    }
  },

  toggle() {
    const current = this.getCurrentTheme();
    const currentIndex = this.THEMES.indexOf(current);
    const nextIndex = (currentIndex + 1) % this.THEMES.length;
    const nextTheme = this.THEMES[nextIndex];

    this.setTheme(nextTheme);
  },

  updateToggleButton() {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;

    const currentTheme = this.getCurrentTheme();
    const icon = button.querySelector('.theme-toggle__icon');
    const text = button.querySelector('.theme-toggle__text');

    const configs = {
      light: { icon: '☀️', text: '淺色' },
      dark: { icon: '🌙', text: '深色' },
      auto: { icon: '🔄', text: '自動' }
    };

    const config = configs[currentTheme] || configs.auto;

    if (icon) icon.textContent = config.icon;
    if (text) text.textContent = config.text;
  },

  getThemeIcon(theme) {
    const icons = {
      light: '☀️',
      dark: '🌙',
      auto: '🔄'
    };
    return icons[theme] || icons.auto;
  },

  getThemeText(theme) {
    const texts = {
      light: '淺色',
      dark: '深色',
      auto: '自動'
    };
    return texts[theme] || texts.auto;
  }
};

// 生成語音播放器 HTML
function generateAudioPlayerHTML(audioFile) {
  return `<div class="audio-player" data-audio-file="${audioFile}">
  <audio preload="metadata">
    <source src="/content/audio/${audioFile}" type="audio/mp4">
    您的瀏覽器不支援音訊播放。
  </audio>
  <div class="audio-controls">
    <button class="audio-btn play-pause" aria-label="播放/暫停">
      <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
      </svg>
    </button>
    <div class="audio-progress-container">
      <input type="range" class="audio-progress" min="0" max="100" value="0" step="0.1" aria-label="播放進度">
      <div class="audio-time">
        <span class="current-time">0:00</span>
        <span class="duration">0:00</span>
      </div>
      <div class="playlist-info" style="display:none; font-size:0.75rem; color:var(--text-secondary, #666); margin-top:0.25rem;">
        片段 <span class="current-part">1</span> / <span class="total-parts">1</span>
      </div>
    </div>
    <div class="audio-speed">
      <button class="speed-btn" aria-label="播放速度">1.0x</button>
      <div class="speed-menu" style="display:none">
        <button data-speed="0.75">0.75x</button>
        <button data-speed="1.0" class="active">1.0x</button>
        <button data-speed="1.25">1.25x</button>
        <button data-speed="1.5">1.5x</button>
        <button data-speed="2.0">2.0x</button>
      </div>
    </div>
    <div class="audio-volume">
      <button class="volume-btn" aria-label="音量">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
      </button>
      <input type="range" class="volume-slider" min="0" max="100" value="100" aria-label="音量控制">
    </div>
  </div>
</div>`;
}

// 語音播放器管理
const AudioPlayerManager = {
  STORAGE_KEY_PREFIX: 'audio-player-',

  init() {
    const audioPlayer = document.querySelector('.audio-player');
    if (!audioPlayer) return;

    const audio = audioPlayer.querySelector('audio');
    if (!audio) return;

    // 取得播放器元素
    const playPauseBtn = audioPlayer.querySelector('.play-pause');
    const playIcon = audioPlayer.querySelector('.play-icon');
    const pauseIcon = audioPlayer.querySelector('.pause-icon');
    const progressBar = audioPlayer.querySelector('.audio-progress');
    const currentTimeEl = audioPlayer.querySelector('.current-time');
    const durationEl = audioPlayer.querySelector('.duration');
    const speedBtn = audioPlayer.querySelector('.speed-btn');
    const speedMenu = audioPlayer.querySelector('.speed-menu');
    const speedOptions = speedMenu.querySelectorAll('[data-speed]');
    const volumeBtn = audioPlayer.querySelector('.volume-btn');
    const volumeSlider = audioPlayer.querySelector('.volume-slider');

    // 取得當前文章的 slug 作為儲存鍵值
    const urlObj = new URL(window.location.href);
    const slug = extractSlugFromUrl(urlObj);
    const storageKey = this.STORAGE_KEY_PREFIX + slug;

    // 從 localStorage 載入播放速度
    const savedSpeed = localStorage.getItem(storageKey + '-speed');
    if (savedSpeed) {
      audio.playbackRate = parseFloat(savedSpeed);
      speedBtn.textContent = savedSpeed + 'x';
      speedOptions.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.speed === savedSpeed);
      });
    }

    // 從 localStorage 載入音量
    const savedVolume = localStorage.getItem('audio-volume');
    if (savedVolume) {
      audio.volume = parseFloat(savedVolume);
      volumeSlider.value = parseFloat(savedVolume) * 100;
    }

    // 從 localStorage 載入播放進度
    const savedTime = localStorage.getItem(storageKey + '-time');
    if (savedTime && parseFloat(savedTime) > 0) {
      audio.currentTime = parseFloat(savedTime);
    }

    // 播放/暫停
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(error => {
          console.error('播放失敗：', error);
        });
      } else {
        audio.pause();
      }
    });

    // 更新播放/暫停圖示
    audio.addEventListener('play', () => {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    });

    audio.addEventListener('pause', () => {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    });

    // 更新進度條
    audio.addEventListener('timeupdate', () => {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = percent;
      currentTimeEl.textContent = this.formatTime(audio.currentTime);

      // 每 5 秒儲存一次進度
      if (Math.floor(audio.currentTime) % 5 === 0) {
        localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
      }
    });

    // 載入後顯示總時長
    audio.addEventListener('loadedmetadata', () => {
      durationEl.textContent = this.formatTime(audio.duration);
    });

    // 如果已經載入，直接顯示
    if (audio.duration) {
      durationEl.textContent = this.formatTime(audio.duration);
    }

    // 拖曳進度條
    progressBar.addEventListener('input', () => {
      const time = (progressBar.value / 100) * audio.duration;
      audio.currentTime = time;
    });

    // 播放結束時重置進度
    audio.addEventListener('ended', () => {
      localStorage.removeItem(storageKey + '-time');
      progressBar.value = 0;
    });

    // 速度控制選單
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.style.display = speedMenu.style.display === 'none' ? 'block' : 'none';
    });

    // 點選速度選項
    speedOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const speed = opt.dataset.speed;
        audio.playbackRate = parseFloat(speed);
        speedBtn.textContent = speed + 'x';
        localStorage.setItem(storageKey + '-speed', speed);

        // 更新選中狀態
        speedOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        speedMenu.style.display = 'none';
      });
    });

    // 點選其他地方關閉選單
    document.addEventListener('click', () => {
      speedMenu.style.display = 'none';
    });

    // 音量控制
    volumeSlider.addEventListener('input', () => {
      const volume = volumeSlider.value / 100;
      audio.volume = volume;
      localStorage.setItem('audio-volume', volume.toString());

      // 更新音量圖示
      this.updateVolumeIcon(volumeBtn, volume);
    });

    // 音量按鈕切換靜音
    volumeBtn.addEventListener('click', () => {
      if (audio.volume > 0) {
        audio.dataset.previousVolume = audio.volume.toString();
        audio.volume = 0;
        volumeSlider.value = 0;
      } else {
        const previousVolume = parseFloat(audio.dataset.previousVolume || '1');
        audio.volume = previousVolume;
        volumeSlider.value = previousVolume * 100;
      }
      this.updateVolumeIcon(volumeBtn, audio.volume);
    });

    // 初始化音量圖示
    this.updateVolumeIcon(volumeBtn, audio.volume);

    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      // 如果焦點在輸入框中，忽略快捷鍵
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // 空白鍵：播放/暫停
      if (e.code === 'Space') {
        e.preventDefault();
        playPauseBtn.click();
      }

      // 左箭頭：倒退 10 秒
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      }

      // 右箭頭：快進 10 秒
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
      }

      // 上箭頭：音量 +10%
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        audio.volume = Math.min(1, audio.volume + 0.1);
        volumeSlider.value = audio.volume * 100;
        localStorage.setItem('audio-volume', audio.volume.toString());
        this.updateVolumeIcon(volumeBtn, audio.volume);
      }

      // 下箭頭：音量 -10%
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        audio.volume = Math.max(0, audio.volume - 0.1);
        volumeSlider.value = audio.volume * 100;
        localStorage.setItem('audio-volume', audio.volume.toString());
        this.updateVolumeIcon(volumeBtn, audio.volume);
      }
    });

    // 初始化播放清單支援
    this.initPlaylist(audioPlayer, audio, storageKey);
  },

  // 初始化播放清單（異步）
  async initPlaylist(audioPlayer, audio, storageKey) {
    const audioFile = audioPlayer.dataset.audioFile;
    if (!audioFile) return;

    const playlistInfoEl = audioPlayer.querySelector('.playlist-info');
    const currentPartEl = audioPlayer.querySelector('.current-part');
    const totalPartsEl = audioPlayer.querySelector('.total-parts');

    // 偵測播放清單
    const playlist = await this.detectPlaylist(audioFile);

    // 如果只有一個檔案，不需要播放清單模式
    if (playlist.length === 1) return;

    console.log(`📻 偵測到播放清單：${playlist.length} 個片段`);

    // 顯示播放清單資訊
    playlistInfoEl.style.display = 'block';
    totalPartsEl.textContent = playlist.length;

    // 播放清單狀態
    let currentPartIndex = 0;
    currentPartEl.textContent = currentPartIndex + 1;

    // 載入第一個片段
    this.loadPart(audio, playlist[currentPartIndex]);

    // 播放結束時自動播放下一個片段
    const originalEndedHandler = audio.onended;
    audio.addEventListener('ended', () => {
      currentPartIndex++;

      if (currentPartIndex < playlist.length) {
        console.log(`📻 自動播放下一個片段：${currentPartIndex + 1}/${playlist.length}`);
        currentPartEl.textContent = currentPartIndex + 1;
        this.loadPart(audio, playlist[currentPartIndex]);

        // 保持播放速度
        const savedSpeed = localStorage.getItem(storageKey + '-speed');
        if (savedSpeed) {
          audio.playbackRate = parseFloat(savedSpeed);
        }

        // 自動播放
        audio.play().catch(error => {
          console.error('自動播放失敗：', error);
        });
      } else {
        // 所有片段播放完畢
        console.log('📻 播放清單結束');
        localStorage.removeItem(storageKey + '-time');
        if (originalEndedHandler) {
          originalEndedHandler.call(audio);
        }
      }
    });
  },

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  updateVolumeIcon(volumeBtn, volume) {
    const svg = volumeBtn.querySelector('svg path');
    if (!svg) return;

    if (volume === 0) {
      // 靜音圖示
      svg.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
    } else if (volume < 0.5) {
      // 低音量圖示
      svg.setAttribute('d', 'M7 9v6h4l5 5V4l-5 5H7z');
    } else {
      // 正常音量圖示
      svg.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z');
    }
  },

  // 偵測播放清單（嘗試載入分割檔案）
  async detectPlaylist(audioFile) {
    const basename = audioFile.replace(/\.[^/.]+$/, ''); // 移除副檔名
    const ext = audioFile.match(/\.[^/.]+$/)[0]; // 取得副檔名

    const playlist = [];
    let partIndex = 0;

    // 嘗試載入 part0, part1, part2, ...
    while (partIndex < 20) { // 最多嘗試 20 個片段
      const partFile = `${basename}-part${partIndex}${ext}`;
      const partUrl = `/content/audio/${partFile}`;

      try {
        const response = await fetch(partUrl, { method: 'HEAD' });
        if (response.ok) {
          playlist.push(partFile);
          partIndex++;
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }

    // 如果找到分割檔案，返回播放清單；否則返回原始檔案
    return playlist.length > 0 ? playlist : [audioFile];
  },

  // 載入特定片段
  loadPart(audio, partFile) {
    const source = audio.querySelector('source');
    source.src = `/content/audio/${partFile}`;
    audio.load();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 初始化深色模式
  ThemeManager.init();
  // 初始化語音播放器
  AudioPlayerManager.init();
  const bodyClassList = document.body.classList;

  if (bodyClassList.contains('home')) {
    renderHomepage().catch((error) => {
      console.error('[home] failed to render', error);
      const errorEl = document.querySelector('#posts-error');
      if (errorEl) errorEl.hidden = false;
    });
  }

  if (bodyClassList.contains('post-page')) {
    renderArticle().catch((error) => {
      console.error('[post] failed to render', error);
      const contentEl = document.querySelector('#post-content');
      if (contentEl) {
        contentEl.innerHTML = '<p class="error">Could not load this post. Check the metadata and Markdown file.</p>';
      }
    });
  }
});

async function renderHomepage() {
  const postsListEl = document.querySelector('#posts-list');
  const postsEmptyEl = document.querySelector('#posts-empty');
  const postsErrorEl = document.querySelector('#posts-error');

  if (!postsListEl) return;

  postsListEl.innerHTML = '';
  if (postsEmptyEl) postsEmptyEl.hidden = true;
  if (postsErrorEl) postsErrorEl.hidden = true;

  let posts = await loadNormalizedPosts();

  // 讀取 URL 參數以支援篩選功能
  const params = new URLSearchParams(window.location.search);
  const filterTag = params.get('tag');
  const filterCategory = params.get('category');

  if (!posts.length) {
    if (postsEmptyEl) postsEmptyEl.hidden = false;
    return;
  }

  // 根據 URL 參數篩選文章
  if (filterTag) {
    posts = posts.filter(post =>
      Array.isArray(post.tags) && post.tags.some(tag =>
        String(tag || '').toLowerCase() === filterTag.toLowerCase()
      )
    );
  }

  if (filterCategory) {
    posts = posts.filter(post =>
      post.category && post.category.toLowerCase() === filterCategory.toLowerCase()
    );
  }

  // 如果篩選後沒有文章，顯示提示
  if (!posts.length) {
    if (postsEmptyEl) {
      postsEmptyEl.textContent = filterTag
        ? `沒有找到標籤「${filterTag}」的文章。`
        : filterCategory
        ? `沒有找到分類「${filterCategory}」的文章。`
        : 'No posts yet. Add your first note in content/posts.';
      postsEmptyEl.hidden = false;
    }
    return;
  }

  const [featured, ...rest] = posts;
  renderFeaturedPost(featured);

  const template = document.querySelector('#post-item-template');
  if (!template) return;

  if (!rest.length) {
    postsListEl.innerHTML = '';
  } else {
    rest.forEach((post) => {
      const clone = template.content.cloneNode(true);
      const linkEl = clone.querySelector('.post-link');
      const metaEl = clone.querySelector('.post-meta');
      const summaryEl = clone.querySelector('.post-summary');
      const categoryEl = clone.querySelector('.post-card__category');
      const tagsEl = clone.querySelector('.post-tags');

      if (linkEl) {
        linkEl.href = slugToPath(post.slug, post.category);
        linkEl.textContent = post.title || post.slug;

        // 如果文章有語音版，添加語音圖示
        if (post.hasAudio) {
          const audioIcon = document.createElement('span');
          audioIcon.className = 'audio-indicator';
          audioIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
          </svg>`;
          audioIcon.setAttribute('aria-label', '有語音版');
          audioIcon.setAttribute('title', '此文章有語音版');
          linkEl.parentElement.insertBefore(audioIcon, linkEl.nextSibling);
        }
      }

      if (categoryEl) {
        categoryEl.textContent = post.category || 'Dispatch';
      }

      if (metaEl) {
        metaEl.textContent = formatMetaParts(post).join(' | ');
      }

      if (summaryEl) {
        summaryEl.textContent = post.summary || '';
      }

      populateTagBadges(tagsEl, post.tags);
      postsListEl.appendChild(clone);
    });
  }

  populateCategoryList(posts);
  populateTagCloud(posts);
}

async function renderArticle() {
  // 支援從 URL 路徑解析 slug（WordPress 風格）
  let slug = null;

  // 首先嘗試從路徑中解析 slug
  const pathParts = window.location.pathname.split('/').filter(part => part.trim());
  if (pathParts.length >= 2) {
    // 路徑格式：/category/slug/ 或 /category/slug
    slug = pathParts[pathParts.length - 1];
  }

  // 向後相容：如果從路徑中找不到 slug，嘗試從查詢參數中獲取
  if (!slug) {
    const params = new URLSearchParams(window.location.search);
    slug = params.get('slug');
  }

  const contentEl = document.querySelector('#post-content');

  if (!slug) {
    if (contentEl) {
      contentEl.innerHTML = '<p class="error">Missing post slug. Open this page from the homepage listing.</p>';
    }
    return;
  }

  const posts = await loadNormalizedPosts();
  const index = posts.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    throw new Error(`No post with slug "${slug}"`);
  }

  const post = posts[index];
  const breadcrumbCurrent = document.querySelector('#breadcrumb-current');
  const heroEl = document.querySelector('#post-hero');
  const categoryEl = document.querySelector('#post-category');
  const titleEl = document.querySelector('#post-title');
  const metaEl = document.querySelector('#post-meta');
  const tagsEl = document.querySelector('#post-tags');

  if (breadcrumbCurrent) {
    const parent = breadcrumbCurrent.parentElement;

    // 創建箭頭分隔符（如果不存在）
    let separator = parent.querySelector('.breadcrumb-separator');
    if (!separator) {
      separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '›';
      parent.insertBefore(separator, breadcrumbCurrent);
    }

    breadcrumbCurrent.textContent = post.title || slug;
  }

  applyAccentBackground(heroEl, post);

  if (categoryEl) {
    if (post.category) {
      categoryEl.textContent = post.category;
      categoryEl.hidden = false;
    } else {
      categoryEl.hidden = true;
    }
  }

  if (titleEl) {
    titleEl.textContent = post.title || slug;

    // 如果文章有語音版，添加語音圖示（加到標題內部）
    if (post.hasAudio) {
      const audioIcon = document.createElement('span');
      audioIcon.className = 'audio-indicator audio-indicator--article';
      audioIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
      </svg>`;
      audioIcon.setAttribute('aria-label', '有語音版');
      audioIcon.setAttribute('title', '此文章有語音版');
      titleEl.appendChild(audioIcon);  // 改為加到 h1 內部
    }
  }

  document.title = post.title ? `${post.title} - b-log` : 'Reading - b-log';

  if (metaEl) {
    metaEl.innerHTML = '';
    const parts = formatMetaParts(post);
    parts.forEach((part) => {
      // 確保只添加非空的 meta 部分
      if (part && part.trim()) {
        const span = document.createElement('span');
        span.textContent = part;
        metaEl.appendChild(span);
      }
    });
  }

  populateTagBadges(tagsEl, post.tags);
  await renderMarkdownContent(slug, contentEl);

  // 重新初始化語音播放器（因為播放器 HTML 是動態生成的）
  AudioPlayerManager.init();

  updatePageMetadata(post);
  renderShareLinks(post);
  renderNavigation(posts, index);
  renderRelatedPosts(posts, post);
}

async function loadPostsCatalog() {
  const response = await fetch(`${POSTS_JSON}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await readUtf8Text(response);
  const posts = JSON.parse(text);
  if (!Array.isArray(posts)) throw new Error('Invalid posts.json format');
  return posts;
}

async function loadNormalizedPosts() {
  const raw = await loadPostsCatalog();
  return normalizePosts(raw);
}

function normalizePosts(rawPosts) {
  return rawPosts
    .map((post) => {
      const publishedDate = parseDate(post.publishedAt);
      const updatedDate = parseDate(post.updatedAt || post.publishedAt);
      return {
        ...post,
        publishedDate,
        updatedDate,
      };
    })
    .sort((a, b) => {
      const timeA = a.publishedDate ? a.publishedDate.getTime() : 0;
      const timeB = b.publishedDate ? b.publishedDate.getTime() : 0;
      return timeB - timeA;
    });
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderFeaturedPost(post) {
  const heroSection = document.querySelector('#featured');
  const heroMedia = document.querySelector('#hero-media');
  const heroCategory = document.querySelector('#hero-category');
  const heroLink = document.querySelector('#hero-link');
  const heroMeta = document.querySelector('#hero-meta');
  const heroSummary = document.querySelector('#hero-summary');
  const heroReadMore = document.querySelector('#hero-read-more');
  const heroDiscuss = document.querySelector('#hero-open-discussion');

  if (!heroSection) return;

  applyAccentBackground(heroMedia, post);
  heroSection.hidden = false;

  if (heroCategory) {
    heroCategory.textContent = post.category || 'Dispatch';
    heroCategory.hidden = !post.category;
  }

  if (heroLink) {
    heroLink.href = slugToPath(post.slug, post.category);
    heroLink.textContent = post.title || post.slug;

    // 如果文章有語音版，添加語音圖示
    if (post.hasAudio) {
      const audioIcon = document.createElement('span');
      audioIcon.className = 'audio-indicator audio-indicator--hero';
      audioIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
      </svg>`;
      audioIcon.setAttribute('aria-label', '有語音版');
      audioIcon.setAttribute('title', '此文章有語音版');
      heroLink.parentElement.insertBefore(audioIcon, heroLink.nextSibling);
    }
  }

  if (heroMeta) {
    heroMeta.textContent = formatMetaParts(post).join(' | ');
  }

  if (heroSummary) {
    heroSummary.textContent = post.summary || '';
  }

  if (heroReadMore) {
    heroReadMore.href = slugToPath(post.slug, post.category);
  }

  if (heroDiscuss) {
    heroDiscuss.href = `${slugToPath(post.slug, post.category)}#comments`;
  }
}

function populateTagBadges(container, tags) {
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(tags) || !tags.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  tags.forEach((tag) => {
    const value = String(tag || '').trim();
    if (!value) return;
    const chip = document.createElement('span');
    chip.textContent = value;
    container.appendChild(chip);
  });
}

function populateCategoryList(posts) {
  const listEl = document.querySelector('#category-list');
  const template = document.querySelector('#category-item-template');
  if (!listEl || !template) return;

  listEl.innerHTML = '';
  const counts = new Map();

  posts.forEach((post) => {
    const category = (post.category || 'Dispatch').trim();
    if (!category) return;
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  if (!counts.size) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No categories yet.';
    listEl.appendChild(emptyItem);
    return;
  }

  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const clone = template.content.cloneNode(true);
      const link = clone.querySelector('.taxonomy-link');
      if (link) {
        link.textContent = `${category} (${count})`;
        link.href = `index.html?category=${encodeURIComponent(category)}`;
      }
      listEl.appendChild(clone);
    });
}

function populateTagCloud(posts) {
  const cloudEl = document.querySelector('#tag-cloud');
  if (!cloudEl) return;

  cloudEl.innerHTML = '';
  const tagMap = new Map();

  posts.forEach((post) => {
    if (!Array.isArray(post.tags)) return;
    post.tags.forEach((tag) => {
      const value = String(tag || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      const entry = tagMap.get(key) || { label: value, count: 0 };
      entry.count += 1;
      entry.label = value;
      tagMap.set(key, entry);
    });
  });

  if (!tagMap.size) {
    const span = document.createElement('span');
    span.textContent = 'No tags yet.';
    cloudEl.appendChild(span);
    return;
  }

  const entries = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  const counts = entries.map((entry) => entry.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  entries.forEach((entry) => {
    const link = document.createElement('a');
    link.textContent = `#${entry.label}`;
    link.href = `index.html?tag=${encodeURIComponent(entry.label)}`;

    const size = max === min ? 0.95 : 0.85 + ((entry.count - min) / (max - min)) * 0.5;
    link.style.fontSize = `${size.toFixed(2)}rem`;
    cloudEl.appendChild(link);
  });
}

async function renderMarkdownContent(slug, contentEl) {
  if (!contentEl) return;
  const response = await fetch(`${POSTS_ROOT}${slug}.md?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Markdown fetch failed with status ${response.status}`);
  }

  let markdown = await readUtf8Text(response);

  // 移除第一行的 H1 標題（避免與頁面標題欄重複）
  const lines = markdown.split('\n');
  if (lines[0].trim().startsWith('#')) {
    // 移除第一行標題
    lines.shift();
    // 移除標題後的空白行
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    markdown = lines.join('\n');
  }

  // 偵測並替換語音播放器標記
  const audioMatch = markdown.match(/<!--\s*audio:\s*(.+?)\s*-->/);
  if (audioMatch) {
    const audioFile = audioMatch[1];
    const audioPlayerHTML = generateAudioPlayerHTML(audioFile);
    markdown = markdown.replace(/<!--\s*audio:\s*.+?\s*-->/, audioPlayerHTML);
  }

  if (window.marked) {
    contentEl.innerHTML = window.marked.parse(markdown);
  } else {
    contentEl.textContent = markdown;
  }

  // 修正圖片路徑：將相對路徑轉換為絕對路徑
  // 解決 WordPress 風格 URL 的路徑解析問題
  contentEl.querySelectorAll('img, source').forEach(el => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const path = el.getAttribute(attr);
    if (path && path.startsWith('content/')) {
      el.setAttribute(attr, '/' + path);
    }
  });

  // 增強程式碼區塊
  enhanceCodeBlocks(contentEl);
}

function enhanceCodeBlocks(contentEl) {
  if (!contentEl) return;
  
  const codeBlocks = contentEl.querySelectorAll('pre code');
  console.log(`Found ${codeBlocks.length} code blocks to enhance`);
  
  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    
    // 檢查是否已經處理過這個程式碼區塊
    if (pre.parentElement && pre.parentElement.classList.contains('code-container')) {
      return; // 已經處理過，跳過
    }
    
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-container';
    codeContainer.style.position = 'relative';
    
    // 檢測程式語言
    const language = detectLanguage(codeBlock.textContent);
    
    // 添加語言標籤
    if (language) {
      const languageLabel = document.createElement('div');
      languageLabel.className = 'code-language';
      languageLabel.textContent = language;
      codeContainer.appendChild(languageLabel);
    }
    
    // 添加複製按鈕
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
    copyBtn.style.display = 'flex'; // 確保按鈕顯示
    codeContainer.appendChild(copyBtn);

    // 取代原始結構
    pre.parentNode.insertBefore(codeContainer, pre);
    codeContainer.appendChild(pre);
    
    // 添加行號（如果需要）
    if (shouldAddLineNumbers(pre)) {
      addLineNumbers(pre);
    }
    
    // 設置複製功能
    setupCodeCopy(copyBtn, codeBlock);
    
    // 應用語法高亮
    if (window.Prism) {
      Prism.highlightElement(codeBlock);
    } else {
      applyBasicSyntaxHighlighting(codeBlock, language);
    }
  });
}

function detectLanguage(code) {
  const trimmedCode = code.trim();
  
  // 基本的語言檢測
  if (trimmedCode.includes('<!DOCTYPE') || trimmedCode.includes('<html')) return 'html';
  if (trimmedCode.includes('import React') || trimmedCode.includes('jsx')) return 'jsx';
  if (trimmedCode.includes('function') && trimmedCode.includes('{')) return 'javascript';
  if (trimmedCode.includes('def ') || trimmedCode.includes('import ')) return 'python';
  if (trimmedCode.includes('public class') || trimmedCode.includes('import java')) return 'java';
  if (trimmedCode.includes('package') || trimmedCode.includes('func ')) return 'go';
  if (trimmedCode.includes('fmt.') || trimmedCode.includes('func ')) return 'go';
  if (trimmedCode.includes('class ') && trimmedCode.includes('def ')) return 'python';
  if (trimmedCode.includes('const ') && trimmedCode.includes('=>')) return 'javascript';
  if (trimmedCode.includes('async function') || trimmedCode.includes('await ')) return 'javascript';
  if (trimmedCode.includes('app.get') || trimmedCode.includes('app.post')) return 'javascript';
  if (trimmedCode.includes('suspend fun') || trimmedCode.includes('val ')) return 'kotlin';
  if (trimmedCode.includes('private val') || trimmedCode.includes('OkHttp')) return 'kotlin';
  
  // 檢查註解樣式
  if (trimmedCode.includes('//') && trimmedCode.includes('{')) return 'javascript';
  if (trimmedCode.includes('#') && trimmedCode.includes('def ')) return 'python';
  if (trimmedCode.includes('<!--') && trimmedCode.includes('-->')) return 'html';
  
  return null;
}

function shouldAddLineNumbers(pre) {
  const code = pre.textContent;
  const lines = code.split('\n').filter(line => line.trim());
  return lines.length > 3; // 只有超過3行才加行號
}

function addLineNumbers(pre) {
  const code = pre.textContent;
  const lines = code.split('\n');
  const lineNumbers = document.createElement('div');
  lineNumbers.className = 'line-numbers';
  
  // 生成行號
  for (let i = 1; i <= lines.length; i++) {
    const lineNumber = document.createElement('div');
    lineNumber.textContent = i;
    lineNumbers.appendChild(lineNumber);
  }
  
  pre.classList.add('line-numbers-wrapper');
  pre.appendChild(lineNumbers);
}

function setupCodeCopy(button, codeBlock) {
  if (!button || !codeBlock) return;
  
  button.addEventListener('click', async () => {
    const code = codeBlock.textContent;
    const originalText = button.textContent;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copied!';
        button.classList.add('copied');
      } else {
        // 降級方案
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        button.textContent = 'Copied!';
        button.classList.add('copied');
      }
    } catch (error) {
      button.textContent = 'Failed';
      setTimeout(() => {
        button.textContent = originalText;
      }, 1000);
      return;
    }
    
    // 2秒後恢復原始文字
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  });
}

function applyBasicSyntaxHighlighting(codeBlock, language) {
  if (!codeBlock) return;

  // 獲取純文本內容，避免處理 HTML 實體
  const code = codeBlock.textContent;
  const lines = code.split('\n');

  // 逐行處理，避免跨行匹配問題
  const highlightedLines = lines.map(line => {
    // 檢查是否為註解行（優先處理，避免註解內容被進一步處理）
    if (/^\s*\/\//.test(line)) {
      return `<span class="token comment">${escapeHtml(line)}</span>`;
    }

    // 檢查行內註解（確保 // 前面不是 : 避免誤判 URL）
    const commentMatch = line.match(/^(.+?)(?<!:)(\s+\/\/.*)$/);
    if (commentMatch) {
      const [, beforeComment, comment] = commentMatch;
      return highlightLine(beforeComment) + `<span class="token comment">${escapeHtml(comment)}</span>`;
    }

    // 普通程式碼行
    return highlightLine(line);
  });

  codeBlock.innerHTML = highlightedLines.join('\n');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightLine(line) {
  if (!line.trim()) return escapeHtml(line);

  const tokens = [];

  // 使用字母前綴避免數字正則匹配到佔位符
  function protect(match, tokenClass) {
    const id = `T${tokens.length}X`;
    tokens.push(`<span class="token ${tokenClass}">${match}</span>`);
    return `___${id}___`;
  }

  // 1. 先保護 < 和 > 符號（在 escapeHtml 之前）
  let result = line;
  result = result.replace(/</g, (match) => protect('&lt;', 'punctuation'));
  result = result.replace(/>/g, (match) => protect('&gt;', 'punctuation'));

  // 2. 轉義其他 HTML 字符
  result = escapeHtml(result);

  // 3. 保護字符串
  result = result.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (match) => protect(match, 'string'));

  // 4. 保護並標記關鍵字
  result = result.replace(/\b(function|const|let|var|if|else|for|while|return|class|extends|import|export|from|default|async|await|try|catch|finally|throw|new|this|super)\b/g, (match) => protect(match, 'keyword'));

  // 5. 保護並標記數字
  result = result.replace(/\b(\d+)\b/g, (match) => protect(match, 'number'));

  // 6. 保護並標記內建對象
  result = result.replace(/\b(document|window|console|Array|Object|String|Number|Boolean|Date|RegExp|Math|JSON)\b/g, (match) => protect(match, 'variable'));

  // 7. 處理運算符和標點
  result = result.replace(/([+\-*/%=!&|]{1,3}|[;:,(){}[\]])/g, '<span class="token punctuation">$1</span>');

  // 8. 還原所有被保護的 token
  tokens.forEach((token, idx) => {
    const id = `T${idx}X`;
    result = result.split(`___${id}___`).join(token);
  });

  return result;
}

function renderShareLinks(post) {
  const shareEl = document.querySelector('#share-links');
  if (!shareEl) return;

  shareEl.innerHTML = '';

  const pageUrl = new URL(window.location.href);
  pageUrl.hash = '';

  const shareItems = [
    {
      label: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title || 'New post on b-log')}&url=${encodeURIComponent(pageUrl.toString())}`,
      external: true,
    },
    {
      label: 'Share on Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl.toString())}`,
      external: true,
    },
    {
      label: 'Copy link',
      href: '#',
      action: 'copy-link',
    },
  ];

  shareItems.forEach((item) => {
    const link = document.createElement('a');
    link.textContent = item.label;
    if (item.external) {
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.href = item.href;
    }

    if (item.action) {
      link.dataset.action = item.action;
    }

    shareEl.appendChild(link);
  });

  setupCopyLink(shareEl, pageUrl.toString());
}

function renderNavigation(posts, index) {
  const prevEl = document.querySelector('#post-nav-prev');
  const nextEl = document.querySelector('#post-nav-next');

  if (!prevEl || !nextEl) return;

  const newer = index > 0 ? posts[index - 1] : null;
  const older = index < posts.length - 1 ? posts[index + 1] : null;

  configureNavLink(prevEl, newer, 'Newer post');
  configureNavLink(nextEl, older, 'Older post');
}

function configureNavLink(element, post, labelPrefix) {
  if (!element) return;

  if (post) {
    element.textContent = `${labelPrefix}: ${post.title || post.slug}`;
    element.href = slugToPath(post.slug, post.category);
    element.classList.remove('is-disabled');
    element.removeAttribute('aria-disabled');
    element.tabIndex = 0;
  } else {
    element.textContent = `No ${labelPrefix.toLowerCase()} yet`;
    element.classList.add('is-disabled');
    element.setAttribute('aria-disabled', 'true');
    element.removeAttribute('href');
    element.tabIndex = -1;
  }
}

function renderRelatedPosts(posts, currentPost) {
  const relatedList = document.querySelector('#related-list');
  const latestList = document.querySelector('#latest-sidebar');

  if (relatedList) {
    relatedList.innerHTML = '';
    const related = posts
      .filter((post) => post.slug !== currentPost.slug)
      .filter((post) => {
        if (currentPost.category && post.category && post.category === currentPost.category) {
          return true;
        }
        if (!Array.isArray(currentPost.tags) || !Array.isArray(post.tags)) return false;
        return currentPost.tags.some((tag) => post.tags.includes(tag));
      })
      .slice(0, 3);

    if (!related.length) {
      const li = document.createElement('li');
      li.textContent = 'More posts arriving soon.';
      relatedList.appendChild(li);
    } else {
      related.forEach((post) => {
        relatedList.appendChild(buildRelatedItem(post));
      });
    }
  }

  if (latestList) {
    latestList.innerHTML = '';
    const latest = posts.filter((post) => post.slug !== currentPost.slug).slice(0, 3);
    latest.forEach((post) => {
      latestList.appendChild(buildRelatedItem(post));
    });
  }

  const commentsLink = document.querySelector('#comments-link');
  if (commentsLink) {
    commentsLink.href = `https://github.com/jason5545/b-log/issues/new?title=${encodeURIComponent(`Comment: ${currentPost.title || currentPost.slug}`)}&labels=discussion`;
  }
}

function buildRelatedItem(post) {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.href = slugToPath(post.slug, post.category);
  link.textContent = post.title || post.slug;
  li.appendChild(link);

  if (post.publishedDate) {
    const meta = document.createElement('small');
    meta.textContent = ` - ${formatDate(post.publishedDate)}`;
    li.appendChild(meta);
  }

  return li;
}

function formatMetaParts(post) {
  const parts = [];
  if (post.author) {
    parts.push(`By ${post.author}`);
  }
  if (post.publishedDate) {
    parts.push(`Published ${formatDate(post.publishedDate)}`);
  }
  if (post.updatedDate && post.publishedDate && post.updatedDate.getTime() !== post.publishedDate.getTime()) {
    parts.push(`Updated ${formatDate(post.updatedDate)}`);
  }
  if (post.readingTime) {
    parts.push(post.readingTime);
  }
  return parts;
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function applyAccentBackground(element, post) {
  if (!element) return;
  if (post.coverImage) {
    element.style.backgroundImage = `url(${post.coverImage})`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    return;
  }

  const accent = post.accentColor || '#556bff';
  const gradient = `linear-gradient(135deg, ${shadeColor(accent, -15)} 0%, ${accent} 50%, ${shadeColor(accent, 25)} 100%)`;
  element.style.backgroundImage = gradient;
}

function shadeColor(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = (100 + percent) / 100;
  const r = clamp(Math.round(rgb.r * factor), 0, 255);
  const g = clamp(Math.round(rgb.g * factor), 0, 255);
  const b = clamp(Math.round(rgb.b * factor), 0, 255);

  return rgbToHex({ r, g, b });
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let value = hex.trim().replace('#', '');

  if (![3, 6].includes(value.length)) return null;
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const num = Number.parseInt(value, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (component) => component.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function slugToPath(slug, category) {
  // 中文分類到英文的映射（與 generate-redirects.js 保持一致）
  const categoryMapping = {
    'AI 分析': 'ai-analysis',
    '技術開發': 'tech-development',
    '技術分析': 'tech-analysis',
    '開發哲學': 'dev-philosophy',
    '生活記事': 'life-stories'
  };

  // 如果有分類，生成 WordPress 風格的 URL（絕對路徑）
  if (category && categoryMapping[category]) {
    const categorySlug = categoryMapping[category];
    return `/${categorySlug}/${slug}/`;
  }

  // 向後相容：如果沒有分類或未知分類，使用舊格式（絕對路徑）
  return `/post.html?slug=${encodeURIComponent(slug)}`;
}

function setupCopyLink(container, url) {
  if (!container || container.dataset.copyHandlerAttached) return;
  container.dataset.copyHandlerAttached = 'true';

  container.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action="copy-link"]');
    if (!trigger) return;
    event.preventDefault();

    const originalLabel = trigger.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      trigger.textContent = 'Link copied';
    } catch (error) {
      window.prompt('Copy this URL', url);
      trigger.textContent = 'Link copied';
    }

    setTimeout(() => {
      trigger.textContent = originalLabel;
    }, 2000);
  });
}

function updatePageMetadata(post) {
  const baseUrl = 'https://b-log.to/';
  const postUrl = `${baseUrl}post.html?slug=${post.slug}`;
  
  // 更新基本的 title 和 description
  document.title = post.title ? `${post.title} - b-log` : 'Reading - b-log';
  
  // 更新 canonical URL
  const canonicalEl = document.querySelector('#canonical-url');
  if (canonicalEl) {
    canonicalEl.href = postUrl;
  }
  
  // 更新 description
  const descriptionEl = document.querySelector('meta[name="description"]');
  if (descriptionEl) {
    descriptionEl.content = post.summary || 'b-log 是一個雙重用途的內容系統：既是分享見解的部落格，也是管理項目的待辦清單。';
  }
  
  // 更新 keywords
  const keywordsEl = document.querySelector('#meta-keywords');
  if (keywordsEl) {
    const keywords = Array.isArray(post.tags) ? post.tags.join(', ') : '';
    keywordsEl.content = keywords;
  }
  
  // 更新 Open Graph metadata
  updateMetaProperty('og:url', postUrl);
  updateMetaProperty('og:title', post.title || 'Untitled Post');
  updateMetaProperty('og:description', post.summary || '');
  updateMetaProperty('og:image', getPostImage(post, baseUrl));
  updateMetaProperty('article:author', post.author || 'Jason Chien');
  updateMetaProperty('article:published_time', post.publishedAt || '');
  updateMetaProperty('article:modified_time', post.updatedAt || post.publishedAt || '');
  updateMetaProperty('article:section', post.category || '');
  
  // 更新文章標籤 - 每個標籤都需要單獨的 meta property
  if (Array.isArray(post.tags) && post.tags.length > 0) {
    // 先移除現有的標籤
    document.querySelectorAll('meta[property^="article:tag"]').forEach(el => el.remove());
    
    // 添加新的標籤
    post.tags.forEach(tag => {
      if (tag) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'article:tag');
        meta.content = tag;
        document.head.appendChild(meta);
      }
    });
  }
  
  // 更新 Twitter Card metadata
  updateMetaProperty('twitter:url', postUrl);
  updateMetaProperty('twitter:title', post.title || 'Untitled Post');
  updateMetaProperty('twitter:description', post.summary || '');
  updateMetaProperty('twitter:image', getPostImage(post, baseUrl));
}

function updateMetaProperty(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.querySelector(`meta[name="${property}"]`);
  }
  if (meta) {
    meta.content = content;
  }
}

function getPostImage(post, baseUrl) {
  // 如果有封面圖片，使用它
  if (post.coverImage) {
    // 如果是相對路徑，加上基礎 URL
    if (post.coverImage.startsWith('/')) {
      return `${baseUrl}${post.coverImage.substring(1)}`;
    }
    // 如果是相對路徑（不以 / 開頭）
    if (!post.coverImage.startsWith('http')) {
      return `${baseUrl}${post.coverImage}`;
    }
    // 如果是完整 URL，直接使用
    return post.coverImage;
  }

  // 如果沒有封面圖片，使用一個簡單的漸變圖片生成服務
  const accentColor = post.accentColor || '#556bff';
  const title = encodeURIComponent(post.title || 'Untitled Post');

  // 使用第三方服務生成簡單的 OG 圖片
  // 這裡使用 https://og-image.vercel.app/ 作為例子
  return `https://og-image.vercel.app/${title}.png?theme=light&md=1&fontSize=100px&images=https%3A%2F%2Fb-log.to%2Ffavicon.ico`;
}

// ============================================================
// View Transition API 支援
// ============================================================

/**
 * 為文章卡片添加 view-transition-name
 * 這樣在導航時可以有流暢的過渡效果
 */
function setupViewTransitionNames() {
  // 為首頁的精選文章添加固定的 transition name
  const featuredTitle = document.querySelector('#hero-link');
  if (featuredTitle) {
    featuredTitle.style.viewTransitionName = 'featured-title';
  }

  // 為首頁的文章卡片添加唯一的 transition name（基於 slug）
  document.querySelectorAll('.post-card').forEach((card, index) => {
    const link = card.querySelector('.post-link');
    if (link) {
      const url = new URL(link.href, window.location.origin);
      const slug = extractSlugFromUrl(url);
      if (slug) {
        card.style.viewTransitionName = `post-card-${slug}`;
      } else {
        card.style.viewTransitionName = `post-card-${index}`;
      }
    }
  });

  // 為文章頁面的標題添加 transition name
  const postTitle = document.querySelector('#post-title');
  if (postTitle) {
    const urlObj = new URL(window.location.href);
    const slug = extractSlugFromUrl(urlObj);
    if (slug) {
      postTitle.style.viewTransitionName = `post-title-${slug}`;
    }
  }

  // 為文章頁面的 hero 區域添加 transition name
  const postHero = document.querySelector('#post-hero');
  if (postHero) {
    const urlObj = new URL(window.location.href);
    const slug = extractSlugFromUrl(urlObj);
    if (slug) {
      postHero.style.viewTransitionName = `post-hero-${slug}`;
    }
  }
}

/**
 * 從 URL 提取 slug
 */
function extractSlugFromUrl(urlObj) {
  // 從查詢參數提取
  const params = new URLSearchParams(urlObj.search);
  let slug = params.get('slug');

  // 從路徑提取（WordPress 風格）
  if (!slug) {
    const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'index.html' && p !== 'post.html');
    if (pathParts.length >= 2) {
      slug = pathParts[pathParts.length - 1];
    }
  }

  return slug;
}

// 在頁面載入完成後設定 View Transition Names
document.addEventListener('DOMContentLoaded', () => {
  setupViewTransitionNames();
});
