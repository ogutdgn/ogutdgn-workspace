import { useEffect, useState, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import type { ToolMeta } from "@lib/tool";
import { getLiveLinkLabel } from "@lib/utils";

// Inline GitHub SVG because lucide-react v1 removed the Github icon export.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

interface ToolDrawerProps {
  tool: ToolMeta | null;
  onClose: () => void;
}

export function ToolDrawer({ tool, onClose }: ToolDrawerProps) {
  const [displayedTool, setDisplayedTool] = useState<ToolMeta | null>(null);
  const [contentSliding, setContentSliding] = useState(false);
  const isOpen = !!tool;
  const prevToolId = useRef<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!tool) {
      // drawer closing — keep displayed tool until animation done
      const id = setTimeout(() => setDisplayedTool(null), 300);
      return () => clearTimeout(id);
    }

    if (prevToolId.current === null) {
      // first open
      setDisplayedTool(tool);
      prevToolId.current = tool.slug;
      return;
    }

    if (prevToolId.current !== tool.slug) {
      // switching tools — slide out then slide in new content
      setContentSliding(true);
      const id = setTimeout(() => {
        setDisplayedTool(tool);
        prevToolId.current = tool.slug;
        setContentSliding(false);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [tool]);

  return (
    <div
      className={`
        fixed top-14 left-0 z-50 flex flex-col overflow-hidden
        bg-surface border-r border-neon/30
        h-[calc(100vh-3.5rem)]
        w-full md:w-[30%]
        will-change-transform
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {displayedTool && (
        <div
          className={`flex flex-col h-full transition-transform duration-200 ease-in-out ${
            contentSliding ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          {/* header */}
          <div className="flex items-start justify-between p-6 border-b border-border flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-text text-base leading-snug">{displayedTool.title}</h2>
              {displayedTool.tagline && (
                <p className="text-muted text-xs mt-1 leading-relaxed">{displayedTool.tagline}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded border border-border text-muted hover:text-text hover:border-border-bright transition-all flex-shrink-0 ml-4"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {displayedTool.overview && (
              <p className="text-muted text-sm leading-relaxed">{displayedTool.overview}</p>
            )}

            {displayedTool.technologies && displayedTool.technologies.length > 0 && (
              <div>
                <h3 className="font-mono text-xs text-dim uppercase tracking-widest mb-2">Tech Stack</h3>
                <div className="flex flex-wrap gap-1.5">
                  {displayedTool.technologies.map((tech) => (
                    <span key={tech} className="text-xs text-dim font-mono bg-surface-2 border border-border px-2 py-1 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {displayedTool.tags && displayedTool.tags.length > 0 && (
              <div>
                <h3 className="font-mono text-xs text-dim uppercase tracking-widest mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {displayedTool.tags.map((tag) => (
                    <span key={tag} className="text-xs text-muted font-mono px-2 py-0.5 rounded border border-border">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {displayedTool.demoVideoUrl && (
              <div>
                <h3 className="font-mono text-xs text-dim uppercase tracking-widest mb-2">Demo</h3>
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe src={displayedTool.demoVideoUrl} className="w-full h-full" allowFullScreen />
                </div>
              </div>
            )}

            {displayedTool.bodyHtml && (
              <div>
                <h3 className="font-mono text-xs text-dim uppercase tracking-widest mb-3">Full Description</h3>
                <div className="tool-prose" dangerouslySetInnerHTML={{ __html: displayedTool.bodyHtml }} />
              </div>
            )}
          </div>

          {/* footer */}
          <div className="p-6 border-t border-border flex items-center gap-3 flex-shrink-0">
            {displayedTool.githubLink && (
              <a
                href={displayedTool.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-mono text-muted hover:text-text hover:border-border-bright transition-all"
              >
                <GithubIcon className="w-4 h-4" />
                GitHub
              </a>
            )}
            {displayedTool.liveLink && (
              <a
                href={displayedTool.liveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon/40 bg-neon/10 text-sm font-mono text-neon hover:bg-neon/20 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                {getLiveLinkLabel(displayedTool.toolType)}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
