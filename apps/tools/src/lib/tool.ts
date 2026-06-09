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
  const hasContent = (entry.body ?? "").trim().length > 0;
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
      ? (marked.parse(entry.body ?? "", { async: false }) as string)
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
