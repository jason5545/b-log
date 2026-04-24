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

function clampToolLimit(value, fallback = 10, max = 20) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildPostUrl(post, categoryMapping) {
  const categorySlug = categoryMapping[post.category] || 'uncategorized';
  return `/${categorySlug}/${post.slug}/`;
}

function toAgentPost(post, categoryMapping) {
  const path = buildPostUrl(post, categoryMapping);
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    category: post.category,
    tags: post.tags || [],
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt || post.publishedAt,
    url: new URL(path, window.location.origin).href,
    markdownUrl: new URL(`/content/posts/${post.slug}.md`, window.location.origin).href,
  };
}

async function fetchPostsForAgent(postsJsonPath = POSTS_JSON) {
  const response = await fetch(postsJsonPath);
  if (!response.ok) {
    throw new Error(`Unable to load posts catalog: HTTP ${response.status}`);
  }

  const posts = await response.json();
  if (!Array.isArray(posts)) {
    throw new Error('Invalid posts catalog');
  }

  return posts;
}

function postMatchesQuery(post, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return true;

  const haystacks = [
    post.title,
    post.summary,
    post.category,
    ...(Array.isArray(post.tags) ? post.tags : []),
  ];

  return haystacks.some((value) => String(value || '').toLowerCase().includes(normalized));
}

export function initWebMcpTools({
  postsJsonPath = POSTS_JSON,
  loadCategoryMapping,
  logger = console
} = {}) {
  const modelContext = navigator.modelContext;
  if (!modelContext) {
    return;
  }

  const canRegisterTools = typeof modelContext.registerTool === 'function';
  const canProvideContext = typeof modelContext.provideContext === 'function';
  if (!canRegisterTools && !canProvideContext) {
    return;
  }

  const abortController = new AbortController();

  const withCatalog = async (callback) => {
    const [posts, categoryMapping] = await Promise.all([
      fetchPostsForAgent(postsJsonPath),
      loadCategoryMapping ? loadCategoryMapping() : Promise.resolve(DEFAULT_CATEGORY_MAPPING),
    ]);

    return callback(posts, categoryMapping);
  };

  const tools = [
    {
      name: 'search_posts',
      description: 'Search public b-log posts by title, summary, category, or tag.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query.'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of results to return.'
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      execute: async ({ query, limit } = {}) => withCatalog((posts, categoryMapping) => {
        const resultLimit = clampToolLimit(limit);
        const results = posts
          .filter((post) => postMatchesQuery(post, query))
          .slice(0, resultLimit)
          .map((post) => toAgentPost(post, categoryMapping));

        return { query, count: results.length, posts: results };
      })
    },
    {
      name: 'get_latest_posts',
      description: 'Return the latest public b-log posts with canonical URLs and Markdown URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of posts to return.'
          }
        },
        additionalProperties: false
      },
      execute: async ({ limit } = {}) => withCatalog((posts, categoryMapping) => {
        const resultLimit = clampToolLimit(limit, 10);
        return {
          count: Math.min(posts.length, resultLimit),
          posts: posts.slice(0, resultLimit).map((post) => toAgentPost(post, categoryMapping))
        };
      })
    },
    {
      name: 'get_post_markdown',
      description: 'Fetch the raw Markdown source for a public b-log post.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
            description: 'Post slug.'
          }
        },
        required: ['slug'],
        additionalProperties: false
      },
      execute: async ({ slug } = {}) => {
        if (!/^[a-z0-9-]+$/.test(slug || '')) {
          throw new Error('Invalid slug');
        }

        return withCatalog(async (posts, categoryMapping) => {
          const post = posts.find((item) => item.slug === slug);
          if (!post) {
            throw new Error('Post not found');
          }

          const response = await fetch(`/content/posts/${slug}.md`);
          if (!response.ok) {
            throw new Error(`Unable to load Markdown: HTTP ${response.status}`);
          }

          return {
            post: toAgentPost(post, categoryMapping),
            markdown: await response.text()
          };
        });
      }
    },
    {
      name: 'get_site_resources',
      description: 'Return machine-readable resources available for agents on b-log.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async () => ({
        resources: [
          { rel: 'api-catalog', url: new URL('/.well-known/api-catalog', window.location.origin).href },
          { rel: 'service-desc', url: new URL('/.well-known/openapi.json', window.location.origin).href },
          { rel: 'service-doc', url: new URL('/docs/agent-api.md', window.location.origin).href },
          { rel: 'agent-skills', url: new URL('/.well-known/agent-skills/index.json', window.location.origin).href },
          { rel: 'posts-catalog', url: new URL('/data/posts.json', window.location.origin).href },
          { rel: 'json-feed', url: new URL('/feed.json', window.location.origin).href },
          { rel: 'sitemap', url: new URL('/sitemap.xml', window.location.origin).href },
        ]
      })
    }
  ];

  if (canRegisterTools) {
    for (const tool of tools) {
      try {
        modelContext.registerTool(tool, { signal: abortController.signal });
      } catch (error) {
        logger.warn(`[webmcp] failed to register ${tool.name}`, error);
      }
    }
  } else if (canProvideContext) {
    try {
      modelContext.provideContext({ tools }, { signal: abortController.signal });
    } catch (error) {
      logger.warn('[webmcp] failed to provide tools', error);
    }
  }

  window.addEventListener('pagehide', () => abortController.abort(), { once: true });
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
