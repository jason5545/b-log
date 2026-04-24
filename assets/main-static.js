import {
  createCategoryMappingStore,
  createRandomPostHandler,
  createThemeManager,
  initSearchUI,
  initWebMcpTools,
} from './shared-ui.js';

const categoryMappingStore = createCategoryMappingStore();
const loadCategoryMapping = () => categoryMappingStore.load();

const ThemeManager = createThemeManager();
const goToRandomPost = createRandomPostHandler({
  loadCategoryMapping,
});

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
  initSearchUI({ onSearch: redirectToHomeWithSearch });
  initWebMcpTools({ loadCategoryMapping });
  loadCategoryMapping().catch((error) => {
    console.warn('[init] failed to load category mapping', error);
  });
});
