export type ToolTypeColor = {
  label: string;
  color: string;
  glow: string;
  bg: string;
};

export const TOOL_TYPE_META: Record<string, ToolTypeColor> = {
  "web-app":           { label: "Web App",       color: "text-neon-cyan",   glow: "shadow-neon-cyan/40",   bg: "bg-neon-cyan/10 border-neon-cyan/30" },
  "chrome-extension":  { label: "Chrome Ext",    color: "text-neon-cyan",   glow: "shadow-neon-cyan/40",   bg: "bg-neon-cyan/10 border-neon-cyan/30" },
  "vscode-extension":  { label: "VS Code Ext",   color: "text-neon",        glow: "shadow-neon/40",        bg: "bg-neon/10 border-neon/30" },
  "os-extension":      { label: "OS Ext",        color: "text-neon-orange", glow: "shadow-neon-orange/40", bg: "bg-neon-orange/10 border-neon-orange/30" },
  "cli-npm":           { label: "CLI / npm",     color: "text-neon-green",  glow: "shadow-neon-green/40",  bg: "bg-neon-green/10 border-neon-green/30" },
  "other":             { label: "Other",         color: "text-muted",       glow: "",                      bg: "bg-surface-2 border-border" },
};

export function getToolTypeMeta(type: string): ToolTypeColor {
  return TOOL_TYPE_META[type] ?? { label: type, color: "text-muted", glow: "", bg: "bg-surface-2 border-border" };
}

export function getLiveLinkLabel(toolType: string): string {
  switch (toolType) {
    case "chrome-extension": return "Chrome Store";
    case "vscode-extension": return "VS Marketplace";
    case "cli-npm":          return "npm";
    case "os-extension":     return "Download";
    case "web-app":          return "Open App";
    default:                 return "Visit";
  }
}

export function formatStat(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  "active":       { label: "Active",       color: "text-neon-green", dot: "bg-neon-green" },
  "beta":         { label: "Beta",         color: "text-neon-yellow",dot: "bg-neon-yellow" },
  "alpha":        { label: "Alpha",        color: "text-neon-orange", dot: "bg-neon-orange" },
  "coming-soon":  { label: "Coming Soon",  color: "text-neon-cyan",  dot: "bg-neon-cyan" },
  "deprecated":   { label: "Deprecated",   color: "text-muted",      dot: "bg-muted" },
  "archived":     { label: "Archived",     color: "text-muted",      dot: "bg-muted" },
};
