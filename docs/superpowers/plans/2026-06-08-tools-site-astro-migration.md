# Tools Site Astro Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/tools` from Next.js + Sanity to Astro 6 + TS + Tailwind 3 + MDX with React islands, preserving the existing dark/neon design and the interactive filter grid + embedded tools, in the same monorepo.

**Architecture:** Static shell in Astro; interactive pieces (filter grid, drawer, embedded tools) as React islands via `@astrojs/react`. Tool content + metadata move from Sanity to local MDX with rich frontmatter; tool images live under `public/tools/<slug>/` and are referenced by URL path so islands can consume them. The home page passes a serializable `ToolMeta[]` to the `FilterBar` island; external-tool drawer bodies are pre-rendered to HTML with `marked` server-side.

**Tech Stack:** Astro 6, @astrojs/{react,mdx,sitemap,tailwind}, React 19, Tailwind 3 + custom tokens, MDX, marked, lucide-react, @fontsource-variable/geist(+geist-mono), zod.

**Spec:** `docs/superpowers/specs/2026-06-08-tools-site-astro-migration-design.md`
**Branch:** `redesign/astro-portfolio` (current).

**Reference paths:**
- Tools app (current Next.js): `apps/tools` — call its files `$TOOLS/...`
- Workspace root: `/Users/cetinogut/Desktop/CODING/new_coding/ogutdgn-workspace` (`$ROOT`)
- Reused converter: `scripts/portable-text-to-markdown.mjs` (already in repo)

**Commit style (user's convention — follow for every commit):**
- Subject `<type>(<scope>): <imperative>`, ≤72 chars. Scopes for this work:
  `export, scaffold, design, content, ui, pages, repo`.
- Body required: a `What changed:` bullet list and a `Why:` line; add
  `Tests:`/`Build:` impact notes when you ran them.
- **No `Co-Authored-By` / AI-authorship trailer. Ever.**
- Stage explicit paths (never `git add -A`/`git add .`); run
  `git diff --cached --stat` before committing. Never commit `node_modules/`,
  `dist/`, build output, or `*.log`.

**Key facts (verified against the current codebase):**
- Sanity: projectId `ru03qs5h`, dataset `portfolio` (shared client in
  `packages/sanity-shared/src/client.ts`).
- Tool fields (Sanity): title, slug, tagline, overview, icon, coverImage,
  screenshots[{asset,caption}], demoVideoUrl, category→{title,slug}, hostType
  (internal|external), toolType (web-app|chrome-extension|vscode-extension|
  os-extension|cli-npm|other), status (active|beta|coming-soon|archived),
  featured, liveLink, githubLink, technologies[], tags[], content (Portable
  Text), publishedAt, _createdAt.
- Only **internal** tools get a detail page (the old `generateStaticParams`
  filtered `hostType === "internal"`). External tools live as cards + drawer.
- The drawer shows the full description for **external** tools that have body
  content; the card's "Details" button appears for `external && hasContent`.
- Theme tokens live in `$TOOLS/tailwind.config.ts`; theme CSS in
  `$TOOLS/app/globals.css`; helpers in `$TOOLS/lib/utils.ts`.
- Tools nav links out to `https://ogutdgn.com`; site canonical
  `https://tools.ogutdgn.com`.

> **Version note:** Do NOT trust memorized versions. Before Task 2 run
> `npm view astro version`, `npm view @astrojs/react version`,
> `npm view @astrojs/mdx version`, `npm view @astrojs/sitemap version`,
> `npm view @astrojs/tailwind version`, `npm view tailwindcss@3 version`,
> `npm view marked version`, `npm view lucide-react version`,
> `npm view @fontsource-variable/geist version`,
> `npm view @fontsource-variable/geist-mono version`, `npm view zod version`,
> and use the current majors. Match `apps/portfolio` where they overlap
> (Astro 6, React 19, Tailwind 3, zod 4 imported from `zod/v4`).

---

### Task 1: Export Sanity tools → MDX (run & review)

**Files:**
- Create: `scripts/export-tools.mjs`
- Modify: root `package.json` (add `@sanity/client` devDependency for the run)
- Output: `content-export-tools/<slug>/index.mdx` + image files (committed for review)

- [ ] **Step 1: Re-add @sanity/client at the root (export-only)**

Run: `cd $ROOT && pnpm add -D -w @sanity/client`
Expected: installs cleanly.

- [ ] **Step 2: Write the export script**

```js
// scripts/export-tools.mjs
// One-time export of Sanity "tool" documents to MDX with local images.
// Usage: node scripts/export-tools.mjs
import { createClient } from "@sanity/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { portableTextToMarkdown } from "./portable-text-to-markdown.mjs";

const PROJECT_ID = "ru03qs5h";
const DATASET = "portfolio";
const OUT = path.resolve("content-export-tools");

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2024-01-01",
  useCdn: false,
});

function imageRefToUrl(ref) {
  const m = /^image-([a-zA-Z0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
  if (!m) throw new Error(`Unparseable image ref: ${ref}`);
  return { url: `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${m[1]}-${m[2]}.${m[3]}`, ext: m[3] };
}

async function downloadImage(ref, dir, basename) {
  const { url, ext } = imageRefToUrl(ref);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const file = `${basename}.${ext}`;
  await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  return file; // bare filename; frontmatter path is built by the caller
}

function yamlStr(s) {
  return `"${String(s).replace(/\r?\n/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim()}"`;
}

function frontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // array of scalars or of objects
      if (typeof v[0] === "object") {
        lines.push(`${k}:`);
        for (const item of v) {
          const inner = Object.entries(item)
            .filter(([, iv]) => iv !== undefined && iv !== null && iv !== "")
            .map(([ik, iv]) => `${ik}: ${yamlStr(iv)}`)
            .join(", ");
          lines.push(`  - { ${inner} }`);
        }
      } else {
        lines.push(`${k}: [${v.map((x) => yamlStr(x)).join(", ")}]`);
      }
    } else if (typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else if (v instanceof Date) {
      lines.push(`${k}: ${v.toISOString().slice(0, 10)}`);
    } else {
      lines.push(`${k}: ${yamlStr(v)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

const tools = await client.fetch(
  `*[_type == "tool" && !(_id in path("drafts.**"))]{
    _id, title, "slug": slug.current, tagline, overview,
    icon, coverImage, screenshots, demoVideoUrl,
    "category": category->title,
    hostType, toolType, status, featured,
    liveLink, githubLink, technologies, tags,
    content, publishedAt, _createdAt
  } | order(featured desc, publishedAt desc)`
);

const problems = [];
for (const t of tools) {
  if (!t.slug) throw new Error(`tool ${t._id} has no slug`);
  const dir = path.join(OUT, t.slug);
  await mkdir(dir, { recursive: true });
  const urlBase = `/tools/${t.slug}`;

  // images: icon, cover, screenshots, plus inline body images
  let icon, coverImage;
  if (t.icon?.asset?._ref) icon = `${urlBase}/${await downloadImage(t.icon.asset._ref, dir, "icon")}`;
  if (t.coverImage?.asset?._ref) coverImage = `${urlBase}/${await downloadImage(t.coverImage.asset._ref, dir, "cover")}`;
  const screenshots = [];
  if (Array.isArray(t.screenshots)) {
    let i = 0;
    for (const s of t.screenshots) {
      if (!s?.asset?._ref) continue;
      i += 1;
      const f = await downloadImage(s.asset._ref, dir, `shot-${i}`);
      screenshots.push({ src: `${urlBase}/${f}`, caption: s.caption });
    }
  }

  // body
  const unknown = [];
  let bi = 0;
  const jobs = [];
  const md = portableTextToMarkdown(t.content, {
    resolveImage: (node) => {
      if (!node.asset?._ref) return null;
      bi += 1;
      const ref = `__img${bi}__`;
      jobs.push({ ref: node.asset._ref, basename: `body-${bi}`, token: ref });
      return ref;
    },
    onUnknown: (node) => unknown.push(node._type),
  });
  let body = md;
  for (const j of jobs) {
    const f = await downloadImage(j.ref, dir, j.basename);
    body = body.replaceAll(`(${j.token})`, `(${urlBase}/${f})`);
  }

  const fm = frontmatter({
    title: t.title,
    tagline: t.tagline,
    overview: t.overview,
    category: t.category || "Other",
    hostType: t.hostType,
    toolType: t.toolType,
    status: t.status || "active",
    featured: !!t.featured,
    liveLink: t.liveLink,
    githubLink: t.githubLink,
    technologies: t.technologies,
    tags: t.tags,
    icon,
    coverImage,
    screenshots,
    demoVideoUrl: t.demoVideoUrl,
    publishedAt: new Date(t.publishedAt || t._createdAt),
  });
  await writeFile(path.join(dir, "index.mdx"), `${fm}\n\n${body}\n`);
  console.log(`tools/${t.slug}`);
  if (unknown.length) problems.push(`${t.slug}: unconverted blocks: ${unknown.join(", ")}`);
}

console.log(`\nExported ${tools.length} tools.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
```

- [ ] **Step 3: Run the export**

Run: `cd $ROOT && node scripts/export-tools.mjs`
Expected: one line per tool, summary, exit 0. If it exits 1 with "unconverted
blocks", inspect that document's content (log the node JSON), extend
`scripts/portable-text-to-markdown.mjs` (add a test first, run with
`node --test "scripts/*.test.mjs"`), and re-run. If the fetch returns 0 tools,
report BLOCKED (do not fabricate).

- [ ] **Step 4: Spot-check output**

Run: `find content-export-tools -name index.mdx | head; cat "$(find content-export-tools -name index.mdx | head -1)"`
Expected: valid frontmatter (title, category, hostType, toolType, status, links,
technologies, tags, icon/cover/screenshots paths as `/tools/<slug>/...`), readable
body, image files present beside each index.mdx.

- [ ] **Step 5: Commit and ask the user to review**

```bash
git add content-export-tools scripts/export-tools.mjs package.json pnpm-lock.yaml
git diff --cached --stat
git commit -F - <<'MSG'
feat(export): export Sanity tools to MDX

What changed:
- Add scripts/export-tools.mjs: fetch all tool documents, resolve the category
  reference to its title, convert the Portable Text body via the shared
  converter, download icon/cover/screenshots and inline images, and write
  content-export-tools/<slug>/index.mdx with full frontmatter.
- Re-add @sanity/client at the root for the export run.

Why:
Move the tools site's content out of Sanity into local MDX ahead of the Astro
rebuild.
MSG
```

**STOP — user checkpoint:** ask the user to skim `content-export-tools/` before continuing.

---

### Task 2: Scaffold the Astro tools app

**Files:**
- Delete: the Next.js `apps/tools` app, EXCEPT `apps/tools/public/**` (keeps
  `dog1to.webp`, `dog1to.jpeg`, and the exported tool images once moved there).
- Create: `apps/tools/package.json`, `astro.config.mjs`, `tailwind.config.mjs`,
  `tsconfig.json`, `src/env.d.ts`, `src/pages/index.astro` (temp stub),
  `apps/tools/.gitignore`.

- [ ] **Step 1: Check current versions** (see Version note). Record the exact
versions to use below.

- [ ] **Step 2: Remove the Next.js app, preserving public/**

```bash
cd $ROOT/apps/tools
git rm -r --quiet app components lib next.config.mjs postcss.config.mjs tailwind.config.ts tsconfig.json package.json next-env.d.ts 2>/dev/null || true
# keep public/ as-is
mkdir -p src/pages
```
(If any listed path doesn't exist, ignore — the goal is: no Next.js files remain,
`apps/tools/public/` stays.)

- [ ] **Step 3: Write apps/tools/package.json** (fill `<current>` from Step 1)

```json
{
  "name": "@ogutdgn/tools",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "lint": "astro check",
    "start": "astro preview"
  },
  "dependencies": {
    "@astrojs/check": "<current>",
    "@astrojs/mdx": "<current>",
    "@astrojs/react": "<current>",
    "@astrojs/sitemap": "<current>",
    "@astrojs/tailwind": "<current>",
    "@fontsource-variable/geist": "<current>",
    "@fontsource-variable/geist-mono": "<current>",
    "astro": "<current>",
    "lucide-react": "<current>",
    "marked": "<current>",
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "<current ^3.x>",
    "typescript": "<current>",
    "zod": "<current ^4.x>"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

- [ ] **Step 4: Write config files**

```js
// apps/tools/astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://tools.ogutdgn.com",
  integrations: [react(), mdx(), sitemap(), tailwind()],
});
```

```js
// apps/tools/tailwind.config.mjs  (port tokens from $TOOLS/tailwind.config.ts)
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        void: "#07070e",
        surface: "#0f0f1c",
        "surface-2": "#161628",
        border: "#1e1e3a",
        "border-bright": "#2e2e5a",
        text: "#e8e8ff",
        muted: "#6666aa",
        dim: "#3a3a60",
        neon: "#7c6af7",
        "neon-cyan": "#22d3ee",
        "neon-green": "#4ade80",
        "neon-pink": "#f472b6",
        "neon-orange": "#fb923c",
        "neon-yellow": "#facc15",
        "neon-red": "#f87171",
      },
      keyframes: {
        pulse_dot: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.3" } },
        flicker: { "0%, 100%": { opacity: "1" }, "92%": { opacity: "1" }, "93%": { opacity: "0.8" }, "94%": { opacity: "1" }, "96%": { opacity: "0.9" }, "97%": { opacity: "1" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100vh)" } },
        "glow-pulse": { "0%, 100%": { boxShadow: "0 0 8px 2px rgba(124,106,247,0.3)" }, "50%": { boxShadow: "0 0 20px 4px rgba(124,106,247,0.6)" } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        pulse_dot: "pulse_dot 2s ease-in-out infinite",
        flicker: "flicker 8s linear infinite",
        scan: "scan 6s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};
```

```json
// apps/tools/tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@tools/*": ["src/tools/*"]
    }
  }
}
```

```ts
// apps/tools/src/env.d.ts
/// <reference types="astro/client" />
```

```
# apps/tools/.gitignore
dist/
.astro/
node_modules/
.env
.env.production
.vercel
```

- [ ] **Step 5: Temp stub page**

```astro
---
// apps/tools/src/pages/index.astro (temporary — replaced in Task 6)
---
<html lang="en"><head><title>tools.ogutdgn</title></head><body><h1>scaffold ok</h1></body></html>
```

- [ ] **Step 6: Install and build**

Run: `cd $ROOT && pnpm install && pnpm --filter @ogutdgn/tools build`
Expected: astro check 0 errors, `apps/tools/dist/index.html` exists. Then
`pnpm --filter @ogutdgn/portfolio build` still green.
(If install hits the esbuild conflict, the root already pins
`pnpm.overrides.esbuild`; re-run `pnpm install`.)

- [ ] **Step 7: Commit**

```bash
git add apps/tools/package.json apps/tools/astro.config.mjs apps/tools/tailwind.config.mjs apps/tools/tsconfig.json apps/tools/src apps/tools/.gitignore pnpm-lock.yaml
git rm -r --cached --quiet apps/tools/app apps/tools/components apps/tools/lib 2>/dev/null || true
git diff --cached --stat
git commit -F - <<'MSG'
scaffold(tools): replace Next.js tools app with an Astro scaffold

What changed:
- Remove the Next.js tools app (app/, components/, lib/, configs), preserving
  apps/tools/public/.
- Add an Astro + React + Tailwind + MDX scaffold with the ported neon theme
  tokens and animations, path aliases, and a stub page; keep the
  @ogutdgn/tools name and dev/build/lint scripts.

Why:
Stand up the Astro foundation for the tools site before porting design and
content.

Build: tools scaffold builds; portfolio unaffected.
MSG
```

---

### Task 3: Theme CSS, fonts, utils, types, and the tools collection

**Files:**
- Create: `apps/tools/src/styles/global.css` (port from `$TOOLS/app/globals.css` + font vars)
- Create: `apps/tools/src/lib/utils.ts` (port from `$TOOLS/lib/utils.ts`)
- Create: `apps/tools/src/lib/tool.ts` (serializable `ToolMeta` type + loaders)
- Create: `apps/tools/src/content.config.ts`

- [ ] **Step 1: Port global.css with font vars**

Copy `$TOOLS/app/globals.css` to `apps/tools/src/styles/global.css` verbatim,
then add these imports + `:root` vars at the very top (before `@tailwind`):

```css
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

:root {
  --font-geist-sans: "Geist Variable", system-ui, sans-serif;
  --font-geist-mono: "Geist Mono Variable", monospace;
}
```

(If `astro check`/build later reports the font family name differs, correct the
var to the family the installed package actually registers — verify by checking
`node_modules/@fontsource-variable/geist/index.css`.)

- [ ] **Step 2: Port lib/utils.ts**

Copy `$TOOLS/lib/utils.ts` to `apps/tools/src/lib/utils.ts` **verbatim** (no
changes — it has no Sanity imports).

- [ ] **Step 3: Write src/lib/tool.ts (ToolMeta + loaders)**

```ts
// apps/tools/src/lib/tool.ts
import { getCollection, type CollectionEntry } from "astro:content";
import { marked } from "marked";

export type ToolMeta = {
  slug: string;
  title: string;
  tagline?: string;
  overview?: string;
  category: string;
  hostType: "internal" | "external";
  toolType: string;
  status: string;
  featured: boolean;
  liveLink?: string;
  githubLink?: string;
  technologies: string[];
  tags: string[];
  icon?: string;
  demoVideoUrl?: string;
  hasContent: boolean;
  /** Pre-rendered HTML of the body, only for external tools (for the drawer). */
  bodyHtml: string;
};

function toMeta(entry: CollectionEntry<"tools">): ToolMeta {
  const d = entry.data;
  const hasContent = entry.body.trim().length > 0;
  return {
    slug: entry.id,
    title: d.title,
    tagline: d.tagline,
    overview: d.overview,
    category: d.category,
    hostType: d.hostType,
    toolType: d.toolType,
    status: d.status,
    featured: d.featured ?? false,
    liveLink: d.liveLink,
    githubLink: d.githubLink,
    technologies: d.technologies ?? [],
    tags: d.tags ?? [],
    icon: d.icon,
    demoVideoUrl: d.demoVideoUrl,
    hasContent,
    bodyHtml: d.hostType === "external" && hasContent
      ? marked.parse(entry.body, { async: false })
      : "",
  };
}

/** All tools as serializable metadata, featured first then alphabetical. */
export async function getToolMetas(): Promise<ToolMeta[]> {
  const entries = await getCollection("tools");
  return entries
    .map(toMeta)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
}

/** Distinct category names in first-appearance order (for the filter bar). */
export function deriveCategories(tools: ToolMeta[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tools) {
    if (!seen.has(t.category)) { seen.add(t.category); out.push(t.category); }
  }
  return out;
}
```

(Note: `marked.parse(..., { async: false })` returns a string. If the installed
`marked` types complain, call `marked.parse(entry.body) as string`.)

- [ ] **Step 4: Write content.config.ts**

```ts
// apps/tools/src/content.config.ts
import { defineCollection } from "astro:content";
import { z } from "zod/v4";
import { glob } from "astro/loaders";

const tools = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tools" }),
  schema: z.object({
    title: z.string(),
    tagline: z.string().optional(),
    overview: z.string().optional(),
    category: z.string(),
    hostType: z.enum(["internal", "external"]),
    toolType: z.enum(["web-app", "chrome-extension", "vscode-extension", "os-extension", "cli-npm", "other"]),
    status: z.enum(["active", "beta", "coming-soon", "archived"]),
    featured: z.boolean().default(false),
    liveLink: z.string().optional(),
    githubLink: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    icon: z.string().optional(),
    coverImage: z.string().optional(),
    screenshots: z.array(z.object({ src: z.string(), caption: z.string().optional() })).optional(),
    demoVideoUrl: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
  }),
});

export const collections = { tools };
```

- [ ] **Step 5: Verify check passes (no content yet → empty collection is OK)**

Run: `cd $ROOT && pnpm --filter @ogutdgn/tools lint`
Expected: 0 errors (the collection is empty until Task 4; the config + types must
still type-check). If `zod/v4` import errors, confirm zod 4.x is installed and
match the portfolio's working import.

- [ ] **Step 6: Commit**

```bash
git add apps/tools/src/styles/global.css apps/tools/src/lib/utils.ts apps/tools/src/lib/tool.ts apps/tools/src/content.config.ts
git diff --cached --stat
git commit -F - <<'MSG'
design(tools): port theme, fonts, helpers and the tools collection

What changed:
- Port globals.css (neon theme, grid-bg, noise, scan-line) and wire Geist
  variable fonts to the --font-geist-* CSS vars.
- Port lib/utils.ts (tool type/status metadata helpers) unchanged.
- Add lib/tool.ts: a serializable ToolMeta type, getToolMetas() and
  deriveCategories() for the islands, with external bodies pre-rendered to HTML.
- Add content.config.ts defining the tools collection schema.

Why:
Recreate the tools design system and data layer on Astro without Sanity.
MSG
```

---

### Task 4: Move exported content into the app

**Files:**
- Move: `content-export-tools/<slug>/index.mdx` → `apps/tools/src/content/tools/<slug>/index.mdx`
- Move: `content-export-tools/<slug>/<image files>` → `apps/tools/public/tools/<slug>/`

- [ ] **Step 1: Move MDX and images into place**

```bash
cd $ROOT
mkdir -p apps/tools/src/content/tools apps/tools/public/tools
for d in content-export-tools/*/; do
  slug=$(basename "$d")
  mkdir -p "apps/tools/src/content/tools/$slug" "apps/tools/public/tools/$slug"
  git mv "$d/index.mdx" "apps/tools/src/content/tools/$slug/index.mdx"
  # move every non-mdx asset to public
  for f in "$d"*; do
    [ -f "$f" ] && git mv "$f" "apps/tools/public/tools/$slug/$(basename "$f")"
  done
done
rmdir content-export-tools/* content-export-tools 2>/dev/null || true
```

- [ ] **Step 2: Verify counts and that the collection loads**

Run: `find apps/tools/src/content/tools -name index.mdx | wc -l` (matches the
exported tool count) and `cd $ROOT && pnpm --filter @ogutdgn/tools build`.
Expected: 0 errors; any zod failure points at a bad frontmatter file — fix the
file (or the exporter if systematic) and rebuild.

- [ ] **Step 3: Commit**

```bash
git add apps/tools/src/content/tools apps/tools/public/tools
git diff --cached --stat
git commit -F - <<'MSG'
content(tools): add migrated tool MDX and images

What changed:
- Move the exported tool MDX into src/content/tools/<slug>/index.mdx and their
  images into public/tools/<slug>/, referenced by URL path in frontmatter.

Why:
Wire the migrated tools into Astro's content layer.

Build: tools builds with the populated collection.
MSG
```

---

### Task 5: Port the React islands and the embedded-tool registry

**Files:**
- Create: `apps/tools/src/components/Navbar.astro` (static)
- Create: `apps/tools/src/components/ToolCard.tsx` (port + retype)
- Create: `apps/tools/src/components/ToolDrawer.tsx` (port + retype, bodyHtml)
- Create: `apps/tools/src/components/FilterBar.tsx` (port + retype)
- Create: `apps/tools/src/components/EmbeddedTool.tsx` (registry wrapper island)
- Create: `apps/tools/src/tools/index.ts` (registry)
- Create: `apps/tools/src/tools/inter-arrival-sampler.tsx` (move from Next app)
- Create: `apps/tools/src/layouts/BaseLayout.astro`

- [ ] **Step 1: Navbar.astro (static port)**

```astro
---
// apps/tools/src/components/Navbar.astro
import { Terminal } from "lucide-react";
---
<header class="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-void/80">
  <div class="w-full px-8 h-14 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 group">
      <div class="w-7 h-7 rounded border border-neon/40 bg-neon/10 flex items-center justify-center group-hover:border-neon/80 group-hover:bg-neon/20 transition-all">
        <Terminal className="w-3.5 h-3.5 text-neon" />
      </div>
      <span class="font-mono text-sm font-medium text-text">tools<span class="text-neon">.</span>ogutdgn</span>
    </a>
    <nav class="flex items-center gap-6">
      <a href="https://ogutdgn.com" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-muted hover:text-text transition-colors">← portfolio</a>
    </nav>
  </div>
</header>
```

(If rendering the `lucide-react` `Terminal` icon inside `.astro` is awkward,
inline its SVG instead — a `>_` terminal glyph — to avoid a needless React import
in static markup.)

- [ ] **Step 2: BaseLayout.astro**

```astro
---
// apps/tools/src/layouts/BaseLayout.astro
import "../styles/global.css";
import Navbar from "@components/Navbar.astro";

interface Props { title: string; description?: string; canonical?: string; }
const { title, description = "A collection of tools built by Dogan Ogut", canonical } = Astro.props;
const canonicalURL = canonical ?? new URL(Astro.url.pathname, Astro.site).href;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="canonical" href={canonicalURL} />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
  </head>
  <body class="min-h-screen bg-void grid-bg noise antialiased">
    <Navbar />
    <main><slot /></main>
  </body>
</html>
```

(Also add a favicon: create `apps/tools/public/favicon.svg` — a neon terminal
glyph matching the old `icon.tsx`: a `>_` in a rounded neon-bordered box on
`#07070e`.)

- [ ] **Step 3: Move the embedded tool + registry**

```bash
git mv "apps/tools/.git-removed?" 2>/dev/null || true
```
Copy `$TOOLS/app/[slug]/tools/inter-arrival-sampler.tsx` to
`apps/tools/src/tools/inter-arrival-sampler.tsx` **verbatim** (it's a
self-contained React component — keep `'use client'` at the top; harmless under
Astro/Vite). Then create the registry:

```ts
// apps/tools/src/tools/index.ts
import type { ComponentType } from "react";
import InterArrivalSampler from "./inter-arrival-sampler";

export const TOOL_COMPONENTS: Record<string, ComponentType<unknown>> = {
  "inter-arrival-sampler": InterArrivalSampler,
};
```

- [ ] **Step 4: EmbeddedTool.tsx wrapper island**

```tsx
// apps/tools/src/components/EmbeddedTool.tsx
import { TOOL_COMPONENTS } from "@tools/index";

export default function EmbeddedTool({ slug }: { slug: string }) {
  const Tool = TOOL_COMPONENTS[slug];
  if (!Tool) return null;
  return <Tool />;
}
```

- [ ] **Step 5: ToolCard.tsx (port from Next, retype to ToolMeta)**

Copy `$TOOLS/components/tool-card.tsx` to `apps/tools/src/components/ToolCard.tsx`,
then apply these changes:
1. Remove `"use client";` (not needed in Astro islands).
2. Replace `import type { Tool } from "@ogutdgn/sanity-shared";` with
   `import type { ToolMeta } from "@lib/tool";`.
3. Change the import of helpers to `import { getToolTypeMeta, getLiveLinkLabel, STATUS_META } from "@lib/utils";`.
4. Replace every `Tool` type with `ToolMeta`; rename the prop type accordingly:
   `interface ToolCardProps { tool: ToolMeta; onDetailsClick?: (tool: ToolMeta) => void; }`.
5. Replace `tool.slug.current` with `tool.slug`.
6. Replace `tool.content && (tool.content as unknown[]).length > 0` (the
   `hasDetails` calc) with `tool.hasContent`.
7. Everything else (markup, classes) stays identical.

- [ ] **Step 6: ToolDrawer.tsx (port, drop PortableText, use bodyHtml)**

Copy `$TOOLS/components/tool-drawer.tsx` to
`apps/tools/src/components/ToolDrawer.tsx`, then:
1. Remove `"use client";`.
2. Remove the `import { PortableText } ...` and `import type { Tool } from "@ogutdgn/sanity-shared";`
   lines and the entire `portableTextComponents` object.
3. `import { getLiveLinkLabel } from "@lib/utils";` and
   `import type { ToolMeta } from "@lib/tool";`.
4. Replace `Tool` with `ToolMeta` throughout; `prevToolId`/`displayedTool` keys
   use `.slug` instead of `._id`.
5. Replace the "Full Description" block that rendered
   `<PortableText value={displayedTool.content...} />` with:

```tsx
{displayedTool.bodyHtml && (
  <div>
    <h3 className="font-mono text-xs text-dim uppercase tracking-widest mb-3">Full Description</h3>
    <div className="tool-prose" dangerouslySetInnerHTML={{ __html: displayedTool.bodyHtml }} />
  </div>
)}
```
6. Keep the rest (overview, tech, tags, demo video, footer links) identical.
7. Add the `.tool-prose` styles to `src/styles/global.css` (so the drawer body is
   styled like the old Portable Text):

```css
@layer components {
  .tool-prose p { @apply font-sans text-muted text-sm leading-relaxed mb-3; }
  .tool-prose h2 { @apply font-sans text-text font-semibold text-sm mt-5 mb-2 pb-1 border-b border-border; }
  .tool-prose h3 { @apply font-mono text-dim font-medium text-xs uppercase tracking-widest mt-4 mb-2; }
  .tool-prose blockquote { @apply font-sans border-l-2 border-neon/40 pl-3 text-muted text-sm italic mb-3; }
  .tool-prose strong { @apply text-text font-semibold; }
  .tool-prose em { @apply italic; }
  .tool-prose code { @apply font-mono text-xs bg-surface-2 border border-border px-1 py-0.5 rounded text-neon; }
  .tool-prose a { @apply text-neon underline underline-offset-2 hover:text-neon/80; }
  .tool-prose ul { @apply list-disc pl-5 text-muted text-sm mb-3 space-y-1; }
  .tool-prose img { @apply rounded-lg border border-border my-3; }
}
```

- [ ] **Step 7: FilterBar.tsx (port, retype, derive categories from strings)**

Copy `$TOOLS/components/filter-bar.tsx` to
`apps/tools/src/components/FilterBar.tsx`, then:
1. Remove `"use client";`.
2. Replace the Sanity import with `import type { ToolMeta } from "@lib/tool";`
   and update imports of `ToolCard`/`ToolDrawer` to the new filenames
   (`./ToolCard`, `./ToolDrawer`).
3. Change props to `interface FilterBarProps { tools: ToolMeta[]; categories: string[]; }`.
4. Replace the category state/logic to use category **strings** (not `_id`):
   - `const [activeCategory, setActiveCategory] = useState<string>("all");`
   - filtered: `activeCategory === "all" ? tools : tools.filter((t) => t.category === activeCategory)`.
   - the "All" button keeps `tools.length`.
   - map over `categories` (string[]); for each `cat`, `count = tools.filter((t) => t.category === cat).length`; skip if 0; button label `{cat}`, active when `activeCategory === cat`, onClick `setActiveCategory(cat)`.
5. `selectedTool` is `ToolMeta | null`; `key={tool.slug}` in the grid.
6. Keep all classes/markup identical.

- [ ] **Step 8: Verify check**

Run: `cd $ROOT && pnpm --filter @ogutdgn/tools lint`
Expected: 0 errors. (Components compile even though no page uses them yet.)

- [ ] **Step 9: Commit**

```bash
git add apps/tools/src/components apps/tools/src/tools apps/tools/src/layouts apps/tools/src/styles/global.css apps/tools/public/favicon.svg
git diff --cached --stat
git commit -F - <<'MSG'
ui(tools): port navbar, filter grid, drawer and embedded-tool registry

What changed:
- Add Navbar.astro and BaseLayout.astro (static shell + neon background).
- Port ToolCard, ToolDrawer and FilterBar as React islands retyped to a
  serializable ToolMeta; the drawer renders external bodies from pre-built HTML
  with a .tool-prose style instead of Portable Text.
- Move inter-arrival-sampler into src/tools with a TOOL_COMPONENTS registry and
  an EmbeddedTool wrapper island.

Why:
Recreate the interactive tools UI on Astro using React islands while keeping the
design identical.
MSG
```

---

### Task 6: Pages (home, tool detail, robots)

**Files:**
- Replace: `apps/tools/src/pages/index.astro`
- Create: `apps/tools/src/pages/[...slug].astro`
- Create: `apps/tools/src/pages/robots.txt.ts`

- [ ] **Step 1: Home page (port the bespoke layout + FilterBar island)**

Replace `apps/tools/src/pages/index.astro`. Port the full two-column desktop +
mobile markup from `$TOOLS/app/page.tsx` (the intro text, the photo with the
"That's me!" and toilet-paper annotation SVGs, and the stats row), converting JSX
to Astro (`className`→`class`, `&apos;`→`'`, the `next/image` `<Image>`→plain
`<img src="/dog1to.webp">`). Compute data in the frontmatter and mount the island:

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import FilterBar from "@components/FilterBar.tsx";
import { getToolMetas, deriveCategories } from "@lib/tool";

const tools = await getToolMetas();
const categories = deriveCategories(tools);
const stats = [
  { label: "total tools", value: tools.length },
  { label: "active", value: tools.filter((t) => t.status === "active").length },
  { label: "open source", value: tools.filter((t) => t.githubLink).length },
];
---
<BaseLayout title="tools.ogutdgn">
  <!-- ... ported desktop + mobile markup; the stats come from `stats` ... -->
  <!-- In the right column (desktop) and bottom (mobile), mount the island: -->
  <FilterBar tools={tools} categories={categories} client:load />
</BaseLayout>
```

The two `<FilterBar .../>` placements (desktop right column, mobile section)
each pass `tools`/`categories` and `client:load`. Keep the exact wrapper
`class`es from the Next version so the layout is identical.

- [ ] **Step 2: Tool detail page (internal tools only)**

```astro
---
// apps/tools/src/pages/[...slug].astro
import { getCollection, render } from "astro:content";
import BaseLayout from "@layouts/BaseLayout.astro";
import EmbeddedTool from "@components/EmbeddedTool.tsx";
import { getToolTypeMeta, STATUS_META, getLiveLinkLabel } from "@lib/utils";

export async function getStaticPaths() {
  const tools = await getCollection("tools");
  return tools
    .filter((t) => t.data.hostType === "internal")
    .map((t) => ({ params: { slug: t.id }, props: { entry: t } }));
}

const { entry } = Astro.props;
const d = entry.data;
const { Content } = await render(entry);
const typeMeta = getToolTypeMeta(d.toolType);
const statusMeta = STATUS_META[d.status] ?? STATUS_META["active"];
const canonical = `https://tools.ogutdgn.com/${entry.id}`;
---
<BaseLayout title={`${d.title} | tools.ogutdgn.com`} description={d.tagline ?? d.overview} canonical={canonical}>
  <div class="max-w-4xl mx-auto px-6 pt-24 pb-16">
    <a href="/" class="inline-flex items-center gap-2 font-mono text-xs text-muted hover:text-text transition-colors mb-10">← back to tools</a>
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
      <div>
        <!-- header: icon or type-colored fallback, type/status pills, title, tagline -->
        <!-- overview (border-l accent), cover image, then the MDX body: -->
        <article class="tool-prose mb-8"><Content /></article>
        <!-- screenshots grid (d.screenshots), demo video iframe (d.demoVideoUrl) -->
        <div class="mb-8">
          <h2 class="font-mono text-xs text-dim uppercase tracking-widest mb-4">Try it</h2>
          <EmbeddedTool slug={entry.id} client:only="react" />
        </div>
      </div>
      <aside class="space-y-4">
        <!-- links (liveLink if external — but internal tools rarely have one; githubLink), technologies, tags, publishedAt -->
      </aside>
    </div>
  </div>
</BaseLayout>
```

Port the exact header/sidebar markup and classes from `$TOOLS/app/[slug]/page.tsx`
(the Pill component becomes inline spans; `next/image` → `<img>`;
`urlFor(...).url()` → the frontmatter URL path in `d.icon`/`d.coverImage`/
`s.src`). The embedded-tool section renders only because this route is
internal-only. Wrap `<Content />` in `.tool-prose` so the MDX body matches the
old Portable Text styling.

- [ ] **Step 3: robots.txt.ts**

```ts
// apps/tools/src/pages/robots.txt.ts
import type { APIRoute } from "astro";
const body = `
User-agent: *
Allow: /

Sitemap: ${new URL("sitemap-index.xml", import.meta.env.SITE).href}
`.trim();
export const GET: APIRoute = () => new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
```

- [ ] **Step 4: Build and verify in the browser**

Run: `cd $ROOT && pnpm --filter @ogutdgn/tools build`
Expected: 0 errors; dist has `index.html`, one dir per **internal** tool with
`index.html`, `robots.txt`, `sitemap-index.xml`.
Then `pnpm --filter @ogutdgn/tools preview --port 4398` and check (agent-browser
if available): home renders with the neon theme + photo + stats; the category
filter switches the grid; clicking a card opens the drawer (and an external tool
with content shows the full description); an internal tool detail page renders and
the embedded `inter-arrival-sampler` **hydrates and works**; mobile width looks
right. Kill the preview when done.

- [ ] **Step 5: Commit**

```bash
git add apps/tools/src/pages
git diff --cached --stat
git commit -F - <<'MSG'
pages(tools): add home, internal tool detail and robots

What changed:
- Port the bespoke home layout (intro, annotated photo, stats) with the
  FilterBar mounted as a client:load island.
- Add [...slug].astro for internal tools: header, overview, MDX body,
  screenshots, demo video, and the embedded tool via a client:only island.
- Add robots.txt pointing at the sitemap.

Why:
Render the tools content as the actual site with working interactive islands.

Build: tools builds; embedded tool hydrates in preview.
MSG
```

**User checkpoint:** show the home page and an internal tool (with the embedded
sampler) and confirm the design matches the old site.

---

### Task 7: Cleanup, full verification & deploy notes

**Files:**
- Modify: root `package.json` (remove `@sanity/client` again)
- Verify: whole-workspace build

- [ ] **Step 1: Remove the export-only dependency**

Run: `cd $ROOT && pnpm remove -D -w @sanity/client`
(Keep `scripts/export-tools.mjs` for reference, like the portfolio's export
script. `packages/sanity-shared` stays as an archive per the spec — do not
delete it.)

- [ ] **Step 2: Confirm the tools app no longer depends on sanity-shared**

Run: `grep -rn "sanity-shared\|@portabletext\|next-sanity" apps/tools/src apps/tools/package.json`
Expected: no matches. (If any, remove the stray import/dep.)

- [ ] **Step 3: Full workspace build + portfolio tests**

Run: `cd $ROOT && pnpm install && pnpm build`
Expected: turbo builds `@ogutdgn/tools` and `@ogutdgn/portfolio` — both green.
Run: `node --test "scripts/*.test.mjs"` → 10 pass / 0 fail (converter unaffected).

- [ ] **Step 4: Spec verification checklist**

1. `astro check` + build 0 errors for tools (done in Step 3).
2. Every migrated tool: internal ones have a detail page; all appear on the home
   grid; images load (spot-check the built `dist` + a browser pass).
3. Category filter switches the grid; drawer opens and shows external bodies.
4. The embedded `inter-arrival-sampler` runs on its detail page.
5. `robots.txt` and `sitemap-index.xml` exist in `dist`.
6. Mobile layout verified.

- [ ] **Step 5: Commit and hand off**

```bash
git add package.json pnpm-lock.yaml
git diff --cached --stat
git commit -F - <<'MSG'
repo(tools): drop the export-only Sanity dependency

What changed:
- Remove @sanity/client from the root dev dependencies now the tools export is
  done; keep the export script for reference and sanity-shared as an archive.

Why:
Finish the tools migration with no Sanity runtime dependency in either app.

Build: portfolio + tools green. Tests: 10 pass / 0 fail.
MSG
```

Deploy notes for the user (Vercel **tools** project): set the project **root
directory** to `apps/tools`, framework preset **Astro**, static output; the app
needs no runtime env vars; remove the old `SANITY_*` env vars from that project
after cutover. URLs are unchanged, so no redirects are needed.

---

## Self-review notes (author)

- **Spec coverage:** stack/design port (Tasks 2,3,5), islands incl. embedded
  tools (Task 5), MDX content model + export (Tasks 1,3,4), categories-from-string
  + images-in-public (Tasks 1,3,5,6), pages incl. internal-only detail + drawer
  for external (Task 6), robots/sitemap (Task 6), cleanup + sanity-shared kept
  (Task 7), deployment notes (Task 7). All covered.
- **Drawer body:** external-tool bodies are pre-rendered to HTML in `lib/tool.ts`
  via `marked` (server-side) and shown through `dangerouslySetInnerHTML` with a
  `.tool-prose` style — this is the one real design decision beyond the spec and
  it preserves the inline-drawer UX without Portable Text.
- **Embedded tools:** rendered via a single `EmbeddedTool` wrapper island with
  `client:only="react"` (reliable hydration; avoids dynamic-tag-with-directive
  uncertainty).
- **Type consistency:** `ToolMeta` (fields: slug, title, tagline, overview,
  category, hostType, toolType, status, featured, liveLink, githubLink,
  technologies, tags, icon, demoVideoUrl, hasContent, bodyHtml) is the single
  shared shape across `tool.ts`, `ToolCard`, `ToolDrawer`, `FilterBar`, and the
  home page. Detail page reads the raw `entry.data` (which additionally has
  `coverImage`, `screenshots`, `publishedAt`).
