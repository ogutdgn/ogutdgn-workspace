# Tools Site → Astro + MDX Migration — Design Spec

**Date:** 2026-06-08
**Branch:** `redesign/astro-portfolio` (continues the monorepo migration work)
**Status:** Approved by user

## Goal

Migrate `apps/tools` from Next.js + Sanity to the same stack as the just-migrated
portfolio — **Astro 6 + TypeScript + Tailwind 3 + MDX** — while keeping its
existing dark/neon design 1:1, dropping Sanity in favour of local MDX content,
and staying in the same Turborepo monorepo.

## Decisions (made with the user)

| Topic | Decision |
|---|---|
| Stack | Astro 6 + TS + Tailwind 3 + MDX + `@astrojs/react` (React islands) |
| Design | Preserved 1:1 (port existing theme + components; no redesign) |
| Interactivity | Interactive parts stay React, hydrated as Astro islands |
| Content | Export all current Sanity tools → local MDX (one-time script) |
| Sanity package | `packages/sanity-shared` kept as an archive; no longer imported by any app |
| Repo | Same monorepo; only `apps/tools` changes |
| URLs | Unchanged (`/`, `/<slug>`) → no redirects needed |

## Architecture

### Stack & shared look

- `apps/tools` rebuilt as Astro, exposing the same `dev`/`build`/`lint`/`start`
  script names so the Turborepo pipeline is unchanged.
- Port verbatim (adapting only framework specifics):
  - `app/globals.css` → `src/styles/global.css` (void/neon theme, `grid-bg`,
    `noise`, `text-glow`, `card-glow`, scrollbar/selection styling).
  - `tailwind.config.ts` tokens → `tailwind.config.mjs`: the neon colour palette
    (`void, surface, surface-2, border, border-bright, text, muted, dim, neon,
    neon-cyan, neon-green, neon-pink, neon-orange, neon-yellow, neon-red`),
    keyframes and animations (`pulse_dot, flicker, scan, glow-pulse, float,
    slide-up`), and the Geist sans/mono font families.
  - Fonts: `@fontsource-variable/geist` + `@fontsource-variable/geist-mono`,
    wired to the existing `--font-geist-sans` / `--font-geist-mono` CSS vars the
    theme already references.
- `lib/utils.ts` ported as-is (`TOOL_TYPE_META`, `STATUS_META`,
  `getToolTypeMeta`, `getLiveLinkLabel`, `formatStat`), shared by Astro pages and
  React islands.

### Interactivity (islands)

| Piece | Becomes |
|---|---|
| `Navbar` | static Astro component (links only) |
| `FilterBar` (+ `ToolCard`, `ToolDrawer`) | one React island (`client:load`) on the home page |
| Embedded tools (`inter-arrival-sampler`, …) | React, rendered as islands on internal tool detail pages |

- The `TOOL_COMPONENTS` registry (`src/tools/index.ts`) is kept: slug → imported
  React component. The detail page resolves `const Tool = TOOL_COMPONENTS[slug]`
  and renders `{Tool && <Tool client:load />}`.
- **Data contract:** islands receive only serializable tool metadata (strings,
  arrays, image URL paths) — never Portable Text or non-serializable values. The
  full MDX body renders on the Astro detail page only.

### Content model (MDX)

Each tool → `src/content/tools/<slug>/index.mdx`. Zod-validated frontmatter
mirrors the current Sanity schema:

- **Core:** `title`, `tagline?`, `overview?`
- **Classification:** `category` (string), `hostType` ("internal" | "external"),
  `toolType` ("web-app" | "chrome-extension" | "vscode-extension" |
  "os-extension" | "cli-npm" | "other"), `status` ("active" | "beta" |
  "coming-soon" | "archived"), `featured` (boolean, default false)
- **Links:** `liveLink?`, `githubLink?`
- **Technical:** `technologies?` (string[]), `tags?` (string[])
- **Meta:** `publishedAt?` (date)
- **Visuals:** `icon?`, `coverImage?` (URL path strings), `screenshots?`
  (array of `{ src, caption? }`), `demoVideoUrl?`
- **Body:** the converted Portable Text `content`.

`slug` is the content-collection entry `id` (folder name), preserving existing
slugs.

**Categories:** stored as a plain string per tool. The FilterBar's category list
+ per-category counts are derived from the distinct categories present across
tools, plus an "All" entry. (The old `toolCategory` reference documents collapse
into that string — their title is what gets stored.)

**Images:** icons, covers and screenshots are downloaded to
`public/tools/<slug>/…` and referenced by absolute URL path in frontmatter, so
both Astro pages and the React islands (`<img src>`) can consume them without
Astro's asset-import pipeline. Trade-off: tool images skip Astro image
optimization — acceptable since they are small. The existing home photo
`public/dog1to.webp` stays.

### Content migration (Sanity → MDX)

One-time `scripts/export-tools.mjs`, reusing the portfolio's
`scripts/portable-text-to-markdown.mjs` converter:

1. Fetch all tools (and resolve each `category` reference to its title).
2. Convert the `content` Portable Text body to MDX.
3. Download `icon`, `coverImage`, and `screenshots` into
   `apps/tools/public/tools/<slug>/`.
4. Write `src/content/tools/<slug>/index.mdx` with the frontmatter above.
5. Fail loudly on any unconvertible block type; output is reviewed before the
   Sanity dependency is removed.

Requires `@sanity/client` re-added to the root as a dev dependency for the export
run, removed again at cleanup.

### Pages

- `src/pages/index.astro` — the bespoke home: intro copy, the photo with the
  hand-drawn "That's me!" and annotation SVGs, and the three stats (computed from
  the collection: total / active / open-source). The right column hosts the
  `FilterBar` island. The mobile stacked layout is preserved.
- `src/pages/[...slug].astro` — tool detail: `getStaticPaths` over all tools;
  static header (icon or type-coloured fallback, type/status pills, title,
  tagline), overview, optional cover image, the **MDX body**, screenshots, demo
  video iframe, and — for `hostType === "internal"` — the embedded tool island.
  Sidebar: open/github links, technologies, tags, published date.
- `src/pages/robots.txt.ts` and a sitemap via `@astrojs/sitemap`.
- No RSS feed (the tools site never had one).
- The Sanity `revalidate` API route is dropped (the site is static).

## Error handling

- Zod rejects schema-invalid frontmatter at build time — bad tool metadata can't
  ship silently.
- The export script logs and fails on any Portable Text block type it cannot
  convert rather than writing lossy output.
- Internal tools whose slug is missing from `TOOL_COMPONENTS` simply render no
  embedded island (the rest of the detail page still renders).

## Testing & verification

1. `astro check` and `astro build` pass with zero errors for `apps/tools`.
2. Browser checks on the built/preview site:
   - Home: category filter switches the grid; clicking a card opens the drawer.
   - An **internal** tool detail page actually hydrates and runs the embedded
     `inter-arrival-sampler` island.
   - An **external** tool detail page links out correctly.
   - Mobile stacked layout renders.
3. Every migrated tool renders (spot-check each), images load, no broken links.
4. `pnpm build` builds all three: `apps/tools`, `apps/portfolio`, and (unchanged)
   nothing depends on `sanity-shared` anymore.

## Deployment

- Static output on Vercel for `tools.ogutdgn.com`: project root directory
  `apps/tools`, framework preset Astro.
- The tools app drops its `@ogutdgn/sanity-shared` dependency.
- Old Sanity env vars (`SANITY_*`) can be removed from the tools Vercel project
  after cutover.

## Out of scope

- Any redesign of the tools site (design is preserved as-is).
- Deleting `packages/sanity-shared` (kept as an archive per user choice).
- Changes to `apps/portfolio`.
