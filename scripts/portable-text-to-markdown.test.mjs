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
