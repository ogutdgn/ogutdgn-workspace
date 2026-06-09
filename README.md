# ogutdgn-workspace

Monorepo for Dogan Ogut's two websites:

| App | URL | What it is |
|---|---|---|
| [`apps/portfolio`](apps/portfolio) | [ogutdgn.com](https://ogutdgn.com) | Personal portfolio — minimal blog + projects, with a cursor-following pixel mascot |
| [`apps/tools`](apps/tools) | [tools.ogutdgn.com](https://tools.ogutdgn.com) | A collection of small tools, some runnable in-browser |

Both are **statically generated Astro sites** with content authored as local **MDX**.
There is no CMS or database — every page is built from files in the repo.

## Tech stack

- **[Astro](https://astro.build)** — static site framework (content collections, MDX, islands)
- **TypeScript** · **[Tailwind CSS](https://tailwindcss.com)** (v3)
- **[React](https://react.dev)** — only on the tools site, as hydrated **islands** for the interactive pieces
- **[Turborepo](https://turborepo.com)** + **pnpm workspaces** — monorepo build/orchestration
- **Vercel** — hosting (one project per app, static output)

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full picture.

## Repository layout

```
.
├── apps/
│   ├── portfolio/      # Astro site → ogutdgn.com
│   └── tools/          # Astro + React islands → tools.ogutdgn.com
├── packages/
│   └── sanity-shared/  # archived Sanity schemas/queries (no longer used by the apps)
├── scripts/            # one-time content-migration scripts (Sanity → MDX) + tests
├── turbo.json          # Turborepo task pipeline
└── pnpm-workspace.yaml
```

## Getting started

Requires **Node ≥ 22.12** and **pnpm**.

```bash
pnpm install

# develop one app (http://localhost:4321 by default)
pnpm dev:portfolio
pnpm dev:tools

# build
pnpm build            # both apps via Turborepo
pnpm build:portfolio
pnpm build:tools
```

Each app also supports `pnpm --filter @ogutdgn/<app> preview` to serve its built output.

## Authoring content

Content lives as MDX with frontmatter — no CMS:

- **Blog / projects:** `apps/portfolio/src/content/{blog,projects}/<slug>/index.mdx`
- **Tools:** `apps/tools/src/content/tools/<slug>/index.mdx`

Add a folder, write the frontmatter + body, drop any images next to it (portfolio)
or under `apps/tools/public/tools/<slug>/` (tools), and rebuild. Frontmatter is
validated by a Zod schema at build time, so malformed metadata fails the build
instead of shipping.

## Deployment

Two Vercel projects watch this repo, each with its **Root Directory** set to the
app folder (`apps/portfolio` / `apps/tools`), **Framework Preset: Astro**, static
output. No runtime environment variables are required. URLs are stable, so no
redirects are needed beyond the portfolio's legacy ones in
`apps/portfolio/vercel.json`.

## Conventions

Commit messages follow `type(scope): subject` with a `What changed:` / `Why:`
body. See [`ARCHITECTURE.md`](ARCHITECTURE.md#conventions) for details.
