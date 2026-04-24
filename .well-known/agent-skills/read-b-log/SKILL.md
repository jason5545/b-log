# Read b-log

Use this skill when an agent needs to discover, search, quote, summarize, or link to public b-log content.

## Resources

- Post catalog: `https://b-log.to/data/posts.json`
- JSON Feed: `https://b-log.to/feed.json`
- Sitemap: `https://b-log.to/sitemap.xml`
- Category mapping: `https://b-log.to/config/categories.json`
- Markdown source for a post: `https://b-log.to/content/posts/{slug}.md`

## Workflow

1. Fetch `data/posts.json` to find posts by title, summary, category, tag, or date.
2. Use `config/categories.json` to convert a post category into its public URL path.
3. Build article URLs as `https://b-log.to/{category-slug}/{post-slug}/`.
4. Fetch `content/posts/{slug}.md` when the raw Markdown body is needed.
5. Prefer the Markdown source for summaries, citations, and extraction because the public HTML pages hydrate article content with JavaScript.

## Notes

- All public content is unauthenticated.
- Do not assume OAuth, MCP, or write APIs exist for this site.
- Respect the site's `robots.txt` Content-Signal preferences.
