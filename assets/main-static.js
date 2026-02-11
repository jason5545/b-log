const POSTS_JSON = '/data/posts.json';
const DEFAULT_CATEGORY_MAPPING = {
  'AI 分析': 'ai-analysis',
  '技術開發': 'tech-development',
  '技術分析': 'tech-analysis',
  '開發哲學': 'dev-philosophy',
  '生活記事': 'life-stories',
  '商業觀察': 'business-insights',
  '文化觀察': 'cultural-insights'
};

let categoryMapping = null;

async function loadCategoryMapping() {
  if (categoryMapping) return categoryMapping;

  try {
    const response = await fetch('/config/categories.json');
    const config = await response.json();
    categoryMapping = config.categoryMapping;
    return categoryMapping;
  } catch (error) {
    console.error('無法載入分類設定，使用預設值', error);
    categoryMapping = DEFAULT_CATEGORY_MAPPING;
    return categoryMapping;
  }
}

const ThemeManager = {
  STORAGE_KEY: 'theme-preference',
  THEMES: ['light', 'dark', 'auto'],

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY) || 'auto';
    this.setTheme(saved, false);

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

    const configs = {
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

    const config = configs[currentTheme] || configs.auto;

    if (iconContainer) iconContainer.innerHTML = config.svg;
    if (text) text.textContent = config.text;
  }
};

async function goToRandomPost(event) {
  if (event) event.preventDefault();

  try {
    const response = await fetch(POSTS_JSON);
    const posts = await response.json();

    if (!posts || posts.length === 0) {
      console.warn('沒有可用的文章');
      return;
    }

    const randomIndex = Math.floor(Math.random() * posts.length);
    const randomPost = posts[randomIndex];

    const mapping = await loadCategoryMapping();
    const categorySlug = mapping[randomPost.category] || 'uncategorized';
    const url = `/${categorySlug}/${randomPost.slug}/`;

    window.location.href = url;
  } catch (error) {
    console.error('載入隨機文章失敗', error);
  }
}

function initSearch() {
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

  searchToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSearchBox();
  });

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();

    if (searchClear) {
      searchClear.hidden = !value;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      redirectToHomeWithSearch(value);
    }, 300);
  });

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.hidden = true;
      redirectToHomeWithSearch('');
      searchInput.focus();
    });
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      redirectToHomeWithSearch(searchInput.value.trim());
    }

    if (e.key === 'Escape') {
      closeSearchBox();
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target) && !searchToggleBtn.contains(e.target)) {
      if (!searchInput.value.trim()) {
        closeSearchBox();
      }
    }
  });

  searchBox.addEventListener('click', (e) => {
    e.stopPropagation();
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

function redirectToHomeWithSearch(searchQuery) {
  const homeUrl = searchQuery
    ? `/?search=${encodeURIComponent(searchQuery)}`
    : '/';
  window.location.href = homeUrl;
}

window.ThemeManager = ThemeManager;
window.goToRandomPost = goToRandomPost;

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  initSearch();
  loadCategoryMapping().catch((error) => {
    console.warn('[init] failed to load category mapping', error);
  });
});
