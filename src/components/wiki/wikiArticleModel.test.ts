import { describe, expect, it } from "vitest";
import { isWikiView } from "./wikiArticleModel";

describe("isWikiView — API payload validation", () => {
  const good = {
    title: "Arch-Glacor",
    pageUrl: "https://runescape.wiki/w/Arch-Glacor",
    leadHtml: "<p>Boss</p>",
    dropsHtml: "",
    bodyHtml: "<p>Body</p>",
    hasDrops: false,
    facts: [],
  };

  it("accepts a well-formed wiki article payload", () => {
    expect(isWikiView(good)).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(isWikiView({ ...good, leadHtml: undefined })).toBe(false);
    expect(isWikiView({ title: "x" })).toBe(false);
    expect(isWikiView(null)).toBe(false);
  });

  it("rejects non-wiki pageUrl", () => {
    expect(isWikiView({ ...good, pageUrl: "https://evil.test/w/x" })).toBe(false);
    expect(isWikiView({ ...good, pageUrl: "javascript:alert(1)" })).toBe(false);
  });

  it("rejects malformed drops array", () => {
    expect(isWikiView({ ...good, drops: "nope" })).toBe(false);
  });
});
