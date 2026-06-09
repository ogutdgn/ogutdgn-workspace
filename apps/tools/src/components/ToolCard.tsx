import { ExternalLink } from "lucide-react";
import type { ToolMeta } from "@lib/tool";
import { getToolTypeMeta, getLiveLinkLabel, STATUS_META } from "@lib/utils";

// Inline GitHub SVG because lucide-react v1 removed the Github icon export.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function StatusDot({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META["active"];
  const isLive = status === "active" || status === "beta";
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${meta.dot}`} />
      </span>
      <span className={`font-mono text-xs ${meta.color}`}>{meta.label}</span>
    </span>
  );
}

interface ToolCardProps {
  tool: ToolMeta;
  onDetailsClick?: (tool: ToolMeta) => void;
}

export function ToolCard({ tool, onDetailsClick }: ToolCardProps) {
  const typeMeta = getToolTypeMeta(tool.toolType);
  const hasDetails = tool.hostType === "external" && tool.hasContent;

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool.hostType === "external" && tool.liveLink) {
      window.open(tool.liveLink, "_blank");
    } else if (tool.hostType === "internal") {
      window.location.href = `/${tool.slug}`;
    }
  };

  return (
    <article className="relative flex flex-col h-full bg-surface border border-border rounded-xl p-5 transition-all duration-300 hover:border-border-bright hover:-translate-y-0.5">

      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-text text-sm leading-tight">
            {tool.title}
          </h2>
          <div className="mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-medium ${typeMeta.bg} ${typeMeta.color}`}>
              {typeMeta.label}
            </span>
          </div>
        </div>
        <StatusDot status={tool.status} />
      </div>

      {/* tagline */}
      {tool.tagline && (
        <p className="text-muted text-xs leading-relaxed mb-4 flex-1">
          {tool.tagline}
        </p>
      )}

      {/* tech stack */}
      {tool.technologies && tool.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {tool.technologies.slice(0, 5).map((tech) => (
            <span key={tech} className="text-xs text-dim font-mono bg-surface-2 border border-border px-1.5 py-0.5 rounded">
              {tech}
            </span>
          ))}
          {tool.technologies.length > 5 && (
            <span className="text-xs text-dim font-mono">+{tool.technologies.length - 5}</span>
          )}
        </div>
      )}

      {/* footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-2">
          {/* github */}
          {tool.githubLink && (
            <a
              href={tool.githubLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs font-mono text-muted hover:text-text hover:border-border-bright transition-all"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              GitHub
            </a>
          )}

          {/* details drawer (external only, if has content) */}
          {hasDetails && (
            <button
              onClick={(e) => { e.stopPropagation(); onDetailsClick?.(tool); }}
              className="px-3 py-1.5 rounded border border-border text-xs font-mono text-muted hover:text-text hover:border-border-bright transition-all"
            >
              Details
            </button>
          )}
        </div>

        {/* primary action */}
        {(tool.liveLink || tool.hostType === "internal") && (
          <button
            onClick={handlePrimaryClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-muted hover:text-text hover:border-border-bright transition-all whitespace-nowrap"
          >
            {tool.hostType === "internal" ? "Open" : getLiveLinkLabel(tool.toolType)}
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </article>
  );
}
