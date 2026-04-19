import { describe, expect, it } from "vitest";
import { normalizeMd, stripOuterCodeFence } from "./markdown.js";

describe("stripOuterCodeFence", () => {
  it("returns empty string for null and undefined", () => {
    expect(stripOuterCodeFence(null)).toBe("");
    expect(stripOuterCodeFence(undefined)).toBe("");
  });

  it("returns empty string for empty input; preserves whitespace-only non-fence strings", () => {
    expect(stripOuterCodeFence("")).toBe("");
    expect(stripOuterCodeFence("   ")).toBe("   ");
  });

  it("returns original markdown when there is no leading code fence", () => {
    expect(stripOuterCodeFence("plain text")).toBe("plain text");
    expect(stripOuterCodeFence("  spaced  ")).toBe("  spaced  ");
  });

  it("returns original when trimmed content does not start with a fence", () => {
    expect(stripOuterCodeFence("intro\n```\ncode\n```")).toBe("intro\n```\ncode\n```");
  });

  it("returns original when fewer than three lines after trim", () => {
    expect(stripOuterCodeFence("```")).toBe("```");
    expect(stripOuterCodeFence("```\n```")).toBe("```\n```");
  });

  it("returns original when first line is not a fence line", () => {
    const md = "notfence\n```\ninner\n```";
    expect(stripOuterCodeFence(md)).toBe(md);
  });

  it("returns original when last line is not exactly closing fence", () => {
    expect(stripOuterCodeFence("```\ncode\n````")).toBe("```\ncode\n````");
    expect(stripOuterCodeFence("```js\ncode\nnotclose")).toBe("```js\ncode\nnotclose");
  });

  it("strips a well-formed outer fence and trims inner content", () => {
    expect(stripOuterCodeFence("```\nhello\n```")).toBe("hello");
    expect(stripOuterCodeFence("```js\nconst x = 1;\n```")).toBe("const x = 1;");
    expect(stripOuterCodeFence("```\n  padded  \n```")).toBe("padded");
  });

  it("handles multiline inner content", () => {
    const inner = "line1\nline2\nline3";
    expect(stripOuterCodeFence("```\n" + inner + "\n```")).toBe(inner);
  });
});

describe("normalizeMd", () => {
  it("delegates to stripOuterCodeFence and trims the result", () => {
    expect(normalizeMd(null)).toBe("");
    expect(normalizeMd(undefined)).toBe("");
    expect(normalizeMd("")).toBe("");
    expect(normalizeMd("  plain  ")).toBe("plain");
  });

  it("normalizes fenced markdown by stripping fence and trimming", () => {
    expect(normalizeMd("```\nbody\n```")).toBe("body");
  });

  it("normalizes empty fenced body when the fence has three lines", () => {
    expect(normalizeMd("```\n\n```")).toBe("");
  });
});
