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
  return file;
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
