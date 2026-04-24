# b-log Agent API

b-log is a static GitHub Pages site. It does not expose protected APIs, OAuth flows, or an MCP server.

Agents can use these public resources:

- `GET /data/posts.json` - post metadata catalog
- `GET /content/posts/{slug}.md` - raw Markdown for a post
- `GET /feed.json` - JSON Feed
- `GET /config/categories.json` - category label to URL slug mapping
- `GET /sitemap.xml` - public URL index
- `GET /.well-known/status.json` - static status document

Article URLs use this shape:

```text
https://b-log.to/{category-slug}/{post-slug}/
```

Use `config/categories.json` to map the `category` value in `posts.json` to the category slug.

For source text, prefer `content/posts/{slug}.md`. The HTML article pages are optimized for browsers and hydrate content with JavaScript.
