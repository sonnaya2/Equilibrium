import { describe, expect, it } from "vitest";
import { safeExternalHref } from "./safeHref";

describe("safeExternalHref", () => {
  it("accepts https URLs", () => {
    expect(safeExternalHref("https://runescape.wiki/w/Home")).toBe("https://runescape.wiki/w/Home");
  });

  it("rejects javascript: URLs", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
  });

  it("rejects http: URLs", () => {
    expect(safeExternalHref("http://example.com")).toBeNull();
  });

  it("rejects relative paths", () => {
    expect(safeExternalHref("/local/path")).toBeNull();
    expect(safeExternalHref("wiki/page")).toBeNull();
  });

  it("rejects empty and non-strings", () => {
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref("   ")).toBeNull();
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref(undefined)).toBeNull();
    expect(safeExternalHref(42)).toBeNull();
  });
});
