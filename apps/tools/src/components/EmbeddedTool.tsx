import { TOOL_COMPONENTS } from "@tools/index";

export default function EmbeddedTool({ slug }: { slug: string }) {
  const Tool = TOOL_COMPONENTS[slug];
  if (!Tool) return null;
  return <Tool />;
}
