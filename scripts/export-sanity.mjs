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
  // Collapse literal newlines to a space so the description stays on one line.
  const safe = String(s).replace(/\r?\n/g, " ").trim();
  return `"${safe.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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
    body = body.replaceAll(`(${job.localRef})`, `(${localPath})`);
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
  process.exit(1); // fail loudly rather than ship lossy output
}
