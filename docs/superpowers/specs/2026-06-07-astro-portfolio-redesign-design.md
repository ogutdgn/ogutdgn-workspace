# Astro Portfolio Redesign — Design Spec

**Date:** 2026-06-07
**Branch:** `redesign/astro-portfolio`
**Status:** Approved by user (this document records the approved design)

## Goal

Replace the Next.js + Sanity portfolio app (`apps/portfolio`) with a minimal,
text-first Astro site modeled 1:1 on the design of
`../portfolio-example` (the astro-nano theme), while keeping the Turborepo
monorepo and leaving the `tools` app untouched for a later migration.

## Decisions (made with the user)

| Topic | Decision |
|---|---|
| Stack | Astro 5 + TypeScript + Tailwind CSS + MDX (build approach A: port the example's design onto a current Astro 5 scaffold) |
| Repo shape | Keep Turborepo monorepo; replace `apps/portfolio` only |
| Tools app | Untouched for now (stays Next.js + Sanity); migrated in a later phase |
| Sanity | Portfolio drops Sanity entirely; `packages/sanity-shared` stays because tools still uses it |
| Content | Export all existing blogs + projects from Sanity to local `.mdx` files (one-time script) |
| Contact | Contact form removed; email link in footer instead (site becomes fully static) |
| Home page | Simple intro + photo only — no blog/project lists on home |
| Navigation | Name on the left; `blog / projects / tools` links + theme toggle on the top right (tools links to the tools site) |
| Visual design | 1:1 copy of the example's look (Inter, narrow container, lowercase minimal style, prose typography, fade-in animations, light/dark mode, back-to-top) |
| Mascot | Custom pixel-art "mini-Dogan" replacing the example's oneko cat — same engine, full directional animation. Face image to be provided by the user |

## Architecture

### Monorepo layout (after)

```
ogutdgn-workspace/
├── apps/
│   ├── portfolio/        # NEW: Astro 5 site (this project)
│   └── tools/            # unchanged Next.js + Sanity
├── packages/
│   └── sanity-shared/    # unchanged (used by tools only)
└── turbo.json            # unchanged task names (dev/build/lint)
```

The Astro app exposes the same script names (`dev`, `build`, `lint`) so the
existing Turborepo pipeline keeps working without `turbo.json` changes.

### Portfolio app structure

```
apps/portfolio/
├── astro.config.mjs          # mdx, sitemap, rss, tailwind, vercel (static)
├── tailwind.config.mjs
├── src/
│   ├── consts.ts             # SITE name/email, nav, socials (github/linkedin/email)
│   ├── types.ts
│   ├── content.config.ts     # Astro 5 content-layer collections: blog, projects
│   ├── content/
│   │   ├── blog/<slug>/index.mdx        # migrated from Sanity
│   │   └── projects/<slug>/index.mdx    # migrated from Sanity
│   ├── styles/global.css     # ported from example (Inter, prose, animations, dark mode)
│   ├── layouts/PageLayout.astro
│   ├── components/           # Head, Container, Header, Footer, Link,
│   │   ...                   # ArrowCard, FormattedDate, BackToPrev, BackToTop,
│   │   └── MiniDogan.astro   # mascot (oneko-style engine + custom sprite sheet)
│   └── pages/
│       ├── index.astro       # intro + photo only
│       ├── blog/index.astro, blog/[...slug].astro
│       ├── projects/index.astro, projects/[...slug].astro
│       ├── rss.xml.ts, robots.txt.ts
│       └── (sitemap via @astrojs/sitemap)
├── public/                   # photo, resume PDF, favicon, mascot sprite sheet
└── scripts/export-sanity.ts  # one-time Sanity → MDX export (kept for reference)
```

### Content collections

Frontmatter schemas (zod, via Astro content layer):

- **blog**: `title`, `description`, `date`, `draft?`
- **projects**: `title`, `description`, `date`, `draft?`, `demoURL?`, `repoURL?`

### Content migration (Sanity → MDX)

One-time script `scripts/export-sanity.ts`:

1. Fetch all blogs and projects through the existing `@ogutdgn/sanity-shared` queries.
2. Convert Portable Text bodies to markdown/MDX (headings, lists, code blocks,
   links, images).
3. Download referenced Sanity images into the content folders and rewrite
   references to local paths.
4. Write one `index.mdx` per document with frontmatter mapped from Sanity fields
   (slugs preserved).
5. Exported files are reviewed by the user before the Sanity dependency is
   removed from the portfolio app.

### Mascot: pixel mini-Dogan

- Engine: oneko.js chase logic (cursor following, state machine) adapted into a
  self-contained `MiniDogan.astro` component — trivially removable.
- Sprite sheet: custom pixel-art character of the user, drawn using the
  user-provided face photo as reference
  (`docs/superpowers/specs/assets/mascot-face-reference.webp` — curly dark
  hair, round glasses, gray cap, dark blue shirt).
- Frames: 8-direction run cycles, idle, and sleep poses — matching the
  behavioral completeness of the original cat sprite.

### URLs, redirects & SEO

Current → new routes, with permanent redirects (Astro `redirects` config /
`vercel.json`):

| Old | New |
|---|---|
| `/blogs` | `/blog` |
| `/blog/[slug]` | `/blog/[slug]` (unchanged) |
| `/projects` | `/projects` (unchanged) |
| `/project/[slug]` | `/projects/[slug]` |

Canonical domain stays `ogutdgn.com`. Sitemap, robots, and RSS are generated by
the Astro integrations. Vercel Analytics is kept.

### Deployment

- Fully static output (`output: 'static'`) — no server endpoints remain after
  removing the contact form and Sanity ISR revalidation.
- Deployed on Vercel as today; `@astrojs/vercel` adapter only if needed for
  analytics/image service, otherwise plain static.

## Error handling

- Build fails loudly on schema-invalid frontmatter (zod) — bad content cannot
  ship silently.
- Draft posts (`draft: true`) are excluded from lists, RSS, and sitemap.
- The export script logs any Portable Text block type it cannot convert and
  fails with a summary rather than writing lossy output.

## Testing & verification

1. `astro check` and `astro build` pass with zero errors.
2. Every migrated blog post and project renders correctly in the browser
   (spot-check via dev server; compare against current production content).
3. Dark/light toggle persists across navigation.
4. Old-route redirects return 301/308 to the new locations.
5. RSS and sitemap validate and include all published content.
6. Mascot: direction changes, idle, and sleep states verified by hand.

## Out of scope

- Tools app migration (later phase; will reuse this design).
- Removing `packages/sanity-shared` (still needed by tools).
- Contact form in any new form.
