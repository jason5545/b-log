const POSTS_JSON = 'data/posts.json';
const POSTS_ROOT = 'content/posts/';
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
        linkEl.href = slugToPath(post.slug);
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
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
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
      const span = document.createElement('span');
      span.textContent = part;
      metaEl.appendChild(span);
    });
  }

  populateTagBadges(tagsEl, post.tags);
  await renderMarkdownContent(slug, contentEl);
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
    heroLink.href = slugToPath(post.slug);
    heroLink.textContent = post.title || post.slug;
  }

  if (heroMeta) {
    heroMeta.textContent = formatMetaParts(post).join(' | ');
  }

  if (heroSummary) {
    heroSummary.textContent = post.summary || '';
  }

  if (heroReadMore) {
    heroReadMore.href = slugToPath(post.slug);
  }

  if (heroDiscuss) {
    heroDiscuss.href = `${slugToPath(post.slug)}#comments`;
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
    element.href = slugToPath(post.slug);
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
    commentsLink.href = `https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(`Comment: ${currentPost.title || currentPost.slug}`)}&labels=discussion`;
  }
}

function buildRelatedItem(post) {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.href = slugToPath(post.slug);
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

function slugToPath(slug) {
  return `post.html?slug=${encodeURIComponent(slug)}`;
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
