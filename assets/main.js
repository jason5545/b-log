import {
  POSTS_JSON,
  createCategoryMappingStore,
  createRandomPostHandler,
  createThemeManager,
  initSearchUI,
  initTocHighlight,
  initWebMcpTools,
  syncFooterYear,
} from './shared-ui.js';

const POSTS_ROOT = '/content/posts/';
const SITE_BASE_URL = 'https://b-log.to';
const DEFAULT_META_DESCRIPTION = '用一根手指打出來的技術分析、AI 產業觀察、與輪椅使用者的日常交鋒紀錄。';
const META_DATE_LOCALE = 'en-US';
const META_DATE_TIME_ZONE = 'Asia/Taipei';
const CLOUDINARY_OG_IMAGE_CONFIG = {
  cloudName: 'dynj7181i',
  backgroundId: 'og-background_cbst7j',
  fontId: 'notosanstc-bold.ttf'
};
const POSTS_CACHE_TTL_MS = 5 * 60 * 1000;
const POSTS_PER_PAGE = 20;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// LiSA 的兩個分類：洋紅只給她，旁邊直接寫出這個分類是什麼
const HER_CATEGORY_HINTS = {
  'シルシ': '我和她的事',
  'Crossing Field': '她說的話',
};
// 分類不是她的、但 Jason 9/26 確認算她的文章。accentColor 一律顯示洋紅。
// 這份白名單在 main.js、generate-redirects.js、validate-content.js 三處要一致（validate 會比對）
const HER_POST_SLUGS = ['songshan-airport-jpop-parallel-world', 'birthday-avatar-ai-barrier'];
const HER_TAG_PATTERN = /lisa|シルシ/i;
const TAG_CLOUD_VISIBLE_LIMIT = 14;
// CONTENTS 目錄：內文最外層至少 2 個 h2 才顯示（跟 generate-redirects.js 同一條）
const TOC_MIN_HEADINGS = 2;
const AUDIO_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
</svg>`;
let visibleCount = 0;
let allFilteredPosts = [];

const categoryMappingStore = createCategoryMappingStore();
let postsCatalogCache = null;
let postsCatalogCacheAt = 0;
let postsCatalogPromise = null;
let normalizedPostsCache = null;
let normalizedPostsCacheAt = 0;
const markdownCache = new Map();

const loadCategoryMapping = () => categoryMappingStore.load();
const getCategoryMapping = () => categoryMappingStore.get();


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

const ThemeManager = createThemeManager({
  onThemeApplied: () => {
    if (window.GiscusManager && window.GiscusManager.scriptLoaded) {
      window.GiscusManager.updateTheme();
    }
  }
});

// 暴露到全域（因為使用 type="module"）
window.ThemeManager = ThemeManager;

// ============================================================
// Giscus 留言系統管理
// ============================================================

const GiscusManager = {
  // Giscus 配置參數
  CONFIG: {
    repo: 'jason5545/b-log',
    repoId: 'R_kgDOQC92wg',
    category: 'Announcements',
    categoryId: 'DIC_kwDOQC92ws4C02BV',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'top',
    lang: 'zh-TW',
    loading: 'lazy'
  },

  // 狀態標記
  initialized: false,
  scriptLoaded: false,

  /**
   * 取得當前有效的主題名稱
   * 處理 auto 模式，回傳實際應套用的主題
   */
  getEffectiveTheme() {
    const currentTheme = ThemeManager.getCurrentTheme();

    if (currentTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }

    return currentTheme;
  },

  /**
   * 將主題名稱轉換為 Giscus 主題
   */
  getGiscusTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    return effectiveTheme === 'dark' ? 'dark' : 'light';
  },

  /**
   * 初始化 Giscus（使用 Intersection Observer 懶載入）
   */
  init() {
    if (this.initialized) return;

    const container = document.getElementById('giscus-container');
    if (!container) return;

    this.initialized = true;

    // 檢查元素是否已在視圖中
    const isInViewport = () => {
      const rect = container.getBoundingClientRect();
      return rect.top < window.innerHeight + 200 && rect.bottom > -200;
    };

    // 如果已在視圖中，直接載入
    if (isInViewport()) {
      this.loadScript();
      this.setupThemeListener();
      return;
    }

    // 否則使用 Intersection Observer 懶載入
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadScript();
          observer.disconnect();
        }
      });
    }, {
      rootMargin: '200px 0px',
      threshold: 0
    });

    observer.observe(container);

    // 監聽主題變更
    this.setupThemeListener();
  },

  /**
   * 載入 Giscus 腳本
   */
  loadScript() {
    if (this.scriptLoaded) return;

    const container = document.getElementById('giscus-container');
    const loading = document.getElementById('giscus-loading');
    const fallback = document.getElementById('giscus-fallback');

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    // 設定 Giscus 配置屬性
    script.setAttribute('data-repo', this.CONFIG.repo);
    script.setAttribute('data-repo-id', this.CONFIG.repoId);
    script.setAttribute('data-category', this.CONFIG.category);
    script.setAttribute('data-category-id', this.CONFIG.categoryId);
    script.setAttribute('data-mapping', this.CONFIG.mapping);
    script.setAttribute('data-strict', this.CONFIG.strict);
    script.setAttribute('data-reactions-enabled', this.CONFIG.reactionsEnabled);
    script.setAttribute('data-emit-metadata', this.CONFIG.emitMetadata);
    script.setAttribute('data-input-position', this.CONFIG.inputPosition);
    script.setAttribute('data-theme', this.getGiscusTheme());
    script.setAttribute('data-lang', this.CONFIG.lang);
    script.setAttribute('data-loading', this.CONFIG.loading);

    // 載入成功
    script.onload = () => {
      this.scriptLoaded = true;
      if (loading) loading.style.display = 'none';
    };

    // 載入失敗
    script.onerror = () => {
      console.error('Giscus 載入失敗');
      if (loading) loading.style.display = 'none';
      if (fallback) fallback.hidden = false;
    };

    container.appendChild(script);
  },

  /**
   * 設定主題變更監聽器
   */
  setupThemeListener() {
    // 監聽系統主題變更（auto 模式時）
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (ThemeManager.getCurrentTheme() === 'auto') {
        this.updateTheme();
      }
    });

    // 使用 MutationObserver 監聽 data-theme 屬性變更
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          this.updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  },

  /**
   * 更新 Giscus 主題（透過 postMessage 與 iframe 通訊）
   */
  updateTheme() {
    const iframe = document.querySelector('iframe.giscus-frame');
    if (!iframe || !iframe.contentWindow) return;

    const newTheme = this.getGiscusTheme();

    iframe.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme: newTheme
          }
        }
      },
      'https://giscus.app'
    );
  }
};

// 暴露到全域
window.GiscusManager = GiscusManager;

// ============================================================
// 隨機文章功能
// ============================================================

const goToRandomPost = createRandomPostHandler({
  loadCategoryMapping,
});

// 暴露到全域
window.goToRandomPost = goToRandomPost;

// ============================================================
// 12 月生日特輯主題
// ============================================================

const BirthdayTheme = {
  STORAGE_KEY: 'birthday-banner-closed',
  BIRTHDAY_MONTH: 12, // 12 月

  init() {
    const currentMonth = new Date().getMonth() + 1; // JavaScript 月份從 0 開始

    // 只在 12 月顯示
    if (currentMonth !== this.BIRTHDAY_MONTH) {
      return;
    }

    // 啟用生日主題
    this.activateTheme();

    // 計算並顯示年度統計
    this.calculateYearlyStats();
  },

  activateTheme() {
    // 顯示所有生日主題元素
    document.querySelectorAll('.birthday-theme').forEach(el => {
      el.classList.add('is-active');
      el.hidden = false;
    });

    // 檢查橫幅是否已被關閉
    const bannerClosed = localStorage.getItem(this.STORAGE_KEY);
    if (bannerClosed === 'true') {
      const banner = document.getElementById('birthday-banner');
      if (banner) {
        banner.hidden = true;
        banner.classList.remove('is-active');
      }
    }
  },

  closeBanner() {
    const banner = document.getElementById('birthday-banner');
    if (banner) {
      banner.hidden = true;
      banner.classList.remove('is-active');
      localStorage.setItem(this.STORAGE_KEY, 'true');
    }
  },

  async calculateYearlyStats() {
    try {
      const posts = await loadNormalizedPosts();
      const currentYear = new Date().getFullYear();

      // 篩選今年的文章
      const yearlyPosts = posts.filter(post => {
        const publishedDate = new Date(post.publishedAt);
        return publishedDate.getFullYear() === currentYear;
      });

      // 計算統計數據
      const totalPosts = yearlyPosts.length;
      const audioPosts = yearlyPosts.filter(post => post.hasAudio).length;

      // 計算分類統計
      const categoryStats = {};
      yearlyPosts.forEach(post => {
        const category = post.category || '未分類';
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      });

      const totalCategories = Object.keys(categoryStats).length;

      // 預估字數（閱讀時間 * 200 字/分鐘）
      let totalWords = 0;
      yearlyPosts.forEach(post => {
        if (post.readingTime) {
          const minutes = parseInt(post.readingTime) || 0;
          totalWords += minutes * 200;
        }
      });

      // 更新 DOM
      this.updateStatsDOM({
        totalPosts,
        totalWords,
        audioPosts,
        totalCategories,
        categoryStats,
        currentYear
      });
    } catch (error) {
      console.error('[BirthdayTheme] Failed to calculate yearly stats:', error);
    }
  },

  updateStatsDOM(stats) {
    // 更新年份
    const yearEl = document.querySelector('.yearly-stats__year');
    if (yearEl) {
      yearEl.textContent = stats.currentYear;
    }

    // 更新數字
    const totalPostsEl = document.getElementById('stats-total-posts');
    if (totalPostsEl) {
      totalPostsEl.textContent = stats.totalPosts;
    }

    const totalWordsEl = document.getElementById('stats-total-words');
    if (totalWordsEl) {
      // 格式化字數（使用 k 表示千）
      const formattedWords = stats.totalWords >= 1000
        ? (stats.totalWords / 1000).toFixed(1) + 'k'
        : stats.totalWords;
      totalWordsEl.textContent = formattedWords;
    }

    const audioPostsEl = document.getElementById('stats-audio-posts');
    if (audioPostsEl) {
      audioPostsEl.textContent = stats.audioPosts;
    }

    const categoriesEl = document.getElementById('stats-categories');
    if (categoriesEl) {
      categoriesEl.textContent = stats.totalCategories;
    }

    // 更新分類列表
    const categoryListEl = document.getElementById('stats-category-list');
    if (categoryListEl) {
      categoryListEl.innerHTML = '';

      // 按文章數量排序
      const sortedCategories = Object.entries(stats.categoryStats)
        .sort((a, b) => b[1] - a[1]);

      sortedCategories.forEach(([category, count]) => {
        const categoryEl = document.createElement('span');
        categoryEl.className = 'yearly-stats__category';
        categoryEl.innerHTML = `
          ${category}
          <span class="yearly-stats__category-count">${count}</span>
        `;
        categoryListEl.appendChild(categoryEl);
      });
    }
  }
};

// 暴露到全域
window.BirthdayTheme = BirthdayTheme;

// ============================================================
// 搜尋功能
// ============================================================

/**
 * 初始化搜尋功能
 */
function initSearch() {
  initSearchUI({ onSearch: updateSearchParams });
}

/**
 * 更新 URL 參數並重新渲染
 */
function updateSearchParams(searchQuery) {
  const isHomePage = document.body.classList.contains('home');

  // 非首頁：跳轉到首頁並帶上搜尋參數
  if (!isHomePage) {
    const homeUrl = searchQuery
      ? `/?search=${encodeURIComponent(searchQuery)}`
      : '/';
    window.location.href = homeUrl;
    return;
  }

  // 首頁：更新 URL 參數並重新渲染
  const params = new URLSearchParams(window.location.search);

  if (searchQuery) {
    params.set('search', searchQuery);
  } else {
    params.delete('search');
  }

  // 更新 URL（不重新載入頁面）
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.pushState({}, '', newUrl);

  // 重新渲染頁面
  renderHomepage().catch((error) => {
    console.error('[search] failed to render', error);
  });
}

/**
 * 根據搜尋查詢過濾文章
 */
function filterPostsBySearch(posts, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return posts;

  const query = searchQuery.toLowerCase().trim();

  return posts.filter(post => {
    // 搜尋標題
    if (post.title && post.title.toLowerCase().includes(query)) {
      return true;
    }

    // 搜尋摘要
    if (post.summary && post.summary.toLowerCase().includes(query)) {
      return true;
    }

    // 搜尋分類
    if (post.category && post.category.toLowerCase().includes(query)) {
      return true;
    }

    // 搜尋標籤
    if (Array.isArray(post.tags)) {
      return post.tags.some(tag =>
        String(tag || '').toLowerCase().includes(query)
      );
    }

    return false;
  });
}

/**
 * 更新搜尋結果計數
 */
function updateSearchResultsCount(count, searchQuery) {
  const countEl = document.querySelector('#search-results-count');
  if (!countEl) return;

  if (searchQuery && searchQuery.trim()) {
    countEl.textContent = `找到 ${count} 篇文章`;
    countEl.hidden = false;
  } else {
    countEl.hidden = true;
  }
}

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
      <div class="playlist-info" style="display:none">
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
  <div class="audio-attribution">
    Powered by <a href="https://notebooklm.google/" target="_blank" rel="noopener noreferrer">NotebookLM</a>. You may check facts.
  </div>
</div>`;
}

// 語音播放器管理
const AudioPlayerManager = {
  STORAGE_KEY_PREFIX: 'audio-player-',
  eventHandlers: new Map(), // 儲存事件處理器引用以便清理

  init() {
    const audioPlayer = document.querySelector('.audio-player');
    if (!audioPlayer) return;

    const audio = audioPlayer.querySelector('audio');
    if (!audio) return;

    // 靜態文章正文會先出現在 HTML 裡，避免重複綁定播放器事件。
    if (audioPlayer.dataset.initialized === 'true') {
      return;
    }

    audioPlayer.dataset.initialized = 'true';

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

    // 播放/暫停
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(error => {
          console.error('[AudioPlayer] 播放失敗：', error);
          this.showError(audioPlayer, '無法播放音訊，請檢查網路連線或稍後再試。');
        });
      } else {
        audio.pause();
      }
    });

    // 音訊載入錯誤處理
    audio.addEventListener('error', (e) => {
      const errorMessages = {
        1: '音訊載入被中斷',
        2: '網路錯誤，無法載入音訊',
        3: '音訊格式不支援或檔案損壞',
        4: '音訊來源不可用'
      };
      const errorCode = audio.error ? audio.error.code : 0;
      const errorMessage = errorMessages[errorCode] || '音訊播放發生未知錯誤';
      console.error('[AudioPlayer] 音訊錯誤：', errorMessage, e);
      this.showError(audioPlayer, errorMessage);
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

    // 使用節流機制儲存進度
    let lastSaveTime = 0;
    const SAVE_INTERVAL = 5000; // 5 秒
    let isSeeking = false;

    // 更新進度條
    audio.addEventListener('timeupdate', () => {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = percent;
      currentTimeEl.textContent = this.formatTime(audio.currentTime);

      // 更新進度條視覺效果（填充顏色）
      this.updateProgressBar(progressBar, percent);

      // 只在非拖曳狀態下儲存進度（使用節流機制）
      if (!isSeeking) {
        const now = Date.now();
        if (now - lastSaveTime >= SAVE_INTERVAL) {
          localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
          lastSaveTime = now;
        }
      }
    });

    // 載入後顯示總時長並恢復播放進度
    audio.addEventListener('loadedmetadata', () => {
      durationEl.textContent = this.formatTime(audio.duration);

      // 只在非播放清單模式下恢復播放進度
      // 播放清單模式會在切換片段時觸發此事件,不應該恢復舊進度
      if (!audioPlayer.classList.contains('playlist-mode')) {
        const savedTime = localStorage.getItem(storageKey + '-time');
        if (savedTime && parseFloat(savedTime) > 0) {
          const time = parseFloat(savedTime);
          // 確保不超過音訊長度
          if (time < audio.duration) {
            audio.currentTime = time;
          }
        }
      }
    });

    // 如果已經載入，直接顯示
    if (audio.duration) {
      durationEl.textContent = this.formatTime(audio.duration);
    }

    // 拖曳進度條
    progressBar.addEventListener('input', () => {
      const time = (progressBar.value / 100) * audio.duration;
      audio.currentTime = time;
      // 即時更新進度條視覺效果
      this.updateProgressBar(progressBar, progressBar.value);
      // 即時更新時間顯示
      currentTimeEl.textContent = this.formatTime(time);
    });

    // 拖曳開始時停止儲存
    audio.addEventListener('seeking', () => {
      isSeeking = true;
    });

    // 拖曳結束時立即儲存新位置
    audio.addEventListener('seeked', () => {
      isSeeking = false;
      localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
      lastSaveTime = Date.now(); // 更新最後儲存時間
    });

    // 播放結束時重置進度（只在非播放清單模式下）
    audio.addEventListener('ended', () => {
      if (!audioPlayer.classList.contains('playlist-mode')) {
        localStorage.removeItem(storageKey + '-time');
        progressBar.value = 0;
      }
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
    const closeMenuHandler = () => {
      speedMenu.style.display = 'none';
    };
    document.addEventListener('click', closeMenuHandler);
    this.eventHandlers.set('closeMenu', closeMenuHandler);

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
    const keydownHandler = (e) => {
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
    };
    document.addEventListener('keydown', keydownHandler);
    this.eventHandlers.set('keydown', keydownHandler);

    // 頁面卸載時強制儲存進度
    const beforeUnloadHandler = () => {
      if (!isNaN(audio.currentTime) && audio.currentTime > 0) {
        localStorage.setItem(storageKey + '-time', audio.currentTime.toString());
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    this.eventHandlers.set('beforeunload', beforeUnloadHandler);

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
    let playlist;
    try {
      playlist = await this.detectPlaylist(audioFile);
    } catch (error) {
      console.error('[AudioPlayer] 播放清單初始化失敗：', error);
      // 降級到單一檔案模式
      playlist = [audioFile];
    }

    // 如果只有一個檔案，不需要播放清單模式
    if (playlist.length === 1) return;

    console.log(`📻 偵測到播放清單：${playlist.length} 個片段`);

    // 標記為播放清單模式
    audioPlayer.classList.add('playlist-mode');

    // 顯示播放清單資訊
    playlistInfoEl.style.display = 'block';
    totalPartsEl.textContent = playlist.length;

    // 播放清單狀態
    let currentPartIndex = 0;
    currentPartEl.textContent = currentPartIndex + 1;

    // 載入第一個片段(只有當原始音訊源與第一個片段不同時才重新載入)
    const currentSrc = audio.querySelector('source').src;
    const firstPartSrc = `/content/audio/${playlist[currentPartIndex]}`;
    if (!currentSrc.endsWith(playlist[currentPartIndex])) {
      await this.loadPart(audio, playlist[currentPartIndex]);
    }

    // 播放結束時自動播放下一個片段
    const endedHandler = async () => {
      // 只在播放清單模式下處理
      if (!audioPlayer.classList.contains('playlist-mode')) return;

      currentPartIndex++;

      if (currentPartIndex < playlist.length) {
        console.log(`📻 自動播放下一個片段：${currentPartIndex + 1}/${playlist.length}`);
        currentPartEl.textContent = currentPartIndex + 1;

        // 等待片段載入完成
        await this.loadPart(audio, playlist[currentPartIndex]);

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
        audioPlayer.classList.remove('playlist-mode');
        localStorage.removeItem(storageKey + '-time');
      }
    };

    audio.addEventListener('ended', endedHandler);
  },

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  // 更新進度條視覺效果
  updateProgressBar(progressBar, percent) {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    progressBar.style.background = `linear-gradient(
      to right,
      var(--cyan) 0%,
      var(--cyan) ${clampedPercent}%,
      var(--rule) ${clampedPercent}%,
      var(--rule) 100%
    )`;
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

    // 使用二分搜尋法快速找到最後一個存在的片段
    const MAX_PARTS = 20;

    // 先檢查 part0 是否存在
    const firstPartFile = `${basename}-part0${ext}`;
    const firstPartUrl = `/content/audio/${firstPartFile}`;

    try {
      const firstResponse = await fetch(firstPartUrl, { method: 'HEAD' });
      if (!firstResponse.ok) {
        // 如果 part0 不存在，返回原始檔案
        return [audioFile];
      }
    } catch (error) {
      console.warn('[AudioPlayer] 播放清單偵測失敗：', error);
      return [audioFile];
    }

    // 使用並行請求快速偵測所有片段（批次處理）
    const checkBatch = async (startIndex, endIndex) => {
      const promises = [];
      for (let i = startIndex; i <= endIndex; i++) {
        const partFile = `${basename}-part${i}${ext}`;
        const partUrl = `/content/audio/${partFile}`;
        promises.push(
          fetch(partUrl, { method: 'HEAD' })
            .then(response => ({ index: i, exists: response.ok, file: partFile }))
            .catch(() => ({ index: i, exists: false, file: partFile }))
        );
      }
      return Promise.all(promises);
    };

    // 分批檢查（每批 5 個，避免過多並行請求）
    const BATCH_SIZE = 5;
    const playlist = [firstPartFile];

    for (let batchStart = 1; batchStart < MAX_PARTS; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, MAX_PARTS - 1);
      const results = await checkBatch(batchStart, batchEnd);

      // 按索引排序
      results.sort((a, b) => a.index - b.index);

      // 檢查是否有連續的片段
      let foundGap = false;
      for (const result of results) {
        if (result.exists) {
          playlist.push(result.file);
        } else {
          foundGap = true;
          break;
        }
      }

      // 如果發現間隙，停止搜尋
      if (foundGap) {
        break;
      }
    }

    console.log(`[AudioPlayer] 偵測到 ${playlist.length} 個音訊片段`);
    return playlist.length > 0 ? playlist : [audioFile];
  },

  // 載入特定片段(返回 Promise,等待載入完成)
  loadPart(audio, partFile) {
    return new Promise((resolve, reject) => {
      const source = audio.querySelector('source');
      source.src = `/content/audio/${partFile}`;

      // 監聽載入完成事件
      const onLoadedMetadata = () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('error', onError);
        console.log(`✅ 片段載入完成：${partFile}`);
        resolve();
      };

      // 監聽載入錯誤事件
      const onError = (e) => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('error', onError);
        console.error(`❌ 片段載入失敗：${partFile}`, e);
        reject(new Error(`Failed to load audio part: ${partFile}`));
      };

      audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      audio.addEventListener('error', onError, { once: true });

      // 開始載入
      audio.load();
    });
  },

  // 清理事件監聽器
  cleanup() {
    // 移除所有事件監聽器
    this.eventHandlers.forEach((handler, key) => {
      if (key === 'closeMenu') {
        document.removeEventListener('click', handler);
      } else if (key === 'keydown') {
        document.removeEventListener('keydown', handler);
      } else if (key === 'beforeunload') {
        window.removeEventListener('beforeunload', handler);
      }
    });
    this.eventHandlers.clear();
    console.log('[AudioPlayer] 清理完成');
  },

  // 顯示錯誤訊息
  showError(audioPlayer, message) {
    // 檢查是否已有錯誤訊息
    let errorEl = audioPlayer.querySelector('.audio-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'audio-error';
      audioPlayer.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    // 3 秒後自動隱藏
    setTimeout(() => {
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }, 5000);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化深色模式
  ThemeManager.init();
  syncFooterYear();
  // 初始化語音播放器
  AudioPlayerManager.init();
  // 初始化搜尋功能（所有頁面）
  initSearch();
  // 讓支援 WebMCP 的瀏覽器代理可直接讀取公開內容。
  initWebMcpTools({ loadCategoryMapping });
  const categoryMappingReady = loadCategoryMapping().catch((error) => {
    console.warn('[init] failed to load category mapping', error);
    return getCategoryMapping();
  });

  const bodyClassList = document.body.classList;
  if (bodyClassList.contains('home') || bodyClassList.contains('post-page')) {
    await categoryMappingReady;
  }

  if (bodyClassList.contains('home')) {
    // 初始化 12 月生日特輯
    BirthdayTheme.init();

    // 瀏覽器上一頁／下一頁時重新渲染，讓篩選狀態（含 Start here 顯示）與 URL 同步
    window.addEventListener('popstate', () => {
      renderHomepage().catch((error) => {
        console.error('[home] failed to render', error);
        const errorEl = document.querySelector('#posts-error');
        if (errorEl) errorEl.hidden = false;
      });
    });

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

  const allPosts = await loadNormalizedPosts();
  let posts = allPosts;

  // 讀取 URL 參數以支援篩選功能
  const params = new URLSearchParams(window.location.search);
  const filterTag = params.get('tag');
  const filterCategory = params.get('category');
  const searchQuery = params.get('search');

  // BRIEFING 僅在未篩選首頁顯示：進入分類、標籤、搜尋時隱藏，清除篩選或返回時恢復
  const startHereEl = document.querySelector('.start-here');
  if (startHereEl) startHereEl.hidden = hasActiveHomeFilter();

  // TOPICS 一律列出全部分類，目前篩選的分類標記 aria-current
  populateCategoryList(allPosts, filterCategory);
  populateTagCloud(allPosts, filterTag);
  applyBriefingAccents(allPosts);

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

  // 搜尋功能
  if (searchQuery) {
    posts = filterPostsBySearch(posts, searchQuery);
  }

  // 更新搜尋結果計數與 LOG 標題
  updateSearchResultsCount(posts.length, searchQuery);
  updateLogSummary(posts.length, { filterTag, filterCategory, searchQuery });

  // 如果篩選後沒有文章，顯示提示
  if (!posts.length) {
    if (postsEmptyEl) {
      postsEmptyEl.textContent = searchQuery
        ? `沒有找到包含「${searchQuery}」的文章。`
        : filterTag
        ? `沒有找到標籤「${filterTag}」的文章。`
        : filterCategory
        ? `沒有找到分類「${filterCategory}」的文章。`
        : 'No posts yet. Add your first note in content/posts.';
      postsEmptyEl.hidden = false;
    }
    allFilteredPosts = [];
    visibleCount = 0;
    updateLoadMoreButton();
    return;
  }

  renderFeaturedPost(posts[0]);

  // 沒有篩選時 LATEST 已經是最新一篇，LOG 從第二篇開始，載入更多也不會再出現；
  // 有篩選時列出全部符合的，包含 LATEST 那篇
  const isFiltered = Boolean(filterTag || filterCategory || searchQuery);
  allFilteredPosts = isFiltered ? posts : posts.slice(1);
  visibleCount = 0;
  postsListEl.innerHTML = '';

  appendNextPage();
}

function updateLogSummary(count, { filterTag, filterCategory, searchQuery } = {}) {
  const summaryEl = document.querySelector('#log-summary');
  if (!summaryEl) return;

  const labelEl = summaryEl.parentElement;
  let clearEl = labelEl ? labelEl.querySelector('.label__clear') : null;
  const filterLabel = searchQuery
    ? `「${searchQuery}」`
    : filterTag
    ? `#${filterTag}`
    : filterCategory || '';

  summaryEl.textContent = filterLabel
    ? `${filterLabel}：${count} 篇，新到舊`
    : `${count} 篇，新到舊`;

  if (filterLabel && labelEl && !clearEl) {
    clearEl = document.createElement('a');
    clearEl.className = 'label__clear';
    clearEl.href = './';
    clearEl.textContent = 'ALL ›';
    labelEl.appendChild(clearEl);
  } else if (!filterLabel && clearEl) {
    clearEl.remove();
  }
}

function appendNextPage() {
  const postsListEl = document.querySelector('#posts-list');
  if (!postsListEl) return;

  const end = Math.min(visibleCount + POSTS_PER_PAGE, allFilteredPosts.length);
  const batch = allFilteredPosts.slice(visibleCount, end);
  const fragment = document.createDocumentFragment();

  batch.forEach((post) => {
    fragment.appendChild(buildLogRow(post));
  });

  postsListEl.appendChild(fragment);
  visibleCount = end;
  updateLoadMoreButton();
}

function updateLoadMoreButton() {
  let button = document.querySelector('#load-more-btn');
  if (visibleCount >= allFilteredPosts.length) {
    if (button) button.hidden = true;
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'load-more-btn';
    button.className = 'log__more load-more-btn';
    button.addEventListener('click', () => {
      const firstNewIndex = visibleCount;
      appendNextPage();
      // 焦點移到新載入的第一列，鍵盤使用者不用從頭 Tab
      const rows = document.querySelectorAll('#posts-list .row a');
      if (rows[firstNewIndex]) rows[firstNewIndex].focus();
    });
    const postsListEl = document.querySelector('#posts-list');
    if (postsListEl) {
      postsListEl.insertAdjacentElement('afterend', button);
    }
  }
  const remaining = allFilteredPosts.length - visibleCount;
  button.textContent = `更早的 ${remaining} 篇 ›`;
  button.hidden = false;
}

// LOG 列：日期、分類、標題、閱讀時間
function buildLogRow(post) {
  const li = document.createElement('li');
  li.className = isHerCategory(post.category) ? 'row row--her' : 'row';
  applyRowAccent(li, post);

  const link = document.createElement('a');
  link.href = slugToPath(post.slug, post.category);

  const date = document.createElement('span');
  date.className = 'row__date';
  date.textContent = formatEcamDate(post.publishedDate);

  const category = document.createElement('span');
  category.className = 'row__cat';
  category.textContent = post.category || '';

  const title = document.createElement('span');
  title.className = 'row__title';
  title.textContent = post.title || post.slug;
  if (post.hasAudio) {
    title.appendChild(buildAudioIndicator('audio-indicator'));
  }

  const time = document.createElement('span');
  time.className = 'row__time';
  time.textContent = formatReadingTime(post);

  link.append(date, category, title, time);
  li.appendChild(link);
  return li;
}

// RELATED／LATEST 側欄列：第一行「日期 · 分類」，第二行標題
function buildSideRow(post) {
  const li = document.createElement('li');
  applyRowAccent(li, post);

  const link = document.createElement('a');
  link.href = slugToPath(post.slug, post.category);

  const meta = document.createElement('span');
  meta.className = 'side-row__meta';
  meta.textContent = formatEcamDate(post.publishedDate);
  if (post.category) {
    const category = document.createElement('span');
    category.textContent = post.category;
    if (isHerCategory(post.category)) category.className = 'her-cat';
    meta.append(' · ', category);
  }

  const title = document.createElement('span');
  title.className = 'side-row__title';
  title.textContent = post.title || post.slug;
  if (post.hasAudio) {
    title.appendChild(buildAudioIndicator('audio-indicator'));
  }

  link.append(meta, title);
  li.appendChild(link);
  return li;
}

// 列左緣的 accentColor 色條：她的文章一律洋紅，其他用存的色碼，沒有就不畫
function applyRowAccent(element, post) {
  const accent = resolveAccent(post);
  if (accent) element.style.setProperty('--row-accent', accent);
}

function resolveAccent(post) {
  if (isHerPost(post)) return 'var(--magenta)';
  const color = String(post?.accentColor || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '';
}

function isHerPost(post) {
  return isHerCategory(post?.category) || HER_POST_SLUGS.includes(post?.slug);
}

// BRIEFING 是寫死在 index.html 的三篇，依連結找回文章補上色條
function applyBriefingAccents(posts) {
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  document.querySelectorAll('.brief li').forEach((item) => {
    const link = item.querySelector('a[href]');
    if (!link) return;
    const slug = link.getAttribute('href').split('/').filter(Boolean).pop();
    const post = bySlug.get(slug);
    if (post) applyRowAccent(item, post);
  });
}

function buildAudioIndicator(className) {
  const audioIcon = document.createElement('span');
  audioIcon.className = className;
  audioIcon.innerHTML = AUDIO_ICON_SVG;
  audioIcon.setAttribute('aria-label', '有語音版');
  audioIcon.setAttribute('title', '此文章有語音版');
  return audioIcon;
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
  const catlineEl = document.querySelector('#post-catline');
  const titleEl = document.querySelector('#post-title');
  const metaEl = document.querySelector('#post-meta');
  const tagsEl = document.querySelector('#post-tags');
  const statusEl = document.querySelector('#post-status');
  const articleEl = document.querySelector('#post-article');
  const accentEl = document.querySelector('#post-accent');

  if (breadcrumbCurrent) {
    breadcrumbCurrent.replaceChildren();
    if (post.category) {
      const categoryLink = document.createElement('a');
      categoryLink.href = `/?category=${encodeURIComponent(post.category)}`;
      categoryLink.textContent = post.category;
      if (isHerCategory(post.category)) categoryLink.className = 'her-cat';
      breadcrumbCurrent.appendChild(categoryLink);
    }
  }

  applyCategoryTheme(articleEl, post);

  // 標題區上方的 accentColor 色條（靜態頁已經直接輸出，這裡只補未預先渲染的情況）
  if (accentEl) {
    const accent = resolveAccent(post);
    if (accent) {
      accentEl.style.setProperty('--post-accent', accent);
    } else {
      accentEl.style.removeProperty('--post-accent');
    }
  }

  if (catlineEl) {
    if (isHerCategory(post.category)) {
      const hint = document.createElement('span');
      hint.textContent = HER_CATEGORY_HINTS[post.category];
      catlineEl.replaceChildren(`${post.category.toUpperCase()} `, hint);
      catlineEl.hidden = false;
    } else {
      catlineEl.replaceChildren();
      catlineEl.hidden = true;
    }
  }

  if (titleEl) {
    titleEl.textContent = post.title || slug;

    // 如果文章有語音版，添加語音圖示（加到標題內部）
    if (post.hasAudio) {
      const audioIcon = buildAudioIndicator('audio-indicator audio-indicator--article');
      titleEl.appendChild(audioIcon);

      // 偵測標題是否因為音訊圖示而換行，如果換行則自動縮小圖示
      setTimeout(() => {
        const titleHeight = titleEl.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(titleEl).lineHeight);
        const fontSize = parseFloat(getComputedStyle(titleEl).fontSize);
        const computedLineHeight = isNaN(lineHeight) ? fontSize * 1.2 : lineHeight;

        // 如果標題高度超過單行高度（表示換行了），則縮小音訊圖示
        if (titleHeight > computedLineHeight * 1.3) {
          audioIcon.classList.add('audio-indicator--compact');
        }
      }, 0);
    }
  }

  document.title = post.title ? `${post.title} - b-log` : 'Reading - b-log';

  if (metaEl) {
    metaEl.textContent = formatMetaParts(post).join(' · ');
  }

  if (statusEl && !statusEl.innerHTML.trim()) {
    const statusMarkup = buildStatusInnerHTML(post.status);
    statusEl.innerHTML = statusMarkup;
    statusEl.hidden = !statusMarkup;
  }

  populateTagBadges(tagsEl, post.tags);
  await renderMarkdownContent(slug, contentEl);
  // 封面要等內文到位才知道內文有沒有同一張圖
  renderArticleCover(heroEl, post, contentEl);
  renderArticleToc(contentEl);

  // 重新初始化語音播放器（因為播放器 HTML 是動態生成的）
  AudioPlayerManager.init();

  updatePageMetadata(post);
  renderShareLinks(post);
  renderNavigation(posts, index);
  renderRelatedPosts(posts, post);
}

async function loadPostsCatalog() {
  const now = Date.now();

  if (postsCatalogCache && now - postsCatalogCacheAt < POSTS_CACHE_TTL_MS) {
    return postsCatalogCache;
  }

  if (postsCatalogPromise) {
    return postsCatalogPromise;
  }

  postsCatalogPromise = (async () => {
    const response = await fetch(POSTS_JSON);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await readUtf8Text(response);
    const posts = JSON.parse(text);
    if (!Array.isArray(posts)) throw new Error('Invalid posts.json format');

    postsCatalogCache = posts;
    postsCatalogCacheAt = Date.now();
    return postsCatalogCache;
  })();

  try {
    return await postsCatalogPromise;
  } finally {
    postsCatalogPromise = null;
  }
}

async function loadNormalizedPosts() {
  const raw = await loadPostsCatalog();

  if (normalizedPostsCache && normalizedPostsCacheAt === postsCatalogCacheAt) {
    return normalizedPostsCache;
  }

  normalizedPostsCache = normalizePosts(raw);
  normalizedPostsCacheAt = postsCatalogCacheAt;
  return normalizedPostsCache;
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
  const heroLink = document.querySelector('#hero-link');
  const heroTitle = document.querySelector('#hero-title');
  const heroMeta = document.querySelector('#hero-meta');
  const heroSummary = document.querySelector('#hero-summary');
  let heroMedia = document.querySelector('#hero-media');

  if (!heroSection || !heroLink) return;

  heroSection.hidden = false;
  heroSection.classList.toggle('lead--text-only', !post.coverImage);

  // 靜態產生的 LATEST 已經是這一篇時，不動封面，保留 LCP 的 preload 與 srcset
  const isCurrentStaticFeatured =
    heroSection.dataset.featuredSlug === post.slug &&
    heroMedia?.querySelector('.lead__img');

  if (!isCurrentStaticFeatured) {
    if (post.coverImage) {
      if (!heroMedia) {
        heroMedia = document.createElement('div');
        heroMedia.className = 'lead__media';
        heroMedia.id = 'hero-media';
        heroLink.appendChild(heroMedia);
      }
      const image = document.createElement('img');
      image.className = 'lead__img';
      image.src = post.coverImage;
      image.alt = '';
      image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      heroMedia.replaceChildren(image);
    } else if (heroMedia) {
      heroMedia.remove();
    }
    heroSection.dataset.featuredSlug = post.slug;
    heroSection.dataset.featuredCover = post.coverImage || '';
  }

  heroLink.href = slugToPath(post.slug, post.category);

  if (heroTitle) {
    heroTitle.textContent = post.title || post.slug;
    if (post.hasAudio) {
      heroTitle.appendChild(buildAudioIndicator('audio-indicator audio-indicator--hero'));
    }
  }

  if (heroMeta) {
    heroMeta.textContent = formatMetaParts(post, { includeAuthor: false }).join(' · ');
  }

  if (heroSummary) {
    heroSummary.textContent = post.summary || '';
  }
}

function hasActiveHomeFilter() {
  const params = new URLSearchParams(window.location.search);
  return params.has('tag') || params.has('category') || params.has('search');
}

function populateTagBadges(container, tags) {
  if (!container) return;
  container.innerHTML = '';

  const values = Array.isArray(tags)
    ? tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  if (!values.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const label = document.createElement('span');
  label.className = 'meta';
  label.textContent = 'TAGS';
  container.appendChild(label);

  values.forEach((value) => {
    const link = document.createElement('a');
    link.href = `/?tag=${encodeURIComponent(value)}`;
    link.textContent = value;
    container.appendChild(link);
  });
}

function populateCategoryList(posts, activeCategory = '') {
  const listEl = document.querySelector('#category-list');
  if (!listEl) return;

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

  const active = String(activeCategory || '').toLowerCase();

  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `/?category=${encodeURIComponent(category)}`;
      if (isHerCategory(category)) link.className = 'her';
      if (active && category.toLowerCase() === active) {
        link.setAttribute('aria-current', 'page');
      }

      link.append(category);
      if (isHerCategory(category)) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = HER_CATEGORY_HINTS[category];
        link.append(' ', hint);
      }

      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.setAttribute('aria-hidden', 'true');

      const number = document.createElement('span');
      number.className = 'n';
      number.textContent = String(count);

      link.append(dots, number);
      li.appendChild(link);
      listEl.appendChild(li);
    });
}

// TAGS：所有標籤不分大小寫合併、依次數排序，預設顯示前 14 個，其餘收進 Show all
function populateTagCloud(posts, activeTag = '') {
  const cloudEl = document.querySelector('#tag-cloud');
  if (!cloudEl || cloudEl.dataset.rendered === 'true') {
    markActiveTag(cloudEl, activeTag);
    return;
  }

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
    const empty = document.createElement('span');
    empty.className = 'meta';
    empty.textContent = 'No tags yet.';
    cloudEl.appendChild(empty);
    return;
  }

  const entries = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  const counts = entries.map((entry) => entry.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  const renderTags = (list, before = null) => {
    const fragment = document.createDocumentFragment();
    list.forEach((entry) => {
      const link = document.createElement('a');
      link.href = `/?tag=${encodeURIComponent(entry.label)}`;
      link.dataset.tag = entry.label.toLowerCase();
      if (HER_TAG_PATTERN.test(entry.label)) link.className = 'her';

      const size = max === min ? 0.95 : 0.85 + ((entry.count - min) / (max - min)) * 0.5;
      link.style.fontSize = `${size.toFixed(2)}rem`;

      const count = document.createElement('span');
      count.className = 'n';
      count.textContent = String(entry.count);

      link.append(entry.label, count);
      fragment.appendChild(link);
    });
    cloudEl.insertBefore(fragment, before);
  };

  renderTags(entries.slice(0, TAG_CLOUD_VISIBLE_LIMIT));

  const remainingTags = entries.slice(TAG_CLOUD_VISIBLE_LIMIT);
  if (remainingTags.length > 0) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'tag-cloud__more';
    moreBtn.textContent = `Show all (${entries.length})`;
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.addEventListener('click', () => {
      const firstNewIndex = TAG_CLOUD_VISIBLE_LIMIT;
      renderTags(remainingTags, moreBtn);
      moreBtn.remove();
      markActiveTag(cloudEl, new URLSearchParams(window.location.search).get('tag'));
      // 焦點移到展開的第一個標籤，鍵盤使用者不用從頭 Tab
      const links = cloudEl.querySelectorAll('a');
      if (links[firstNewIndex]) links[firstNewIndex].focus();
    });
    cloudEl.appendChild(moreBtn);
  }

  cloudEl.dataset.rendered = 'true';
  markActiveTag(cloudEl, activeTag);
}

function markActiveTag(cloudEl, activeTag) {
  if (!cloudEl) return;
  const active = String(activeTag || '').toLowerCase();
  cloudEl.querySelectorAll('a[data-tag]').forEach((link) => {
    if (active && link.dataset.tag === active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

async function renderMarkdownContent(slug, contentEl) {
  if (!contentEl) return;

  if (contentEl.dataset.prerendered === 'true' && contentEl.innerHTML.trim()) {
    enhanceRenderedContent(contentEl);
    return;
  }

  let markdown = null;
  const cachedMarkdown = markdownCache.get(slug);

  if (cachedMarkdown) {
    markdown = cachedMarkdown;
  } else {
    const response = await fetch(`${POSTS_ROOT}${slug}.md`);
    if (!response.ok) {
      throw new Error(`Markdown fetch failed with status ${response.status}`);
    }

    markdown = await readUtf8Text(response);
    markdownCache.set(slug, markdown);
  }

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

  enhanceRenderedContent(contentEl);
}

function enhanceRenderedContent(contentEl) {
  if (!contentEl || contentEl.dataset.enhanced === 'true') return;

  // 增強程式碼區塊
  enhanceCodeBlocks(contentEl);

  // 增強表格（響應式包裝）
  enhanceTables(contentEl);

  // Crossing Field 專訪 Q&A 樣式增強
  // 不能只檢查 data-category-theme 是否存在，否則其他分類裡的短段落
  // 也會被誤認成講者名稱，連帶套用訪談回答樣式。
  const interviewArticleEl = contentEl.closest('[data-category-theme="crossing-field"]');
  if (interviewArticleEl) {
    styleInterviewQA(contentEl);
  }

  contentEl.dataset.enhanced = 'true';
}

function styleInterviewQA(contentEl) {
  if (!contentEl) return;
  const children = Array.from(contentEl.children);
  let isAnswer = false;
  let hasDialogueContext = false;
  let pendingSpeaker = null;
  let currentSpeaker = null;
  const knownSpeakers = new Set(['LiSA', '媽媽', '母親']);

  children.forEach(child => {
    const text = child.textContent.trim();
    const isQuestion = child.tagName === 'P' && text.startsWith('——');
    const isSpeaker = child.tagName === 'P' &&
      /^[\p{L}\p{N}・ー・]+$/u.test(text) &&
      text.length > 0 &&
      text.length <= 8;
    const multilineSpeakerMatch = child.tagName === 'P'
      ? text.match(/^([\p{L}\p{N}・ー・]{1,8})\n+([\s\S]+)$/u)
      : null;
    const spacedSpeakerMatch = child.tagName === 'P'
      ? text.match(/^([\p{L}\p{N}・ー・]{1,8})[ \u3000]+([\s\S]+)$/u)
      : null;
    const inlineSpeaker = multilineSpeakerMatch && knownSpeakers.has(multilineSpeakerMatch[1])
      ? { speaker: multilineSpeakerMatch[1], content: multilineSpeakerMatch[2], mode: 'multiline' }
      : spacedSpeakerMatch && knownSpeakers.has(spacedSpeakerMatch[1])
      ? { speaker: spacedSpeakerMatch[1], content: spacedSpeakerMatch[2], mode: 'inline' }
      : null;

    if (isQuestion) {
      child.classList.add('cf-question');
      isAnswer = true;
      hasDialogueContext = true;
      currentSpeaker = null;
      pendingSpeaker = null;
    } else if (isSpeaker) {
      child.classList.add('cf-speaker');
      knownSpeakers.add(text);
      isAnswer = true;
      hasDialogueContext = true;
      currentSpeaker = text;
      pendingSpeaker = text;
    } else if (inlineSpeaker && (hasDialogueContext || inlineSpeaker.mode === 'multiline')) {
      isAnswer = true;
      hasDialogueContext = true;
      currentSpeaker = inlineSpeaker.speaker;
      child.classList.add('cf-answer', 'cf-answer--speaker-start');
      child.dataset.speaker = currentSpeaker;
      child.textContent = inlineSpeaker.content;
      pendingSpeaker = null;
    } else if (child.tagName === 'HR' || child.tagName === 'H2' ||
               (child.tagName === 'DIV' && child.classList.contains('crossing-field-toc')) ||
               (child.tagName === 'DIV' && child.classList.contains('crossing-field-intro')) ||
               (child.tagName === 'DIV' && child.classList.contains('crossing-field-serial'))) {
      isAnswer = false;
      hasDialogueContext = false;
      currentSpeaker = null;
      pendingSpeaker = null;
    } else if (isAnswer && (child.tagName === 'P' || child.tagName === 'UL' || child.tagName === 'OL')) {
      child.classList.add('cf-answer');

      if (currentSpeaker) {
        child.dataset.speaker = currentSpeaker;
      }

      if (pendingSpeaker) {
        child.classList.add('cf-answer--speaker-start');
        child.dataset.speaker = pendingSpeaker;
        pendingSpeaker = null;
      }
    }
  });
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

function enhanceTables(contentEl) {
  if (!contentEl) return;

  const tables = contentEl.querySelectorAll('table');
  tables.forEach((table) => {
    // 檢查是否已經包裝過
    if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) {
      return;
    }

    // 建立 wrapper 並包裝表格
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
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
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 佔位符只用私用區字元：沒有任何 token 規則會比對到它，escapeHtml 也不會動到它
const TOKEN_PLACEHOLDER_OPEN = '';
const TOKEN_PLACEHOLDER_CLOSE = '';
const TOKEN_DIGIT_BASE = 0xE100;
const TOKEN_PLACEHOLDER_PATTERN = /([-]+)/g;
const PRIVATE_USE_PATTERN = /[-]/;

function highlightLine(line) {
  if (!line.trim() || PRIVATE_USE_PATTERN.test(line)) return escapeHtml(line);

  const tokens = [];

  // 比對到的片段先換成佔位符，最後才整行跳脫一次再換回來，
  // 原始碼裡的 &、<、> 只會被跳脫一次（以前先跳脫再比對運算子，& 會變成 &amp;）
  function protect(match, tokenClass) {
    const id = String(tokens.length)
      .split('')
      .map((digit) => String.fromCharCode(TOKEN_DIGIT_BASE + Number(digit)))
      .join('');
    tokens.push(`<span class="token ${tokenClass}">${escapeHtml(match)}</span>`);
    return `${TOKEN_PLACEHOLDER_OPEN}${id}${TOKEN_PLACEHOLDER_CLOSE}`;
  }

  let result = line;

  // 1. 字串
  result = result.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (match) => protect(match, 'string'));

  // 2. 關鍵字
  result = result.replace(/\b(function|const|let|var|if|else|for|while|return|class|extends|import|export|from|default|async|await|try|catch|finally|throw|new|this|super)\b/g, (match) => protect(match, 'keyword'));

  // 3. 數字
  result = result.replace(/\b(\d+)\b/g, (match) => protect(match, 'number'));

  // 4. 內建物件
  result = result.replace(/\b(document|window|console|Array|Object|String|Number|Boolean|Date|RegExp|Math|JSON)\b/g, (match) => protect(match, 'variable'));

  // 5. 運算子與標點（含 < 和 >）
  result = result.replace(/[+\-*/%=!&|<>]{1,3}|[;:,(){}[\]]/g, (match) => protect(match, 'punctuation'));

  // 6. 剩下的文字跳脫一次，再把佔位符換回 token
  return escapeHtml(result).replace(TOKEN_PLACEHOLDER_PATTERN, (_, id) => {
    const index = Number(
      id.split('').map((char) => char.charCodeAt(0) - TOKEN_DIGIT_BASE).join('')
    );
    return tokens[index];
  });
}

function renderShareLinks(post) {
  const shareEl = document.querySelector('#share-links');
  if (!shareEl) return;

  shareEl.innerHTML = '';

  const pageUrl = new URL(window.location.href);
  pageUrl.hash = '';

  // 在數組定義前保存這些值，避免 minify 後的變量遮蔽問題
  const postTitle = post.title || 'New post on b-log';
  const urlString = pageUrl.toString();

  const shareLabel = document.createElement('span');
  shareLabel.className = 'meta';
  shareLabel.textContent = 'SHARE';
  shareEl.appendChild(shareLabel);

  const shareItems = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(urlString)}`,
      external: true,
    },
    {
      label: 'FACEBOOK',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlString)}`,
      external: true,
    },
    {
      label: 'COPY LINK',
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

  setupCopyLink(shareEl, urlString);
}

function renderNavigation(posts, index) {
  const prevEl = document.querySelector('#post-nav-prev');
  const nextEl = document.querySelector('#post-nav-next');

  if (!prevEl || !nextEl) return;

  const newer = index > 0 ? posts[index - 1] : null;
  const older = index < posts.length - 1 ? posts[index + 1] : null;

  configureNavLink(prevEl, newer, '‹ NEWER');
  configureNavLink(nextEl, older, 'OLDER ›');
}

function configureNavLink(element, post, labelText) {
  if (!element) return;

  const label = document.createElement('span');
  label.className = 'article-nav__label';
  label.textContent = labelText;

  const title = document.createElement('span');
  title.className = 'article-nav__title';

  if (post) {
    title.textContent = post.title || post.slug;
    element.href = slugToPath(post.slug, post.category);
    element.classList.remove('is-disabled');
    element.removeAttribute('aria-disabled');
    element.tabIndex = 0;
  } else {
    title.textContent = labelText.includes('NEWER') ? '已經是最新一篇' : '已經是最早一篇';
    element.classList.add('is-disabled');
    element.setAttribute('aria-disabled', 'true');
    element.removeAttribute('href');
    element.tabIndex = -1;
  }

  element.replaceChildren(label, title);
}

function renderRelatedPosts(posts, currentPost) {
  const relatedList = document.querySelector('#related-list');
  const latestList = document.querySelector('#latest-sidebar');

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

  // 靜態頁已經由 generate-redirects.js 輸出這兩個清單，只補未預先渲染的情況
  if (relatedList && relatedList.dataset.prerendered !== 'true') {
    relatedList.innerHTML = '';

    if (!related.length) {
      const li = document.createElement('li');
      li.className = 'row--empty';
      li.textContent = 'More posts arriving soon.';
      relatedList.appendChild(li);
    } else {
      related.forEach((post) => {
        relatedList.appendChild(buildSideRow(post));
      });
    }
  }

  if (latestList && latestList.dataset.prerendered !== 'true') {
    latestList.innerHTML = '';
    // LATEST 排除目前這篇和已經列在 RELATED 的文章
    const excluded = new Set([currentPost.slug, ...related.map((post) => post.slug)]);
    const latest = posts.filter((post) => !excluded.has(post.slug)).slice(0, 3);
    latest.forEach((post) => {
      latestList.appendChild(buildSideRow(post));
    });
  }

  // 初始化 Giscus 留言系統
  if (document.getElementById('giscus-container')) {
    GiscusManager.init();
  }
}

// ECAM meta 行：24SEP26 · 技術開發 · 5 MIN · JASON CHIEN
function formatMetaParts(post, { includeAuthor = true } = {}) {
  const parts = [];
  const publishedDate = formatEcamDate(post.publishedDate);
  if (publishedDate) {
    parts.push(publishedDate);
  }
  if (post.category) {
    parts.push(post.category);
  }
  const readingTime = formatReadingTime(post);
  if (readingTime) {
    parts.push(readingTime);
  }
  if (includeAuthor && post.author) {
    const author = post.author.toUpperCase();
    parts.push(post.category === 'Crossing Field' ? `${author} 譯` : author);
  }
  const updatedDate = formatEcamDate(post.updatedDate);
  if (updatedDate && updatedDate !== publishedDate) {
    parts.push(`UPDATED ${updatedDate}`);
  }
  return parts;
}

// 24SEP26（台北時間）
function formatEcamDate(date) {
  if (!date) return '';
  const parts = new Intl.DateTimeFormat(META_DATE_LOCALE, {
    year: '2-digit',
    month: 'numeric',
    day: '2-digit',
    timeZone: META_DATE_TIME_ZONE,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  const month = MONTHS[Number.parseInt(get('month'), 10) - 1] || '';
  return `${get('day')}${month}${get('year')}`;
}

function formatReadingTime(post) {
  const value = String(post.readingTime || '').trim();
  return value ? value.toUpperCase() : '';
}

function isHerCategory(category) {
  return Object.prototype.hasOwnProperty.call(HER_CATEGORY_HINTS, category);
}

// STATUS 面板（靜態頁已由 generate-redirects.js 產生，這裡只補未預先渲染的情況）
function buildStatusInnerHTML(status) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) return '';

  const listItems = (key) => (Array.isArray(status[key])
    ? status[key].filter((item) => typeof item === 'string' && item.trim())
    : []);
  const leftItems = [
    ...listItems('resolved').map((item) => `<li class="ok"><span class="k">已修</span>${escapeHtml(item)}</li>`),
    ...listItems('procedures').map((item) => `<li class="proc"><span class="k">程序</span>${escapeHtml(item)}</li>`),
  ];
  const rightGroups = [
    ['inop', 'INOP SYS'],
    ['open', '未定'],
  ]
    .map(([key, title]) => {
      const items = listItems(key);
      if (!items.length) return '';
      return `<h3 class="status__sub">${title}</h3><ul>${items.map((item) => `<li class="caut">${escapeHtml(item)}</li>`).join('')}</ul>`;
    })
    .filter(Boolean);

  if (!leftItems.length && !rightGroups.length) return '';

  const columns = [];
  if (leftItems.length) columns.push(`<ul>${leftItems.join('')}</ul>`);
  if (rightGroups.length) columns.push(`<div>${rightGroups.join('')}</div>`);
  const gridClass = columns.length === 1 ? 'status__grid status__grid--single' : 'status__grid';

  return `<h2 class="status__title" id="status-title">STATUS</h2><div class="${gridClass}">${columns.join('')}</div>`;
}

// 文章封面：有封面才顯示，沒有封面就整塊隱藏（不再用 accentColor 漸層）。
// 封面跟內文某張圖是同一張時也隱藏，只留內文那張（規則跟 generate-redirects.js 一樣）
function renderArticleCover(element, post, contentEl) {
  if (!element) return;

  if (!post.coverImage || coverAppearsInBody(post.coverImage, contentEl)) {
    element.replaceChildren();
    element.hidden = true;
    return;
  }

  element.hidden = false;
  const existingImage = element.querySelector('.post__cover-img');
  const resolvedCoverImage = new URL(post.coverImage, window.location.origin).href;
  if (
    existingImage &&
    (
      existingImage.getAttribute('src') === post.coverImage ||
      existingImage.currentSrc === resolvedCoverImage
    )
  ) {
    return;
  }

  const coverImage = document.createElement('img');
  coverImage.className = 'post__cover-img';
  coverImage.src = post.coverImage;
  coverImage.alt = '';
  coverImage.decoding = 'async';
  coverImage.fetchPriority = 'high';
  coverImage.setAttribute('aria-hidden', 'true');
  element.replaceChildren(coverImage);
}

// CONTENTS：最外層 h2 補 id、產生目錄（靜態頁已由 generate-redirects.js 輸出，只補未預先渲染的情況）
function renderArticleToc(contentEl) {
  const tocEl = document.querySelector('#post-toc');
  if (!contentEl || !tocEl) return;

  if (tocEl.dataset.prerendered !== 'true') {
    const headings = ensureHeadingIds(contentEl);
    const items = headings
      .map((heading) => ({ id: heading.id, text: heading.textContent.trim() }))
      .filter((item) => item.text);

    if (items.length >= TOC_MIN_HEADINGS) {
      tocEl.className = contentEl.querySelector('.crossing-field-toc') ? 'aside-toc aside-toc--cf' : 'aside-toc';
      const label = document.createElement('h2');
      label.className = 'label';
      label.id = 'toc-label';
      const hint = document.createElement('span');
      hint.textContent = '本文目錄';
      label.append('CONTENTS ', hint);

      const list = document.createElement('ol');
      list.className = 'toc-list';
      items.forEach(({ id, text }) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${id}`;
        link.textContent = text;
        li.appendChild(link);
        list.appendChild(li);
      });

      tocEl.replaceChildren(label, list);
      tocEl.hidden = false;
    } else {
      tocEl.replaceChildren();
      tocEl.hidden = true;
    }
  }

  initTocHighlight(tocEl.hidden ? null : tocEl);
}

// 最外層 h2 缺 id 的補上 section-N（N 是第幾個 h2），已有的 id 不動、撞名加後綴
function ensureHeadingIds(contentEl) {
  const usedIds = new Set(Array.from(document.querySelectorAll('[id]'), (element) => element.id));
  const headings = Array.from(contentEl.children).filter((element) => element.tagName === 'H2');
  headings.forEach((heading, index) => {
    if (heading.id) return;
    const candidate = `section-${index + 1}`;
    let id = candidate;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${candidate}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    heading.id = id;
  });
  return headings;
}

// 去掉 https://b-log.to 與 -480w／-828w／-1200w 後綴，再補上開頭的 /
function normalizeImagePath(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/b-log\.to/i, '')
    .replace(/^(?!\/)/, '/')
    .replace(/-(?:480|828|1200)w(\.[a-z0-9]+)$/i, '$1');
}

function coverAppearsInBody(coverImage, contentEl) {
  if (!coverImage || !contentEl) return false;
  const cover = normalizeImagePath(coverImage);
  return Array.from(contentEl.querySelectorAll('img[src]')).some(
    (image) => normalizeImagePath(image.getAttribute('src')) === cover
  );
}

function getCategoryTheme(post) {
  const mapping = getCategoryMapping();
  const category = post?.category;
  if (!category || !mapping[category]) return '';
  return mapping[category];
}

function applyCategoryTheme(element, post) {
  if (!element) return;

  const theme = getCategoryTheme(post);
  if (theme) {
    element.dataset.categoryTheme = theme;
  } else {
    delete element.dataset.categoryTheme;
  }
}

function slugToPath(slug, category) {
  const mapping = getCategoryMapping();
  const categorySlug = category && mapping[category] ? mapping[category] : 'uncategorized';
  return `/${categorySlug}/${slug}/`;
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
      trigger.textContent = 'COPIED';
    } catch (error) {
      window.prompt('Copy this URL', url);
      trigger.textContent = 'COPIED';
    }

    setTimeout(() => {
      trigger.textContent = originalLabel;
    }, 2000);
  });
}

function updatePageMetadata(post) {
  // 使用 WordPress 風格的 URL，指向預渲染的靜態頁面
  // 這樣社群平台爬蟲才能看到正確的 meta 標籤（爬蟲不執行 JavaScript）
  const postPath = slugToPath(post.slug, post.category);
  const postUrl = `${SITE_BASE_URL}/${postPath.startsWith('/') ? postPath.substring(1) : postPath}`;

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
    descriptionEl.content = post.summary || DEFAULT_META_DESCRIPTION;
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
  updateMetaProperty('og:image', getPostImage(post, SITE_BASE_URL));
  updateMetaProperty('article:author', post.author || 'Jason Chien');
  updateMetaProperty('article:published_time', post.publishedAt || '');
  updateMetaProperty('article:modified_time', post.updatedAt || post.publishedAt || '');
  updateMetaProperty('article:section', post.category || '');
  
  // 更新文章標籤 - 每個標籤都需要單獨的 meta property
  document.querySelectorAll('meta[property="article:tag"]').forEach(el => el.remove());
  if (Array.isArray(post.tags)) {
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
  updateMetaProperty('twitter:image', getPostImage(post, SITE_BASE_URL));
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
      return `${baseUrl}${post.coverImage}`;
    }
    // 如果是相對路徑（不以 / 開頭）
    if (!post.coverImage.startsWith('http')) {
      return `${baseUrl}/${post.coverImage}`;
    }
    // 如果是完整 URL，直接使用
    return post.coverImage;
  }

  const encodedTitle = encodeURIComponent(post.title || 'Untitled Post');
  return (
    `https://res.cloudinary.com/${CLOUDINARY_OG_IMAGE_CONFIG.cloudName}/image/upload/` +
    'c_fill,w_1200,h_630/' +
    'co_rgb:ffffff,' +
    `l_text:${CLOUDINARY_OG_IMAGE_CONFIG.fontId}_60_center:${encodedTitle},w_1000,c_fit/` +
    'fl_layer_apply,g_center/' +
    `${CLOUDINARY_OG_IMAGE_CONFIG.backgroundId}.png`
  );
}

// ============================================================
// View Transition API 支援
// ============================================================

/**
 * 為文章卡片添加 view-transition-name
 * 這樣在導航時可以有流暢的過渡效果
 */
function setupViewTransitionNames() {
  // 首頁 LATEST 的標題與文章頁標題用同一個名字，換頁時接起來
  const featuredSection = document.querySelector('#featured');
  const featuredTitle = document.querySelector('#hero-title');
  if (featuredSection && featuredTitle && featuredSection.dataset.featuredSlug) {
    featuredTitle.style.viewTransitionName = `post-title-${featuredSection.dataset.featuredSlug}`;
  }

  // 文章頁的標題與封面
  const postTitle = document.querySelector('#post-title');
  const postHero = document.querySelector('#post-hero');
  const slug = extractSlugFromUrl(new URL(window.location.href));
  if (slug && postTitle) {
    postTitle.style.viewTransitionName = `post-title-${slug}`;
  }
  if (slug && postHero && !postHero.hidden) {
    postHero.style.viewTransitionName = `post-hero-${slug}`;
  }
}

/**
 * 從 URL 提取 slug
 */
function extractSlugFromUrl(urlObj) {
  const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'index.html' && p !== 'post.html');
  if (pathParts.length >= 2) {
    return pathParts[pathParts.length - 1];
  }

  return null;
}

// 在頁面載入完成後設定 View Transition Names
document.addEventListener('DOMContentLoaded', () => {
  setupViewTransitionNames();
});
