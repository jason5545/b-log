# Hello, world

Welcome to **b-log**, a lightweight publishing stack that behaves like a handcrafted WordPress theme but deploys as static files.

## What lives in the repo

- `index.html` renders the feed using `data/posts.json`.
- `post.html` fetches Markdown from `content/posts/<slug>.md`.
- `assets/` contains a single CSS file and a modular JavaScript loader.

Everything ships via GitHub Pages - no build scripts, no plugins, no PHP to maintain.

## How to publish

1. Add a new object to `data/posts.json` with your slug, title, category, and accent color.
2. Create `content/posts/<slug>.md` with a level-one heading that matches the title.
3. Commit both files together so the feed and Markdown stay in sync.

### Suggested cadence

- Capture a rough draft.
- Ask your AI editor to tighten the copy.
- Review, commit, and push.

## Theme tweaks

Want to change the aesthetic?

- Adjust the accent gradients through the `accentColor` field per post.
- Override typography or layout in `assets/styles.css`.
- Drop additional widgets into the sidebar just like a WordPress child theme.

> Keep paragraphs short so the cards breathe on the homepage and post page alike.

Happy publishing!
