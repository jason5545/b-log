export const POSTS_JSON = '/data/posts.json';

export const DEFAULT_CATEGORY_MAPPING = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy',
  '生活記事': 'life-stories',
  '商業觀察': 'business-insights',
  '文化觀察': 'cultural-insights',
  'Crossing Field': 'crossing-field',
  'シルシ': 'shirushi'
};

const THEME_TOGGLE_CONFIGS = {
  light: {
    svg: `<svg class="theme-icon theme-icon--light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,
    text: 'Light'
  },
  dark: {
    svg: `<svg class="theme-icon theme-icon--dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    text: 'Dark'
  },
  auto: {
    svg: `<svg class="theme-icon theme-icon--auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 12c0 5.25-4.25 9.5-9.5 9.5S2.5 17.25 2.5 12 6.75 2.5 12 2.5s9.5 4.25 9.5 9.5z"/>
      <path d="M12 2.5v19M21.5 12h-19M18.36 5.64l-12.72 12.72M18.36 18.36L5.64 5.64"/>
    </svg>`,
    text: 'Auto'
  }
};

export function createCategoryMappingStore({
  configPath = '/config/categories.json',
  fallbackMapping = DEFAULT_CATEGORY_MAPPING,
  logger = console
} = {}) {
  let categoryMapping = null;
  let categoryMappingPromise = null;

  return {
    get() {
      return categoryMapping || fallbackMapping;
    },

    async load() {
      if (categoryMapping) return categoryMapping;
      if (categoryMappingPromise) return categoryMappingPromise;

      categoryMappingPromise = (async () => {
        try {
          const response = await fetch(configPath);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const config = await response.json();
          categoryMapping = config.categoryMapping;
          return categoryMapping;
        } catch (error) {
          logger.error('無法載入分類設定，使用預設值', error);
          categoryMapping = fallbackMapping;
          return categoryMapping;
        } finally {
          categoryMappingPromise = null;
        }
      })();

      return categoryMappingPromise;
    }
  };
}

export function createThemeManager({ onThemeApplied } = {}) {
  return {
    STORAGE_KEY: 'theme-preference',
    THEMES: ['light', 'dark', 'auto'],

    init() {
      const saved = localStorage.getItem(this.STORAGE_KEY) || 'auto';
      this.setTheme(saved, false);

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.getCurrentTheme() === 'auto') {
          this.applyTheme();
          if (onThemeApplied) {
            onThemeApplied(this);
          }
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
      if (onThemeApplied) {
        onThemeApplied(this);
      }
    },

    applyTheme() {
      const currentTheme = this.getCurrentTheme();
      const root = document.documentElement;

      if (currentTheme === 'auto') {
        root.removeAttribute('data-theme');
      } else {
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
      const iconContainer = button.querySelector('.theme-toggle__icon');
      const text = button.querySelector('.theme-toggle__text');
      const config = THEME_TOGGLE_CONFIGS[currentTheme] || THEME_TOGGLE_CONFIGS.auto;

      if (iconContainer) {
        iconContainer.innerHTML = config.svg;
      }
      if (text) {
        text.textContent = config.text;
      }
    }
  };
}

export function createRandomPostHandler({
  postsJsonPath = POSTS_JSON,
  loadCategoryMapping,
  logger = console
} = {}) {
  return async function goToRandomPost(event) {
    if (event) event.preventDefault();

    try {
      const response = await fetch(postsJsonPath);
      const posts = await response.json();

      if (!posts || posts.length === 0) {
        logger.warn('沒有可用的文章');
        return;
      }

      const randomIndex = Math.floor(Math.random() * posts.length);
      const randomPost = posts[randomIndex];
      const mapping = await loadCategoryMapping();
      const categorySlug = mapping[randomPost.category] || 'uncategorized';
      const url = `/${categorySlug}/${randomPost.slug}/`;

      window.location.href = url;
    } catch (error) {
      logger.error('載入隨機文章失敗', error);
    }
  };
}

export function initSearchUI({ onSearch } = {}) {
  const searchToggleBtn = document.querySelector('.search-toggle-btn');
  const searchBox = document.querySelector('.search-box');
  const searchInput = document.querySelector('#search-input');
  const searchClear = document.querySelector('#search-clear');

  if (!searchInput || !searchToggleBtn || !searchBox) return;

  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get('search');
  if (searchQuery) {
    searchInput.value = searchQuery;
    if (searchClear) searchClear.hidden = false;
    openSearchBox();
  }

  searchToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSearchBox();
  });

  let debounceTimer;
  searchInput.addEventListener('input', (event) => {
    const value = event.target.value.trim();

    if (searchClear) {
      searchClear.hidden = !value;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (onSearch) {
        onSearch(value);
      }
    }, 300);
  });

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.hidden = true;
      if (onSearch) {
        onSearch('');
      }
      searchInput.focus();
    });
  }

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(debounceTimer);
      if (onSearch) {
        onSearch(searchInput.value.trim());
      }
    }

    if (event.key === 'Escape') {
      closeSearchBox();
    }
  });

  document.addEventListener('click', (event) => {
    if (!searchBox.contains(event.target) && !searchToggleBtn.contains(event.target)) {
      if (!searchInput.value.trim()) {
        closeSearchBox();
      }
    }
  });

  searchBox.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  function toggleSearchBox() {
    const isExpanded = searchToggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeSearchBox();
    } else {
      openSearchBox();
    }
  }

  function openSearchBox() {
    searchBox.hidden = false;
    searchToggleBtn.setAttribute('aria-expanded', 'true');
    searchToggleBtn.classList.add('active');

    requestAnimationFrame(() => {
      searchBox.classList.add('expanded');
      setTimeout(() => {
        searchInput.focus();
      }, 150);
    });
  }

  function closeSearchBox() {
    searchBox.classList.remove('expanded');
    searchToggleBtn.setAttribute('aria-expanded', 'false');
    searchToggleBtn.classList.remove('active');

    setTimeout(() => {
      if (!searchBox.classList.contains('expanded')) {
        searchBox.hidden = true;
      }
    }, 300);
  }
}
