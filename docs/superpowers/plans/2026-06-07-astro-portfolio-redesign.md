# Astro Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/portfolio` (Next.js + Sanity) with a minimal Astro 5 + TS + Tailwind + MDX site modeled on `../portfolio-example` (astro-nano), with content exported from Sanity and a custom pixel-art cursor-chasing mascot.

**Architecture:** Keep the Turborepo monorepo; only `apps/portfolio` changes. Content is exported once from Sanity into co-located MDX + images under `src/content/`. The site is fully static (no server endpoints). The mascot reuses the oneko.js engine with a generated custom sprite sheet that keeps oneko's exact sprite-grid coordinates.

**Tech Stack:** Astro 5, TypeScript, Tailwind CSS 3 (+ @tailwindcss/typography), MDX, @astrojs/{mdx,sitemap,rss}, @fontsource/{inter,lora}, @vercel/analytics, sharp (sprite generation), @sanity/client (export script only).

**Spec:** `docs/superpowers/specs/2026-06-07-astro-portfolio-redesign-design.md`

**Branch:** all work on `redesign/astro-portfolio` (already created).

**Reference paths used throughout:**
- Example site: `/Users/cetinogut/Desktop/CODING/new_coding/portfolio-example` (called `$EXAMPLE` below)
- Workspace root: `/Users/cetinogut/Desktop/CODING/new_coding/ogutdgn-workspace` (called `$ROOT`)

**Key facts (verified against the current codebase):**
- Sanity: projectId `ru03qs5h`, dataset `portfolio` (from `packages/sanity-shared/src/client.ts`)
- Socials: GitHub `https://github.com/ogutdgn`, LinkedIn `https://www.linkedin.com/in/doganogut/`, email `contactdgn@ogutdgn.com`
- Tools site: `https://tools.ogutdgn.com`
- Site domain: `https://ogutdgn.com`
- Photo: `apps/portfolio/public/dogito.jpg`; resume: `apps/portfolio/public/dogan-ogut-resume.pdf`
- Mascot face reference: `docs/superpowers/specs/assets/mascot-face-reference.webp` (curly dark hair, round glasses, gray cap, dark blue shirt)
- Old routes to redirect: `/blogs → /blog`, `/project/:slug → /projects/:slug`

> **Version note for the executor:** Do NOT trust memorized package versions. Before Task 3, run `npm view astro version`, `npm view @astrojs/mdx version`, etc., and use current majors. APIs referenced below (content-layer `glob` loader, `render()` from `astro:content`, `ClientRouter`) are Astro 5 APIs — verify against https://docs.astro.build if anything fails.

---

### Task 1: Portable Text → Markdown converter (with tests)

A small dependency-free converter for the Sanity block content used by this codebase: standard blocks (styles `normal`, `h1`–`h4`, `blockquote`), marks (`strong`, `em`, `code`, `link`), list items (`bullet`, `number`), the custom `code` block type (fields: `code`, `language`, `filename`), and inline `image` blocks.

**Files:**
- Create: `scripts/portable-text-to-markdown.mjs`
- Test: `scripts/portable-text-to-markdown.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// scripts/portable-text-to-markdown.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { portableTextToMarkdown } from "./portable-text-to-markdown.mjs";

const block = (children, style = "normal", extra = {}) => ({
  _type: "block",
  style,
  children,
  markDefs: [],
  ...extra,
});
const span = (text, marks = []) => ({ _type: "span", text, marks });

test("renders plain paragraphs", () => {
  const md = portableTextToMarkdown([block([span("hello world")])]);
  assert.equal(md, "hello world");
});

test("renders headings", () => {
  const md = portableTextToMarkdown([block([span("Title")], "h2")]);
  assert.equal(md, "## Title");
});

test("renders strong, em and inline code marks", () => {
  const md = portableTextToMarkdown([
    block([span("a "), span("bold", ["strong"]), span(" and "), span("x", ["code"])]),
  ]);
  assert.equal(md, "a **bold** and `x`");
});

test("renders links via markDefs", () => {
  const md = portableTextToMarkdown([
    {
      _type: "block",
      style: "normal",
      markDefs: [{ _key: "l1", _type: "link", href: "https://example.com" }],
      children: [span("click ", []), span("here", ["l1"])],
    },
  ]);
  assert.equal(md, "click [here](https://example.com)");
});

test("renders bullet and numbered lists", () => {
  const md = portableTextToMarkdown([
    block([span("one")], "normal", { listItem: "bullet", level: 1 }),
    block([span("two")], "normal", { listItem: "bullet", level: 1 }),
    block([span("first")], "normal", { listItem: "number", level: 1 }),
  ]);
  assert.equal(md, "- one\n- two\n\n1. first");
});

test("renders blockquotes", () => {
  const md = portableTextToMarkdown([block([span("wise words")], "blockquote")]);
  assert.equal(md, "> wise words");
});

test("renders custom code blocks with language", () => {
  const md = portableTextToMarkdown([
    { _type: "code", code: "const x = 1;", language: "typescript", filename: "a.ts" },
  ]);
  assert.equal(md, "```typescript title=\"a.ts\"\nconst x = 1;\n```");
});

test("renders image blocks through the image resolver", () => {
  const md = portableTextToMarkdown(
    [{ _type: "image", asset: { _ref: "image-abc123-800x600-png" }, alt: "a pic" }],
    { resolveImage: (node) => `./images/${node.asset._ref}.png` }
  );
  assert.equal(md, "![a pic](./images/image-abc123-800x600-png.png)");
});

test("collects unknown block types instead of writing lossy output", () => {
  const unknown = [];
  const md = portableTextToMarkdown(
    [{ _type: "mystery", foo: 1 }],
    { onUnknown: (node) => unknown.push(node._type) }
  );
  assert.equal(md, "");
  assert.deepEqual(unknown, ["mystery"]);
});

test("escapes markdown-significant characters in text spans", () => {
  const md = portableTextToMarkdown([block([span("a*b_c")])]);
  assert.equal(md, "a\\*b\\_c");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd $ROOT && node --test scripts/`
Expected: FAIL — `Cannot find module ... portable-text-to-markdown.mjs`

- [ ] **Step 3: Write the converter**

```js
// scripts/portable-text-to-markdown.mjs
// Converts the subset of Sanity Portable Text used by this codebase to Markdown.
// Supported: block styles normal/h1-h4/blockquote, marks strong/em/code/link,
// bullet/number lists, custom `code` blocks, inline `image` blocks.

function escapeText(text) {
  return text.replace(/([*_`[\]])/g, "\\$1");
}

function renderSpan(span, markDefs) {
  let text = escapeText(span.text ?? "");
  for (const mark of span.marks ?? []) {
    if (mark === "strong") text = `**${text}**`;
    else if (mark === "em") text = `*${text}*`;
    else if (mark === "code") text = `\`${span.text}\``; // no escaping inside code
    else {
      const def = markDefs.find((d) => d._key === mark);
      if (def?._type === "link" && def.href) text = `[${text}](${def.href})`;
    }
  }
  return text;
}

function renderBlock(block) {
  const text = (block.children ?? [])
    .map((c) => renderSpan(c, block.markDefs ?? []))
    .join("");
  switch (block.style) {
    case "h1": return `# ${text}`;
    case "h2": return `## ${text}`;
    case "h3": return `### ${text}`;
    case "h4": return `#### ${text}`;
    case "blockquote": return `> ${text}`;
    default: return text;
  }
}

export function portableTextToMarkdown(blocks, options = {}) {
  const { resolveImage = () => null, onUnknown = () => {} } = options;
  const out = []; // array of { md, list: "bullet"|"number"|null }

  for (const node of blocks ?? []) {
    if (node._type === "block") {
      if (node.listItem) {
        const marker = node.listItem === "number" ? "1." : "-";
        const indent = "  ".repeat(Math.max(0, (node.level ?? 1) - 1));
        out.push({ md: `${indent}${marker} ${renderBlock(node)}`, list: node.listItem });
      } else {
        out.push({ md: renderBlock(node), list: null });
      }
    } else if (node._type === "code") {
      const lang = node.language ?? "";
      const title = node.filename ? ` title="${node.filename}"` : "";
      out.push({ md: `\`\`\`${lang}${title}\n${node.code ?? ""}\n\`\`\``, list: null });
    } else if (node._type === "image") {
      const src = resolveImage(node);
      if (src) out.push({ md: `![${node.alt ?? ""}](${src})`, list: null });
      else onUnknown(node);
    } else {
      onUnknown(node);
    }
  }

  // Join: consecutive items of the same list stick together with \n,
  // everything else is separated by a blank line.
  let md = "";
  for (let i = 0; i < out.length; i++) {
    if (i === 0) md = out[i].md;
    else if (out[i].list && out[i].list === out[i - 1].list) md += `\n${out[i].md}`;
    else md += `\n\n${out[i].md}`;
  }
  return md;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd $ROOT && node --test scripts/`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/portable-text-to-markdown.mjs scripts/portable-text-to-markdown.test.mjs
git commit -m "feat: add Portable Text to Markdown converter for Sanity export"
```

---

### Task 2: Sanity export script — run and review

Exports all published blogs and projects to `content-export/{blog,projects}/<slug>/index.mdx` with downloaded images. Output is reviewed by the user before it becomes site content (Task 5).

**Files:**
- Create: `scripts/export-sanity.mjs`
- Modify: `package.json` (root — add `@sanity/client` devDependency)
- Output: `content-export/` (committed for review)

- [ ] **Step 1: Install @sanity/client at the workspace root**

Run: `cd $ROOT && pnpm add -D -w @sanity/client`
Expected: lockfile updated, no errors.

- [ ] **Step 2: Write the export script**

```js
// scripts/export-sanity.mjs
// One-time export of Sanity blogs + projects to MDX with local images.
// Usage: node scripts/export-sanity.mjs
import { createClient } from "@sanity/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { portableTextToMarkdown } from "./portable-text-to-markdown.mjs";

const PROJECT_ID = "ru03qs5h";
const DATASET = "portfolio";
const OUT = path.resolve("content-export");

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2024-01-01",
  useCdn: true,
});

// image-<assetId>-<WxH>-<ext>  →  https://cdn.sanity.io/images/<proj>/<ds>/<assetId>-<WxH>.<ext>
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
  return `./${file}`;
}

function yamlEscape(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    lines.push(`${k}: ${v instanceof Date ? v.toISOString().slice(0, 10) : yamlEscape(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

// First ~150 chars of body text, used when Sanity description is missing.
function excerpt(content) {
  for (const node of content ?? []) {
    if (node._type === "block" && !node.listItem && node.style === "normal") {
      const text = (node.children ?? []).map((c) => c.text ?? "").join("").trim();
      if (text) return text.length > 150 ? `${text.slice(0, 147)}...` : text;
    }
  }
  return "";
}

async function exportDoc(doc, kind, extraFrontmatter) {
  const slug = typeof doc.slug === "string" ? doc.slug : doc.slug?.current;
  if (!slug) throw new Error(`${kind} ${doc._id} has no slug`);
  const dir = path.join(OUT, kind, slug);
  await mkdir(dir, { recursive: true });

  const unknown = [];
  let imageCount = 0;
  const imageJobs = [];
  const md = portableTextToMarkdown(doc.content, {
    resolveImage: (node) => {
      if (!node.asset?._ref) return null;
      imageCount += 1;
      const localRef = `./image-${imageCount}`; // placeholder path, fixed below
      imageJobs.push({ ref: node.asset._ref, basename: `image-${imageCount}`, localRef });
      return localRef;
    },
    onUnknown: (node) => unknown.push(node._type),
  });

  let body = md;
  for (const job of imageJobs) {
    const localPath = await downloadImage(job.ref, dir, job.basename);
    body = body.replace(`(${job.localRef})`, `(${localPath})`);
  }

  const fm = frontmatter({
    title: doc.title,
    description: doc.description || doc.overview || excerpt(doc.content) || doc.title,
    date: new Date(doc.publishedAt || doc._createdAt),
    ...extraFrontmatter(doc),
  });
  await writeFile(path.join(dir, "index.mdx"), `${fm}\n\n${body}\n`);
  return { slug, unknown };
}

const blogs = await client.fetch(
  `*[_type == "blog" && !(_id in path("drafts.**"))]{ _id, title, slug, publishedAt, description, content, _createdAt }`
);
const projects = await client.fetch(
  `*[_type == "project" && !(_id in path("drafts.**"))]{ _id, title, slug, publishedAt, overview, description, content, githubLink, liveLink, _createdAt }`
);

const problems = [];
for (const b of blogs) {
  const { slug, unknown } = await exportDoc(b, "blog", () => ({}));
  console.log(`blog/${slug}`);
  if (unknown.length) problems.push(`blog/${slug}: unconverted block types: ${unknown.join(", ")}`);
}
for (const p of projects) {
  const { slug, unknown } = await exportDoc(p, "projects", (doc) => ({
    demoURL: doc.liveLink, repoURL: doc.githubLink,
  }));
  console.log(`projects/${slug}`);
  if (unknown.length) problems.push(`projects/${slug}: unconverted block types: ${unknown.join(", ")}`);
}

console.log(`\nExported ${blogs.length} blogs, ${projects.length} projects.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1); // fail loudly rather than ship lossy output (spec: error handling)
}
```

- [ ] **Step 3: Run the export**

Run: `cd $ROOT && node scripts/export-sanity.mjs`
Expected: one line per exported document, final summary, exit 0. If it exits 1 with "unconverted block types", inspect those documents' raw content (`npx sanity ...` not needed — just log the node JSON), extend the converter (with a test) to handle the type, and re-run.

- [ ] **Step 4: Spot-check the output**

Run: `find content-export -name index.mdx | head; cat "$(find content-export -name index.mdx | head -1)"`
Expected: valid frontmatter (title/description/date, plus demoURL/repoURL for projects), readable markdown body, image files alongside referencing `./image-N.ext`.

- [ ] **Step 5: Commit and ask the user to review**

```bash
git add content-export package.json pnpm-lock.yaml scripts/export-sanity.mjs
git commit -m "feat: export Sanity blogs and projects to MDX"
```

**STOP — user checkpoint:** ask the user to skim `content-export/` and confirm the content looks right before continuing.

---

### Task 3: Replace apps/portfolio with an Astro 5 scaffold

**Files:**
- Delete: everything in `apps/portfolio` EXCEPT `public/dogito.jpg`, `public/dogan-ogut-resume.pdf`, `public/favicon.ico`, `public/favicon.svg`
- Create: `apps/portfolio/package.json`, `apps/portfolio/astro.config.mjs`, `apps/portfolio/tailwind.config.mjs`, `apps/portfolio/tsconfig.json`, `apps/portfolio/src/env.d.ts`, `apps/portfolio/src/pages/index.astro` (temporary stub)

- [ ] **Step 1: Check current package versions**

Run: `npm view astro version && npm view @astrojs/mdx version && npm view @astrojs/sitemap version && npm view @astrojs/rss version && npm view @astrojs/tailwind version && npm view @vercel/analytics version`
Expected: current versions printed. Use these majors in package.json below (the `^5`/`^4` etc. shown are placeholders for "current major as printed by npm view" — write the real numbers).

- [ ] **Step 2: Remove the Next.js app, preserving keep-list assets**

```bash
cd $ROOT/apps/portfolio
mkdir -p /tmp/portfolio-keep
cp public/dogito.jpg public/dogan-ogut-resume.pdf public/favicon.ico public/favicon.svg /tmp/portfolio-keep/
git rm -r --quiet .
mkdir -p public src/pages
cp /tmp/portfolio-keep/* public/
```

- [ ] **Step 3: Write the new package.json**

Keep the package name and script names so Turborepo's `dev`/`build`/`lint` pipeline is untouched. Use the versions from Step 1:

```json
{
  "name": "@ogutdgn/portfolio",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "lint": "astro check",
    "start": "astro preview",
    "generate:sprite": "node scripts/generate-sprite.mjs"
  },
  "dependencies": {
    "@astrojs/check": "<current>",
    "@astrojs/mdx": "<current>",
    "@astrojs/rss": "<current>",
    "@astrojs/sitemap": "<current>",
    "@astrojs/tailwind": "<current>",
    "@fontsource/inter": "<current>",
    "@fontsource/lora": "<current>",
    "@tailwindcss/typography": "<current>",
    "@vercel/analytics": "<current>",
    "astro": "<current>",
    "clsx": "<current>",
    "tailwind-merge": "<current>",
    "tailwindcss": "^3",
    "typescript": "<current>"
  },
  "devDependencies": {
    "sharp": "<current>"
  }
}
```

- [ ] **Step 4: Write astro.config.mjs, tailwind.config.mjs, tsconfig.json**

```js
// apps/portfolio/astro.config.mjs
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://ogutdgn.com",
  integrations: [mdx(), sitemap(), tailwind()],
  // fully static output — no adapter needed (spec: deployment)
});
```

```js
// apps/portfolio/tailwind.config.mjs  (verbatim from $EXAMPLE/tailwind.config.mjs)
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        serif: ["Lora", ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
```

```json
// apps/portfolio/tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@consts": ["src/consts.ts"],
      "@types": ["src/types.ts"]
    }
  }
}
```

```ts
// apps/portfolio/src/env.d.ts
/// <reference types="astro/client" />
```

- [ ] **Step 5: Stub index page so the build has something to render**

```astro
---
// apps/portfolio/src/pages/index.astro (temporary — replaced in Task 6)
---
<html lang="en"><head><title>ogutdgn</title></head><body><h1>scaffold ok</h1></body></html>
```

- [ ] **Step 6: Install and verify the scaffold builds**

Run: `cd $ROOT && pnpm install && pnpm --filter @ogutdgn/portfolio build`
Expected: `astro check` 0 errors, build completes, `apps/portfolio/dist/index.html` exists.

- [ ] **Step 7: Verify the tools app is unaffected**

Run: `cd $ROOT && pnpm --filter @ogutdgn/tools build`
Expected: tools build passes exactly as before (it never depended on the portfolio app).

- [ ] **Step 8: Commit**

```bash
git add -A apps/portfolio pnpm-lock.yaml
git commit -m "feat: replace Next.js portfolio with Astro 5 scaffold"
```

---

### Task 4: Port the design system (styles, consts, components, layout)

Most files are verbatim or near-verbatim ports from `$EXAMPLE`. Copy each source file from the exact path given, then apply the listed changes. Astro-5 API changes from the Astro-4 example: `ViewTransitions` → `ClientRouter` (in Head.astro), `entry.slug` → `entry.id` (in ArrowCard.astro).

**Files:**
- Create: `apps/portfolio/src/styles/global.css` — copy verbatim from `$EXAMPLE/src/styles/global.css`
- Create: `apps/portfolio/src/lib/utils.ts` — copy verbatim from `$EXAMPLE/src/lib/utils.ts`
- Create: `apps/portfolio/src/types.ts` (below)
- Create: `apps/portfolio/src/consts.ts` (below)
- Create: `apps/portfolio/src/components/Container.astro`, `Link.astro`, `FormattedDate.astro`, `BackToPrev.astro`, `BackToTop.astro` — copy verbatim from `$EXAMPLE/src/components/<same name>`
- Create: `apps/portfolio/src/components/Head.astro` — copy from `$EXAMPLE/src/components/Head.astro`, with changes listed below
- Create: `apps/portfolio/src/components/ArrowCard.astro` — copy from example, with changes below
- Create: `apps/portfolio/src/components/Header.astro` (below — significantly changed nav)
- Create: `apps/portfolio/src/components/Footer.astro` — copy verbatim from `$EXAMPLE/src/components/Footer.astro`
- Create: `apps/portfolio/src/layouts/PageLayout.astro` — copy from example, with changes below

- [ ] **Step 1: Copy the verbatim files**

```bash
cd $ROOT/apps/portfolio
mkdir -p src/styles src/lib src/components src/layouts
EX=/Users/cetinogut/Desktop/CODING/new_coding/portfolio-example
cp $EX/src/styles/global.css        src/styles/global.css
cp $EX/src/lib/utils.ts             src/lib/utils.ts
cp $EX/src/components/Container.astro src/components/Container.astro
cp $EX/src/components/Link.astro      src/components/Link.astro
cp $EX/src/components/FormattedDate.astro src/components/FormattedDate.astro
cp $EX/src/components/BackToPrev.astro src/components/BackToPrev.astro
cp $EX/src/components/BackToTop.astro  src/components/BackToTop.astro
cp $EX/src/components/Footer.astro     src/components/Footer.astro
```

- [ ] **Step 2: Write types.ts and consts.ts**

```ts
// apps/portfolio/src/types.ts
export type Site = {
  NAME: string;
  EMAIL: string;
};

export type Metadata = {
  TITLE: string;
  DESCRIPTION: string;
};

export type Socials = {
  NAME: string;
  HREF: string;
}[];
```

```ts
// apps/portfolio/src/consts.ts
import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Dogan Ogut",
  EMAIL: "contactdgn@ogutdgn.com",
};

export const TOOLS_URL = "https://tools.ogutdgn.com";

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Dogan Ogut — software developer",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Writing about software and things I learn.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION: "A collection of my projects, with links to repositories and demos.",
};

export const SOCIALS: Socials = [
  { NAME: "github", HREF: "https://github.com/ogutdgn" },
  { NAME: "linkedin", HREF: "https://www.linkedin.com/in/doganogut/" },
  { NAME: "email", HREF: "mailto:contactdgn@ogutdgn.com" },
];
```

- [ ] **Step 3: Port Head.astro with Astro 5 + branding changes**

Copy `$EXAMPLE/src/components/Head.astro`, then:
1. Replace `import { ViewTransitions } from "astro:transitions";` with `import { ClientRouter } from "astro:transitions";` and `<ViewTransitions />` with `<ClientRouter />`.
2. Change the default OG image prop to `image = "/dogito.jpg"` (the example used `/nano.png`).
3. Replace the favicon `<link>` block (the example references `/favicon/...` files we don't have) with:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
```

Keep everything else (font preloads, inline theme/scroll/animate script) verbatim — the inline script provides `preloadTheme/animate/onScroll` used across pages.

- [ ] **Step 4: Port ArrowCard.astro for Astro 5 entry IDs**

Copy `$EXAMPLE/src/components/ArrowCard.astro`, change the href line from
`href={`/${entry.collection}/${entry.slug}`}` to `href={`/${entry.collection}/${entry.id}`}`.

- [ ] **Step 5: Write Header.astro (nav: blog / projects / tools + theme toggle)**

Copy `$EXAMPLE/src/components/Header.astro` and replace the `<nav>` contents (keep the theme-toggle button + script verbatim):

```astro
<nav class="flex justify-between items-center">
  <Link href="/" class="font-bold" underline={false}>{SITE.NAME}</Link>

  <div class="flex items-center gap-4">
    <Link href="/blog">blog</Link>
    <Link href="/projects">projects</Link>
    <Link href={TOOLS_URL} external>tools</Link>
    <span>{`/`}</span>
    <!-- theme toggle button: keep verbatim from the example -->
  </div>
</nav>
```

Also update the imports at the top: `import { SITE, TOOLS_URL } from "@consts";`

- [ ] **Step 6: Write PageLayout.astro**

Copy `$EXAMPLE/src/layouts/PageLayout.astro`; remove the `Oneko` import and `<Oneko />` element for now (the mascot lands in Task 9). Keep `<Analytics />` (`@vercel/analytics/astro`).

- [ ] **Step 7: Verify check passes**

Run: `cd $ROOT && pnpm --filter @ogutdgn/portfolio lint`
Expected: `astro check` 0 errors. (Components are not yet referenced by pages; this catches syntax/type errors.)

- [ ] **Step 8: Commit**

```bash
git add apps/portfolio/src
git commit -m "feat: port astro-nano design system (styles, components, layout)"
```

---

### Task 5: Content collections + move exported content in

**Files:**
- Create: `apps/portfolio/src/content.config.ts`
- Move: `content-export/blog/*` → `apps/portfolio/src/content/blog/`, `content-export/projects/*` → `apps/portfolio/src/content/projects/`

- [ ] **Step 1: Write the content config (Astro 5 content layer)**

```ts
// apps/portfolio/src/content.config.ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
    demoURL: z.string().optional(),
    repoURL: z.string().optional(),
  }),
});

export const collections = { blog, projects };
```

Note: with the glob loader, an entry at `src/content/blog/my-post/index.mdx` gets `id === "my-post"` — slugs are preserved.

- [ ] **Step 2: Move the exported content**

```bash
cd $ROOT
mkdir -p apps/portfolio/src/content
git mv content-export/blog apps/portfolio/src/content/blog
git mv content-export/projects apps/portfolio/src/content/projects
rmdir content-export
```

- [ ] **Step 3: Verify the collections load**

Run: `cd $ROOT && pnpm --filter @ogutdgn/portfolio lint`
Expected: 0 errors. Zod schema failures here mean an exported file has bad frontmatter — fix the file (and the exporter if systematic).

- [ ] **Step 4: Commit**

```bash
git add -A apps/portfolio/src/content apps/portfolio/src/content.config.ts
git commit -m "feat: add blog/projects content collections with migrated content"
```

---

### Task 6: Pages (home, blog, projects, RSS, robots)

**Files:**
- Replace: `apps/portfolio/src/pages/index.astro`
- Create: `apps/portfolio/src/pages/blog/index.astro`, `apps/portfolio/src/pages/blog/[...id].astro`
- Create: `apps/portfolio/src/pages/projects/index.astro`, `apps/portfolio/src/pages/projects/[...id].astro`
- Create: `apps/portfolio/src/pages/rss.xml.ts`, `apps/portfolio/src/pages/robots.txt.ts`

- [ ] **Step 1: Write the home page (intro + photo only — no lists, per spec)**

```astro
---
// apps/portfolio/src/pages/index.astro
import Container from "@components/Container.astro";
import PageLayout from "@layouts/PageLayout.astro";
import Link from "@components/Link.astro";
import { HOME } from "@consts";
---

<PageLayout title={HOME.TITLE} description={HOME.DESCRIPTION}>
  <Container>
    <div class="flex flex-col md:flex-row items-start gap-8 py-8 animate">
      <div class="flex-1">
        <h1 class="text-3xl font-bold mb-4 prose dark:prose-invert">hi, i'm dogan 👋</h1>
        <div class="prose dark:prose-invert">
          <p class="text-lg">
            a <span class="font-semibold">software developer</span> studying
            <span class="font-semibold">computer science</span> in the united states.
          </p>
          <p class="text-lg mt-4">
            i build web apps and small tools, and i write about what i learn along the way.
            you can find my work on <Link href="https://github.com/ogutdgn" external>github</Link>,
            try my <Link href="https://tools.ogutdgn.com" external>tools</Link>,
            or grab my <Link href="/dogan-ogut-resume.pdf" external>resume</Link>.
          </p>
        </div>
      </div>

      <div class="md:w-[300px] shrink-0">
        <img
          src="/dogito.jpg"
          alt="Dogan Ogut"
          class="rounded-lg border-2 border-gray-200 dark:border-gray-700"
          width="300"
          height="400"
        />
      </div>
    </div>
  </Container>
</PageLayout>
```

(The intro copy is a starting point distilled from the current site's hero/about — flag it for user review at the end of the task.)

- [ ] **Step 2: Write the blog list page**

```astro
---
// apps/portfolio/src/pages/blog/index.astro
import { getCollection } from "astro:content";
import PageLayout from "@layouts/PageLayout.astro";
import Container from "@components/Container.astro";
import ArrowCard from "@components/ArrowCard.astro";
import { BLOG } from "@consts";

const data = (await getCollection("blog"))
  .filter((post) => !post.data.draft)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

type Acc = Record<string, typeof data>;
const posts = data.reduce((acc: Acc, post) => {
  const year = post.data.date.getFullYear().toString();
  (acc[year] ??= []).push(post);
  return acc;
}, {});
const years = Object.keys(posts).sort((a, b) => parseInt(b) - parseInt(a));
---

<PageLayout title={BLOG.TITLE} description={BLOG.DESCRIPTION}>
  <Container>
    <div class="space-y-10">
      <div class="animate font-semibold text-black dark:text-white">blog</div>
      <div class="space-y-4">
        {years.map((year) => (
          <section class="animate space-y-4">
            <div class="font-semibold text-black dark:text-white">{year}</div>
            <ul class="flex flex-col gap-4">
              {posts[year].map((post) => (
                <li><ArrowCard entry={post} /></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  </Container>
</PageLayout>
```

- [ ] **Step 3: Write the blog detail page**

```astro
---
// apps/portfolio/src/pages/blog/[...id].astro
import { getCollection, render } from "astro:content";
import PageLayout from "@layouts/PageLayout.astro";
import Container from "@components/Container.astro";
import FormattedDate from "@components/FormattedDate.astro";
import BackToPrev from "@components/BackToPrev.astro";

export async function getStaticPaths() {
  const posts = (await getCollection("blog")).filter((post) => !post.data.draft);
  return posts.map((post) => ({ params: { id: post.id }, props: post }));
}

const post = Astro.props;
const { Content } = await render(post);
---

<PageLayout title={post.data.title} description={post.data.description}>
  <Container>
    <div class="animate">
      <BackToPrev href="/blog">Back to blog</BackToPrev>
    </div>
    <div class="space-y-1 my-10">
      <div class="animate flex items-center gap-1.5">
        <div class="font-base text-sm"><FormattedDate date={post.data.date} /></div>
      </div>
      <div class="animate text-2xl font-semibold text-black dark:text-white">
        {post.data.title}
      </div>
    </div>
    <article class="animate">
      <Content />
    </article>
  </Container>
</PageLayout>
```

- [ ] **Step 4: Write the projects list and detail pages**

Projects list — same structure as the blog list with these changes: collection `"projects"`, import `PROJECTS` from `@consts`, heading text `projects`, no year grouping (flat list sorted by date desc):

```astro
---
// apps/portfolio/src/pages/projects/index.astro
import { getCollection } from "astro:content";
import PageLayout from "@layouts/PageLayout.astro";
import Container from "@components/Container.astro";
import ArrowCard from "@components/ArrowCard.astro";
import { PROJECTS } from "@consts";

const projects = (await getCollection("projects"))
  .filter((p) => !p.data.draft)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<PageLayout title={PROJECTS.TITLE} description={PROJECTS.DESCRIPTION}>
  <Container>
    <div class="space-y-10">
      <div class="animate font-semibold text-black dark:text-white">projects</div>
      <ul class="animate flex flex-col gap-4">
        {projects.map((project) => (
          <li><ArrowCard entry={project} /></li>
        ))}
      </ul>
    </div>
  </Container>
</PageLayout>
```

Project detail — same as blog detail with: collection `"projects"`, `BackToPrev href="/projects"` labeled `Back to projects`, plus demo/repo links under the title:

```astro
---
// apps/portfolio/src/pages/projects/[...id].astro
import { getCollection, render } from "astro:content";
import PageLayout from "@layouts/PageLayout.astro";
import Container from "@components/Container.astro";
import FormattedDate from "@components/FormattedDate.astro";
import BackToPrev from "@components/BackToPrev.astro";
import Link from "@components/Link.astro";

export async function getStaticPaths() {
  const projects = (await getCollection("projects")).filter((p) => !p.data.draft);
  return projects.map((project) => ({ params: { id: project.id }, props: project }));
}

const project = Astro.props;
const { Content } = await render(project);
---

<PageLayout title={project.data.title} description={project.data.description}>
  <Container>
    <div class="animate">
      <BackToPrev href="/projects">Back to projects</BackToPrev>
    </div>
    <div class="space-y-1 my-10">
      <div class="animate flex items-center gap-1.5">
        <div class="font-base text-sm"><FormattedDate date={project.data.date} /></div>
      </div>
      <div class="animate text-2xl font-semibold text-black dark:text-white">
        {project.data.title}
      </div>
      {(project.data.demoURL || project.data.repoURL) && (
        <nav class="animate flex gap-1">
          {project.data.demoURL && <Link href={project.data.demoURL} external>demo</Link>}
          {project.data.demoURL && project.data.repoURL && <span>/</span>}
          {project.data.repoURL && <Link href={project.data.repoURL} external>repo</Link>}
        </nav>
      )}
    </div>
    <article class="animate">
      <Content />
    </article>
  </Container>
</PageLayout>
```

- [ ] **Step 5: Write RSS and robots endpoints**

```ts
// apps/portfolio/src/pages/rss.xml.ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { SITE, HOME } from "@consts";

export async function GET(context: APIContext) {
  const blog = (await getCollection("blog")).filter((post) => !post.data.draft);
  const projects = (await getCollection("projects")).filter((p) => !p.data.draft);

  const items = [...blog, ...projects].sort(
    (a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf()
  );

  return rss({
    title: SITE.NAME,
    description: HOME.DESCRIPTION,
    site: context.site!,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.description,
      pubDate: item.data.date,
      link: `/${item.collection}/${item.id}/`,
    })),
  });
}
```

```ts
// apps/portfolio/src/pages/robots.txt.ts
import type { APIRoute } from "astro";

const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${new URL("sitemap-index.xml", import.meta.env.SITE).href}
`.trim();

export const GET: APIRoute = () => {
  return new Response(robotsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
```

- [ ] **Step 6: Build and verify in the browser**

Run: `cd $ROOT && pnpm --filter @ogutdgn/portfolio build`
Expected: 0 errors; dist contains `index.html`, `blog/index.html`, one dir per post/project, `rss.xml`, `robots.txt`, `sitemap-index.xml`.

Then: `pnpm --filter @ogutdgn/portfolio dev` and check with the browser (agent-browser if available): home, /blog, one post, /projects, one project, dark-mode toggle, mobile width. Every migrated document must render — no missing images, no raw markdown artifacts.

- [ ] **Step 7: Commit**

```bash
git add apps/portfolio/src/pages
git commit -m "feat: add home, blog, projects, rss, robots pages"
```

**User checkpoint:** show the home-page intro copy and a couple of rendered posts; confirm copy and content look right.

---

### Task 7: Redirects, vercel.json

**Files:**
- Create: `apps/portfolio/vercel.json`

- [ ] **Step 1: Write vercel.json with permanent redirects (spec: URLs & SEO)**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    { "source": "/blogs", "destination": "/blog", "permanent": true },
    { "source": "/project/:slug", "destination": "/projects/:slug", "permanent": true }
  ]
}
```

- [ ] **Step 2: Verify the file is valid JSON and commit**

Run: `cd $ROOT && node -e "JSON.parse(require('fs').readFileSync('apps/portfolio/vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

```bash
git add apps/portfolio/vercel.json
git commit -m "feat: add permanent redirects for legacy blog/project routes"
```

(Redirect behavior itself is verified on the Vercel preview deployment in Task 10 — it cannot be tested locally with `astro preview`.)

---

### Task 8: Mascot sprite sheet generator

A generated 256×128 PNG (8×4 grid of 32×32 cells) that keeps **the exact cell coordinates of oneko.gif**, so the engine's sprite map carries over unchanged. Character: pixel mini-Dogan — gray cap, dark curly hair, round glasses, dark blue shirt (from the reference photo `docs/superpowers/specs/assets/mascot-face-reference.webp`).

**Files:**
- Create: `apps/portfolio/scripts/generate-sprite.mjs`
- Output: `apps/portfolio/public/mini-dogan.png` (committed) and `docs/superpowers/specs/assets/sprite-preview.png` (8× upscale, for review)

**Cell map (identical to oneko.gif; col,row 0-indexed):**

| State | Cells |
|---|---|
| idle | (3,3) |
| alert | (7,3) |
| tired | (3,2) |
| sleeping | (2,0) (2,1) |
| wave (replaces scratchSelf) | (5,0) (6,0) (7,0) |
| stretch N/S/E/W (replaces scratchWall*) | N:(0,0)(0,1) S:(7,1)(6,2) E:(2,2)(2,3) W:(4,0)(4,1) |
| run N | (1,2) (1,3) |
| run S | (6,3) (7,2) |
| run E | (3,0) (3,1) |
| run W | (4,2) (4,3) |
| run NE | (0,2) (0,3) |
| run NW | (1,0) (1,1) |
| run SE | (5,1) (5,2) |
| run SW | (5,3) (6,1) |

- [ ] **Step 1: Write the generator**

The generator composes each 32×32 cell from ASCII-art pixel grids (one char = one pixel, mapped through a palette). Heads come in four orientations; bodies are per-pose; frames are `{head, body, dx, dy, mirror, overlay}` compositions. Diagonal runs reuse the nearest cardinal art (N for NE/NW, E for SE, W for SW — matching how readable oneko is at this size).

```js
// apps/portfolio/scripts/generate-sprite.mjs
// Generates public/mini-dogan.png (256x128, 8x4 cells of 32px) — same cell
// layout as oneko.gif so the chase engine's sprite map is unchanged.
// Usage: node scripts/generate-sprite.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const PALETTE = {
  _: null,                 // transparent
  C: [138, 138, 138, 255], // cap gray
  D: [110, 110, 110, 255], // cap brim / shading
  H: [58, 42, 30, 255],    // hair dark brown
  S: [232, 184, 138, 255], // skin
  G: [40, 40, 40, 255],    // glasses frame / eyes
  B: [44, 62, 102, 255],   // shirt dark blue
  b: [33, 47, 78, 255],    // shirt shading
  P: [51, 51, 51, 255],    // pants
  K: [26, 26, 26, 255],    // shoes
  W: [255, 255, 255, 255], // highlight / Z / !
  M: [200, 60, 60, 255],   // mouth/accent
};

// --- Part grids (ASCII pixel art; rows of equal length) -------------------
// Head, facing front (12 wide x 11 tall): cap, curls at the sides,
// round glasses, smile.
const HEAD_FRONT = [
  "___CCCCCC___",
  "__CCCCCCCC__",
  "_CCCCCCCCCC_",
  "_DDDDDDDDDD_",
  "HHSSSSSSSSHH",
  "HSGGSSSSGGSH",
  "HSGGSSSSGGSH",
  "HSSSGGGGSSSH",
  "_HSSSSSSSSH_",
  "_HSSMMMMSSH_",
  "__HSSSSSSH__",
];
// Head, facing back (12 x 11): cap from behind + curls, no face.
const HEAD_BACK = [
  "___CCCCCC___",
  "__CCCCCCCC__",
  "_CCCCCCCCCC_",
  "_CCCCCCCCCC_",
  "HHHHHHHHHHHH",
  "HHHHHHHHHHHH",
  "HHHHHHHHHHHH",
  "HHHHHHHHHHHH",
  "_HHHHHHHHHH_",
  "_HHHHHHHHHH_",
  "__HHHHHHHH__",
];
// Head, facing right (12 x 11): brim sticks out to the right,
// one glasses lens, curls at the back (left side of grid).
const HEAD_RIGHT = [
  "__CCCCCC____",
  "_CCCCCCCC___",
  "_CCCCCCCCCC_",
  "_DDDDDDDDDDD",
  "HHHSSSSSSSS_",
  "HHHSSGGGSSS_",
  "HHHSSGGGSSS_",
  "HHHHSSSSSSS_",
  "_HHHSSSSMM__",
  "_HHHSSSSSS__",
  "__HHHSSSS___",
];
// Body standing, front (12 x 9): blue shirt, arms at sides, pants, shoes.
const BODY_STAND_FRONT = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbS_",
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];
// Body run frame A, front (12 x 9): legs split.
const BODY_RUN_FRONT_A = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbB_",
  "__BBBBBBBbS_",
  "__PPPPPPPP__",
  "_PP______PP_",
  "_PP______PP_",
  "_KK______KK_",
];
// Body run frame B, front (12 x 9): legs crossed in.
const BODY_RUN_FRONT_B = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbS_",
  "_SbBBBBBBB__",
  "__PPPPPPPP__",
  "___PP__PP___",
  "___PP__PP___",
  "___KK__KK___",
];
// Body run frame A, side-right (12 x 9): forward lean, stride open.
const BODY_RUN_RIGHT_A = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BBBBBBBBSb_",
  "_BBBBBBBBB__",
  "_BBBBBBBBB__",
  "__PPPPPPP___",
  "_PP_____PP__",
  "PP_______PP_",
  "KK________KK",
];
// Body run frame B, side-right (12 x 9): stride closed.
const BODY_RUN_RIGHT_B = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BBBBBBBBSb_",
  "_BBBBBBBBB__",
  "_BBBBBBBBB__",
  "__PPPPPPP___",
  "____PPP_____",
  "____PPPP____",
  "____KKKK____",
];
// Wave arm variant, front (12 x 9): one arm raised (used for wave cells).
const BODY_WAVE = [
  "__BBBBBBBBS_",
  "_BBBBBBBBBb_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBB__",
  "_SbBBBBBBB__",
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];
// Sleeping (lying down, 24 x 8): horizontal body + head, cap still on.
const SLEEPING = [
  "________________________",
  "____CCCCC___BBBBBBBBB___",
  "___CCCCCCC_BBBBBBBBBBB__",
  "___HSSSSSH_BBBBBBBBBBBB_",
  "___HSGGSSH_BBBBBBBBBBBB_",
  "___HSSSSSH_PPPPPPPPPPK__",
  "____HHHHH___PPPPPPPPKK__",
  "________________________",
];
// Overlays (small, drawn at given offsets)
const OVERLAY_EXCLAIM = ["W_", "W_", "__", "W_"]; // 2x4 "!"
const OVERLAY_Z = ["WWW", "__W", "_W_", "WWW"];   // 3x4 "Z"

// --- Drawing helpers -------------------------------------------------------
const SHEET_W = 256, SHEET_H = 128, CELL = 32;
const sheet = new Uint8Array(SHEET_W * SHEET_H * 4); // RGBA, starts transparent

function drawGrid(grid, x0, y0, { mirror = false } = {}) {
  const h = grid.length, w = grid[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][mirror ? w - 1 - x : x];
      const rgba = PALETTE[ch];
      if (!rgba) continue;
      const px = x0 + x, py = y0 + y;
      if (px < 0 || py < 0 || px >= SHEET_W || py >= SHEET_H) continue;
      sheet.set(rgba, (py * SHEET_W + px) * 4);
    }
  }
}

// Compose a standing/running character into cell (col,row).
// head/body grids are 12 wide; centered at x offset 10 within the 32px cell.
function drawCharacter(col, row, head, body, { mirror = false, bob = 0, overlay = null, overlayAt = [24, 2] } = {}) {
  const x0 = col * CELL + 10, y0 = row * CELL + 6 + bob;
  drawGrid(head, x0, y0, { mirror });
  drawGrid(body, x0, y0 + 11, { mirror });
  if (overlay) drawGrid(overlay, col * CELL + overlayAt[0], row * CELL + overlayAt[1]);
}

function drawSleeping(col, row, zOffset) {
  drawGrid(SLEEPING, col * CELL + 4, row * CELL + 16);
  drawGrid(OVERLAY_Z, col * CELL + 22 + zOffset, row * CELL + 6 + zOffset);
}

// --- Frame assembly (cell map mirrors oneko.gif exactly) -------------------
// idle / alert / tired
drawCharacter(3, 3, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(7, 3, HEAD_FRONT, BODY_STAND_FRONT, { overlay: OVERLAY_EXCLAIM });
drawCharacter(3, 2, HEAD_FRONT, BODY_STAND_FRONT, { bob: 2, overlay: OVERLAY_Z });
// sleeping (2 frames, Z bounces)
drawSleeping(2, 0, 0);
drawSleeping(2, 1, 2);
// wave (replaces scratchSelf): wave A / stand / wave A
drawCharacter(5, 0, HEAD_FRONT, BODY_WAVE);
drawCharacter(6, 0, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(7, 0, HEAD_FRONT, BODY_WAVE);
// stretch toward walls (replaces scratchWall*): wave variants facing the wall
drawCharacter(0, 0, HEAD_BACK,  BODY_WAVE);                      // N wall
drawCharacter(0, 1, HEAD_BACK,  BODY_STAND_FRONT);
drawCharacter(7, 1, HEAD_FRONT, BODY_WAVE);                      // S wall
drawCharacter(6, 2, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(2, 2, HEAD_RIGHT, BODY_WAVE);                      // E wall
drawCharacter(2, 3, HEAD_RIGHT, BODY_STAND_FRONT);
drawCharacter(4, 0, HEAD_RIGHT, BODY_WAVE, { mirror: true });    // W wall
drawCharacter(4, 1, HEAD_RIGHT, BODY_STAND_FRONT, { mirror: true });
// runs — N (away): back view; S (toward): front view
drawCharacter(1, 2, HEAD_BACK, BODY_RUN_FRONT_A);
drawCharacter(1, 3, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(6, 3, HEAD_FRONT, BODY_RUN_FRONT_A);
drawCharacter(7, 2, HEAD_FRONT, BODY_RUN_FRONT_B, { bob: 1 });
// E / W: side views (W = mirrored E)
drawCharacter(3, 0, HEAD_RIGHT, BODY_RUN_RIGHT_A);
drawCharacter(3, 1, HEAD_RIGHT, BODY_RUN_RIGHT_B, { bob: 1 });
drawCharacter(4, 2, HEAD_RIGHT, BODY_RUN_RIGHT_A, { mirror: true });
drawCharacter(4, 3, HEAD_RIGHT, BODY_RUN_RIGHT_B, { mirror: true, bob: 1 });
// diagonals reuse nearest cardinal art
drawCharacter(0, 2, HEAD_BACK, BODY_RUN_FRONT_A);                // NE
drawCharacter(0, 3, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(1, 0, HEAD_BACK, BODY_RUN_FRONT_A);                // NW
drawCharacter(1, 1, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(5, 1, HEAD_RIGHT, BODY_RUN_RIGHT_A);               // SE
drawCharacter(5, 2, HEAD_RIGHT, BODY_RUN_RIGHT_B, { bob: 1 });
drawCharacter(5, 3, HEAD_RIGHT, BODY_RUN_RIGHT_A, { mirror: true }); // SW
drawCharacter(6, 1, HEAD_RIGHT, BODY_RUN_RIGHT_B, { mirror: true, bob: 1 });

// --- Output ----------------------------------------------------------------
const png = sharp(Buffer.from(sheet), { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } }).png();
await png.toFile("public/mini-dogan.png");
await sharp(Buffer.from(sheet), { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } })
  .resize(SHEET_W * 8, SHEET_H * 8, { kernel: "nearest" })
  .png()
  .toFile("../../docs/superpowers/specs/assets/sprite-preview.png");
console.log("Wrote public/mini-dogan.png and sprite-preview.png");
```

Note: all part grids must have rows of equal length — verify with a quick assertion if unsure. The art above is the **first iteration**; expect to tune pixels after seeing the preview.

- [ ] **Step 2: Generate and inspect**

Run: `cd $ROOT/apps/portfolio && node scripts/generate-sprite.mjs`
Expected: both PNGs written. Open `docs/superpowers/specs/assets/sprite-preview.png` (Read tool renders it) and check: character readable at a glance, cap/glasses/curls recognizable, run frames clearly alternate, no stray pixels outside cells.

- [ ] **Step 3: Iterate on the art**

Tune grids (proportions, colors, leg positions) until the preview looks right. Send `sprite-preview.png` to the user for approval.

**STOP — user checkpoint:** the user approves the sprite before it ships.

- [ ] **Step 4: Commit**

```bash
cd $ROOT
git add apps/portfolio/scripts/generate-sprite.mjs apps/portfolio/public/mini-dogan.png docs/superpowers/specs/assets/sprite-preview.png
git commit -m "feat: generate pixel mini-Dogan sprite sheet"
```

---

### Task 9: MiniDogan mascot component

**Files:**
- Create: `apps/portfolio/src/components/MiniDogan.astro` — copy from `$EXAMPLE/src/components/Oneko.astro` with changes below
- Modify: `apps/portfolio/src/layouts/PageLayout.astro`

- [ ] **Step 1: Create MiniDogan.astro**

Copy `$EXAMPLE/src/components/Oneko.astro` to `apps/portfolio/src/components/MiniDogan.astro` and change ONLY:
1. Prop default: `const { catImage = "/oneko.gif" } = Astro.props;` → `const { spriteImage = "/mini-dogan.png" } = Astro.props;` (and `define:vars={{ catImage }}` → `define:vars={{ spriteImage }}`, `url(${catImage})` → `url(${spriteImage})`).
2. Element id: `nekoEl.id = "oneko"` → `nekoEl.id = "mini-dogan"`.
3. Add a click-to-hearts listener inside `init()` (the example defines `explodeHearts()` but never wires it):

```js
nekoEl.addEventListener("click", explodeHearts);
```

The `spriteSets` map stays **byte-for-byte identical** — the generated sheet uses oneko's cell layout (Task 8). State names like `scratchSelf` now show wave/stretch art; the engine logic is untouched.

- [ ] **Step 2: Mount it in the layout**

In `apps/portfolio/src/layouts/PageLayout.astro` add `import MiniDogan from "@components/MiniDogan.astro";` and `<MiniDogan />` right before `<Analytics />`.

- [ ] **Step 3: Verify by hand in the browser**

Run: `cd $ROOT && pnpm --filter @ogutdgn/portfolio dev`
Check (agent-browser or manually): mascot appears, chases cursor, shows distinct art for left/right/up/down movement, idles when caught, eventually sleeps, hearts on click, and `prefers-reduced-motion` disables it (toggle via OS setting or devtools emulation).

- [ ] **Step 4: Commit**

```bash
git add apps/portfolio/src/components/MiniDogan.astro apps/portfolio/src/layouts/PageLayout.astro
git commit -m "feat: add cursor-chasing pixel mini-Dogan mascot"
```

---

### Task 10: Final verification & cleanup

**Files:**
- Modify: root `package.json` (remove `@sanity/client` devDep — export is done; script stays for reference)
- Verify: whole-workspace build, spec checklist

- [ ] **Step 1: Remove the export-only dependency**

Run: `cd $ROOT && pnpm remove -D -w @sanity/client`
(Keep `scripts/export-sanity.mjs` + converter + tests in the repo per spec — they document the migration.)

- [ ] **Step 2: Full workspace build**

Run: `cd $ROOT && pnpm install && pnpm build` (turbo builds portfolio + tools)
Expected: both apps build green.

- [ ] **Step 3: Converter tests still pass**

Run: `cd $ROOT && node --test scripts/`
Expected: PASS (they're dependency-free).

- [ ] **Step 4: Spec verification checklist (from the spec's Testing section)**

1. `astro check` + `astro build` — 0 errors (done in Step 2).
2. Browser spot-check of every migrated post/project (list them from `src/content/`; open each once).
3. Dark/light toggle persists across navigation (ClientRouter transitions included).
4. `rss.xml` and `sitemap-index.xml` exist in dist and include all published content.
5. Draft exclusion: confirm no `draft: true` entry appears in lists/RSS (if no drafts exist, add a temporary `draft: true` test file, verify exclusion, delete it).
6. Mascot behavior verified (Task 9 Step 3).
7. Redirects: verified after deploying a Vercel preview (`vercel` CLI or git push) — `curl -sI https://<preview>/blogs | head -3` shows `308` + `location: /blog`.

- [ ] **Step 5: Commit and hand off**

```bash
git add -A
git commit -m "chore: finalize Astro portfolio migration"
```

Then use superpowers:finishing-a-development-branch — offer the user merge/PR options. Deployment note for the user: the Vercel project's root directory stays `apps/portfolio`; framework preset should auto-detect Astro on the preview deploy — verify in the Vercel dashboard before promoting to production. Sanity env vars (`SANITY_*`, `RESEND_*`, `CONTACT_EMAIL`) are no longer needed by the portfolio project and can be removed from its Vercel env after production cutover.
