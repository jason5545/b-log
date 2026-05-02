const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SITE_BASE_URL = 'https://b-log.to';

const paths = {
  posts: path.join(ROOT_DIR, 'data/posts.json'),
  categories: path.join(ROOT_DIR, 'config/categories.json'),
  state: path.join(ROOT_DIR, 'data/facebook-published.json'),
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || process.env.DRY_RUN === '1';
const force = args.has('--force') || process.env.FORCE_SOCIAL_POST === '1';
const targetSlug = process.env.POST_SLUG || '';
const graphApiVersion = process.env.FB_GRAPH_API_VERSION || 'v25.0';
const publishBaseline = args.has('--baseline') || process.env.PUBLISH_BASELINE === '1';
const includeOriginalDate = args.has('--include-original-date') || process.env.INCLUDE_ORIGINAL_DATE === '1';
const postLimit = Number.parseInt(process.env.POST_LIMIT || '', 10);
const publishDelayMs = Number.parseInt(process.env.PUBLISH_DELAY_MS || '0', 10);
const pageCheckTimeout = Number.parseInt(process.env.PAGE_CHECK_TIMEOUT || '300', 10);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildPostUrl(post, categoryMapping) {
  const categorySlug = categoryMapping[post.category];
  if (!categorySlug) {
    throw new Error(`Unknown category for ${post.slug}: ${post.category}`);
  }

  return `${SITE_BASE_URL}/${categorySlug}/${post.slug}/`;
}

function createInitialState(posts, categoryMapping) {
  const now = new Date().toISOString();
  const items = {};

  for (const post of posts) {
    items[post.slug] = {
      status: 'baseline',
      title: post.title,
      postUrl: buildPostUrl(post, categoryMapping),
      recordedAt: now,
    };
  }

  return {
    version: 1,
    baselineInitializedAt: now,
    items,
  };
}

function loadState(posts, categoryMapping) {
  if (fs.existsSync(paths.state)) {
    const state = readJson(paths.state);
    if (!state || typeof state !== 'object' || typeof state.items !== 'object') {
      throw new Error('data/facebook-published.json has an invalid shape');
    }
    return { state, isNew: false };
  }

  return {
    state: createInitialState(posts, categoryMapping),
    isNew: true,
  };
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function buildMessage(post) {
  const parts = [post.title];

  if (includeOriginalDate) {
    const dateText = formatDate(post.publishedAt);
    if (dateText) {
      parts.push(`原文發布：${dateText}`);
    }
  }

  if (post.summary) {
    parts.push(post.summary);
  }

  return parts.join('\n\n');
}

async function publishToFacebook({ pageId, pageAccessToken, post, postUrl }) {
  const endpoint = `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}/feed`;
  const body = new URLSearchParams({
    message: buildMessage(post),
    link: postUrl,
    access_token: pageAccessToken,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    body,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const error = payload.error;
    const details = error
      ? `${error.message || 'Unknown Facebook error'} (${error.type || 'unknown type'} ${error.code || 'unknown code'})`
      : `HTTP ${response.status}`;
    throw new Error(`Facebook publish failed for ${post.slug}: ${details}`);
  }

  if (!payload.id) {
    throw new Error(`Facebook publish for ${post.slug} did not return a post id`);
  }

  return payload;
}

async function waitForPageLive(postUrl, slug, timeoutSeconds) {
  const start = Date.now();
  const interval = 5000; // 5 seconds
  
  while (Date.now() - start < timeoutSeconds * 1000) {
    try {
      const response = await fetch(postUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'b-log-fb-publisher' },
      });
      
      if (response.status === 200) {
        console.log(`  ✓ ${slug} 頁面已就緒 (HTTP ${response.status})`);
        return true;
      }
      
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`  ⏳ ${slug} 頁面尚未就緒 (HTTP ${response.status})，已等待 ${elapsed}s，${interval / 1000}s 後重試...`);
    } catch (err) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`  ⏳ ${slug} 頁面連線失敗 (${err.message})，已等待 ${elapsed}s，${interval / 1000}s 後重試...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log(`  ✗ ${slug} 頁面在 ${timeoutSeconds}s 內未就緒，跳過發文`);
  return false;
}

async function main() {
  const posts = readJson(paths.posts);
  const { categoryMapping } = readJson(paths.categories);

  if (!Array.isArray(posts)) {
    throw new Error('data/posts.json must be an array');
  }

  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const { state, isNew } = loadState(posts, categoryMapping);

  if (isNew && !targetSlug) {
    console.log(`Initialized Facebook publish baseline with ${posts.length} existing posts.`);
    if (!dryRun) {
      writeJson(paths.state, state);
    }
    return;
  }

  let candidates = [];
  if (targetSlug) {
    const post = postsBySlug.get(targetSlug);
    if (!post) {
      throw new Error(`POST_SLUG not found in data/posts.json: ${targetSlug}`);
    }
    candidates = [post];
  } else {
    candidates = posts.filter((post) => {
      const status = state.items[post.slug]?.status;
      if (publishBaseline) {
        return status === 'baseline';
      }
      return !status;
    });
  }

  if (!force) {
    candidates = candidates.filter((post) => state.items[post.slug]?.status !== 'published');
  }

  candidates.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  if (Number.isInteger(postLimit) && postLimit > 0) {
    candidates = candidates.slice(0, postLimit);
  }

  if (candidates.length === 0) {
    console.log('No new Facebook posts to publish.');
    return;
  }

  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!dryRun && (!pageId || !pageAccessToken)) {
    throw new Error('FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN secrets are required to publish.');
  }

  for (const post of candidates) {
    const postUrl = buildPostUrl(post, categoryMapping);
    console.log(`${dryRun ? '[dry-run] ' : ''}Publishing ${post.slug}: ${postUrl}`);

    if (dryRun) {
      console.log(buildMessage(post));
      continue;
    }

    // Wait for the page to be live before publishing to Facebook
    const isLive = await waitForPageLive(postUrl, post.slug, pageCheckTimeout);
    if (!isLive) {
      console.log(`Skipping ${post.slug} — page not live`);
      continue;
    }

    const result = await publishToFacebook({
      pageId,
      pageAccessToken,
      post,
      postUrl,
    });

    state.items[post.slug] = {
      status: 'published',
      title: post.title,
      postUrl,
      facebookPostId: result.id,
      publishedAt: new Date().toISOString(),
    };

    writeJson(paths.state, state);

    if (publishDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, publishDelayMs));
    }
  }

  if (!dryRun) {
    writeJson(paths.state, state);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
