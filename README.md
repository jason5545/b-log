# b-log

b-log 是一個雙重用途的內容系統：既是部落格，也是待辦清單。它是一個受 WordPress 啟發的靜態發布系統，專為 GitHub Pages 設計。每篇文章都是 Markdown 檔案，元數據存儲在單一 JSON 檔案中，前端使用輕量級的 HTML、CSS 和原生 JavaScript 渲染。

## Repository layout

- `index.html` - homepage with featured article, stream, and widgets.
- `post.html` - article view that hydrates Markdown content client-side.
- `assets/styles.css` - theme styles (light and dark friendly).
- `assets/main.js` - loader for posts, hero, taxonomy widgets, and article utilities.
- `content/posts/` - Markdown sources (`<slug>.md`).
- `data/posts.json` - catalog consumed by the site and agents.
- `feed.json` - JSON Feed mirror for RSS readers.
- `agent.md` - operating manual for AI collaborators.

## Post metadata schema

Add objects to `data/posts.json` with the following keys:

```json
{
  "slug": "stack-blueprint",
  "title": "Blueprint: Launching b-log on GitHub Pages",
  "summary": "Short teaser for the homepage stream.",
  "category": "Playbook",
  "author": "Jason Chien",
  "publishedAt": "2025-10-16T00:00:00.000Z",
  "updatedAt": "2025-10-16T00:00:00.000Z",
  "readingTime": "3 min",
  "tags": ["guides", "github-pages", "automation"],
  "accentColor": "#1d9bf0",
  "coverImage": "assets/covers/stack-blueprint.jpg"
}
```

Only `slug`, `title`, `summary`, `category`, `author`, `publishedAt`, and `tags` are required. `accentColor` controls the gradient hero if no `coverImage` is supplied.

## Getting started

1. Fork or clone the repository.
2. Enable GitHub Pages (Settings > Pages > Deploy from `main` or `gh-pages`).
3. Update the URLs in `feed.json` to match your Pages domain.
4. Commit and push. Pages serves everything without a build step.

## Create a post

1. Duplicate a metadata object in `data/posts.json` with a new slug.
2. Write `content/posts/<slug>.md` in GitHub-flavoured Markdown.
3. Optional: add `coverImage` or tweak `accentColor` for custom hero styling.
4. Update `feed.json` to keep the feed in sync.
5. Commit the Markdown, JSON, and feed together.

## Customize the theme

- Adjust typography, spacing, or layout in `assets/styles.css`.
- Extend the sidebar by adding new widgets to `index.html` and `post.html`.
- Override hero gradients per post via the `accentColor` field.

## Automate with AI

Share `agent.md` with your co-author bot. It describes:

- Naming conventions and markdown formatting.
- Required metadata fields and ordering.
- How to keep the feed and catalog aligned.

Review diffs before merging to keep the repo clean and auditable.
