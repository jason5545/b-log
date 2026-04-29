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

function buildMessage(post) {
  const parts = [post.title];

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
    candidates = posts.filter((post) => !state.items[post.slug]);
  }

  if (!force) {
    candidates = candidates.filter((post) => state.items[post.slug]?.status !== 'published');
  }

  candidates.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

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
  }

  if (!dryRun) {
    writeJson(paths.state, state);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
