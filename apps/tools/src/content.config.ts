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
