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
