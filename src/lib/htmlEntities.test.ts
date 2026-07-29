import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./htmlEntities";

describe("decodeHtmlEntities", () => {
  it("decodes common named and numeric entities", () => {
    expect(decodeHtmlEntities("Kree&#039;arra")).toBe("Kree'arra");
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
    expect(decodeHtmlEntities("&#x27;")).toBe("'");
  });

  it("does not throw on out-of-range code points", () => {
    expect(() => decodeHtmlEntities("&#1114112;")).not.toThrow();
    expect(decodeHtmlEntities("&#1114112;")).toBe("");
    expect(decodeHtmlEntities("&#x110000;")).toBe("");
    expect(decodeHtmlEntities("&#0000000;")).toBe("\u0000");
  });

  it("skips surrogate code points", () => {
    expect(decodeHtmlEntities("&#55357;")).toBe(""); // 0xd83d
  });
});
