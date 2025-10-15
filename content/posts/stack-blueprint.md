# Blueprint: Launching b-log on GitHub Pages

Running b-log feels like activating a bespoke WordPress theme, except everything is plain text and version controlled. Use this checklist whenever you spin up a fresh instance or help a teammate do the same.

## 1. Fork, clone, and point Pages

1. Fork the repository under your GitHub account.
2. Clone it locally and open the folder in your editor.
3. In GitHub Settings ??Pages, select the branch you plan to publish from (`main` or `gh-pages`) and set the root to `/`.
4. Wait for the first build to finish - Pages will serve `index.html` automatically.

> Tip: keep the repo public if you want the JSON feed to be discoverable by readers and RSS hubs.

## 2. Personalize the metadata

- Edit `feed.json` and replace every occurrence of `https://jason5545.github.io/b-log/` with your Pages domain.
- Update `data/posts.json` entries with your own `author` name and preferred accent colors.
- Tweak `assets/styles.css` if you want to stamp a different typographic voice on the theme.

```bash
# quick search for placeholders
rg "jason5545" -n
```

## 3. Stage your first post

1. Duplicate an object inside `data/posts.json`, adjust the slug, dates, tags, and colors.
2. Create `content/posts/<slug>.md` with a level-one heading and your article body.
3. Commit both changes together so the catalog and Markdown stay in sync.

When you push, GitHub Pages picks up the changes instantly. No build hooks, no Composer scripts, just static assets.

## 4. Invite your AI editor

- Provide `agent.md` to any LLM or automation bot you trust.
- Ask it to draft new Markdown files and update the JSON catalog while respecting the style guide.
- Review diffs locally before committing - pull requests stay tidy because every change is text based.

## Going further

- Add a `coverImage` property to any post to swap the gradient hero for custom artwork.
- Wire Netlify or Cloudflare Pages if you need preview builds or staging domains.
- Drop analytics or comments by embedding scripts inside `index.html` and `post.html` just like a WordPress child theme.

Once you are comfortable with the flow, b-log becomes a fast publishing rail that still feels familiar to anyone coming from WordPress.
