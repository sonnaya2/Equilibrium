import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectArticleAssets, resolveLocalAsset, resolveLocalAssets } from "./wikiLocalAssets";

const PUBLIC = join(process.cwd(), "public");

function expectPublishedLocal(src: string | null | undefined, label: string) {
  expect(src, `${label} should resolve`).toBeTruthy();
  expect(src!.startsWith("/game/"), `${label} must be local /game/ path`).toBe(true);
  expect(src!.includes("://"), `${label} must not be remote`).toBe(false);
  expect(existsSync(join(PUBLIC, src!)), `${src} not published — run npm run sync:assets`).toBe(
    true,
  );
}

describe("resolveLocalAsset", () => {
  it("maps skill names to published skill icons", () => {
    const hit = resolveLocalAsset("Archaeology");
    expect(hit).toMatchObject({
      label: "Archaeology",
      kind: "skill",
      src: "/game/skills/archaeology.webp",
    });
    expectPublishedLocal(hit!.src, "Archaeology");

    const agility = resolveLocalAsset("Agility");
    expect(agility?.src).toBe("/game/skills/agility.webp");
    expect(agility?.kind).toBe("skill");
    expectPublishedLocal(agility!.src, "Agility");
  });

  it("maps boss labels that have published plates", () => {
    const kree = resolveLocalAsset("Kree'arra");
    expect(kree?.kind).toBe("boss");
    expect(kree?.src).toBe("/game/bosses/kreearra.webp");
    expectPublishedLocal(kree!.src, "Kree'arra");

    const glacor = resolveLocalAsset("Arch-Glacor");
    expect(glacor?.kind).toBe("boss");
    expect(glacor?.src).toMatch(/^\/game\/bosses\/arch-glacor\.(webp|png|gif)$/);
    expectPublishedLocal(glacor!.src, "Arch-Glacor");

    const kerapac = resolveLocalAsset("Kerapac, the bound");
    expect(kerapac?.kind).toBe("boss");
    expect(kerapac?.label).toBe("Kerapac, the bound");
    expect(kerapac?.src).toMatch(/^\/game\/bosses\/kerapac\.(webp|png|gif)$/);
    expectPublishedLocal(kerapac!.src, "Kerapac, the bound");
  });

  it("maps a known upgrade / permanent unlock inventory icon", () => {
    const hit = resolveLocalAsset("Bonecrusher");
    expect(hit).toBeTruthy();
    expect(hit!.kind).toMatch(/^(upgrade|item|other)$/);
    expect(hit!.src).toMatch(/bonecrusher\.(webp|png)$/);
    expectPublishedLocal(hit!.src, "Bonecrusher");
  });

  it("returns null for noise / unresolvable labels (no wrong art)", () => {
    expect(resolveLocalAsset("")).toBeNull();
    expect(resolveLocalAsset("Always")).toBeNull();
    expect(resolveLocalAsset("Common")).toBeNull();
    expect(resolveLocalAsset("1–500")).toBeNull();
    expect(resolveLocalAsset("42%")).toBeNull();
    expect(resolveLocalAsset("Random abstract skilling package ladder")).toBeNull();
  });
});

describe("resolveLocalAssets / collectArticleAssets", () => {
  it("dedupes by src and respects cap", () => {
    const assets = resolveLocalAssets(["Archaeology", "Archaeology", "Agility", "Kree'arra"], 2);
    expect(assets).toHaveLength(2);
    const srcs = assets.map((a) => a.src);
    expect(new Set(srcs).size).toBe(2);
    for (const a of assets) expectPublishedLocal(a.src, a.label);
  });

  it("collects drop/title assets and excludes primary art", () => {
    const primary = resolveLocalAsset("Kerapac, the bound")?.src ?? null;
    const assets = collectArticleAssets({
      title: "Kerapac, the bound",
      dropItems: ["Bonecrusher", "Bones", "Always"],
      primaryArtSrc: primary,
    });
    if (primary) {
      expect(assets.every((a) => a.src !== primary)).toBe(true);
    }
    expect(assets.every((a) => a.label.toLowerCase() !== "always")).toBe(true);
    for (const a of assets) {
      expect(a.src.startsWith("/game/")).toBe(true);
    }
  });
});
