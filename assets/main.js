const POSTS_JSON = '/data/posts.json';
const POSTS_ROOT = '/content/posts/';
const GITHUB_USERNAME = 'jason5545';
const GITHUB_REPO = 'b-log';

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

document.addEventListener('DOMContentLoaded', () => {
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

  const posts = await loadNormalizedPosts();

  if (!posts.length) {
    if (postsEmptyEl) postsEmptyEl.hidden = false;
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
    breadcrumbCurrent.textContent = `/ ${post.title || slug}`;
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

  const markdown = await readUtf8Text(response);
  if (window.marked) {
    contentEl.innerHTML = window.marked.parse(markdown);
  } else {
    contentEl.textContent = markdown;
  }
  
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
    
    // 替換原始結構
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

    // 普通代碼行
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
  if (!line.trim()) return line;

  let result = escapeHtml(line);

  // 處理字符串（先處理以避免字符串內的內容被高亮）
  const stringPattern = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const strings = [];
  result = result.replace(stringPattern, (match) => {
    const index = strings.length;
    strings.push(`<span class="token string">${match}</span>`);
    return `___STRING_${index}___`;
  });

  // 處理關鍵字
  result = result.replace(/\b(function|const|let|var|if|else|for|while|return|class|extends|import|export|from|default|async|await|try|catch|finally|throw|new|this|super)\b/g,
    '<span class="token keyword">$1</span>');

  // 處理數字
  result = result.replace(/\b(\d+)\b/g, '<span class="token number">$1</span>');

  // 處理內建對象
  result = result.replace(/\b(document|window|console|Array|Object|String|Number|Boolean|Date|RegExp|Math|JSON)\b/g,
    '<span class="token variable">$1</span>');

  // 處理運算符和標點
  result = result.replace(/([+\-*/%=<>!&|]{1,3}|[;:,(){}[\]])/g, '<span class="token punctuation">$1</span>');

  // 還原字符串
  strings.forEach((str, index) => {
    result = result.replace(`___STRING_${index}___`, str);
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
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(pageUrl.toString())}&title=${encodeURIComponent(post.title || 'New post on b-log')}`,
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
    '開發哲學': 'dev-philosophy'
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
