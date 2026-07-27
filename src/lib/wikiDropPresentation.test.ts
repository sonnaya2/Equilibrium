import { describe, expect, it } from "vitest";
import { cleanWikiFootnotes, parseDropQuantity } from "./wikiArticle";
import {
  classifyDropGroup,
  groupDropsForPresentation,
  mergeDropVariants,
  notableDropsForPresentation,
  parseQtyBounds,
  pickHeroFacts,
  presentDrop,
  rarityTierFromRate,
} from "./wikiDropPresentation";

describe("cleanWikiFootnotes", () => {
  it("strips drop-rate [ d N ] markers from rarity strings", () => {
    expect(cleanWikiFootnotes("3 × Always [ d 1 ]")).toBe("3 × Always");
    expect(cleanWikiFootnotes("Varies [ d 2 ] [ d 3 ] [ d 4 ]")).toBe("Varies");
    expect(cleanWikiFootnotes("1/128 [d1]")).toBe("1/128");
    expect(cleanWikiFootnotes("87/1,000 [1]")).toBe("87/1,000");
  });
});

describe("rarityTierFromRate", () => {
  it("maps wiki words and fractions", () => {
    expect(rarityTierFromRate("Always")).toBe("always");
    expect(rarityTierFromRate("3 × Always")).toBe("always");
    expect(rarityTierFromRate("Very rare")).toBe("very-rare");
    expect(rarityTierFromRate("1/12")).toBe("common");
    expect(rarityTierFromRate("1/600")).toBe("very-rare");
    expect(rarityTierFromRate("87/1000")).toBe("uncommon");
  });
});

describe("classifyDropGroup", () => {
  it("prefers wiki section headings", () => {
    expect(
      classifyDropGroup({
        item: "Scripture of Wen",
        quantity: "1",
        rarity: "Rare",
        group: "Unique (5 mechanics)",
      }),
    ).toBe("unique");
    expect(
      classifyDropGroup({
        item: "Gold charm",
        quantity: "1",
        rarity: "87/1000",
        group: "Charms",
      }),
    ).toBe("valuable");
    // Main is high-volume filler — common, not valuable.
    expect(
      classifyDropGroup({
        item: "Uncut dragonstone",
        quantity: "3–5",
        rarity: "3 × 20/200",
        group: "Main",
      }),
    ).toBe("common");
    expect(
      classifyDropGroup({
        item: "Battlestaff",
        quantity: "1–3",
        rarity: "1/48",
        group: "Tertiary",
      }),
    ).toBe("common");
  });

  it("keeps Sanctum rare chase items unique (not common mats)", () => {
    for (const item of [
      "Roar of Awakening",
      "Ode to Deceit",
      "Shard of Genesis Essence",
      "Scripture of Amascut",
      "Divine Rage prayer codex",
    ]) {
      expect(
        classifyDropGroup({
          item,
          quantity: "1",
          rarity: "",
          group: "Rare drops",
        }),
        item,
      ).toBe("unique");
    }
    // Common sanctum mats under "Rare drops" heading stay common via name.
    expect(
      classifyDropGroup({
        item: "Sanctum of rebirth relic (common)",
        quantity: "1",
        rarity: "Common",
        group: "Rare drops",
      }),
    ).toBe("common");
  });

  it("keeps Croesus spore sack unique", () => {
    expect(
      classifyDropGroup({
        item: "Croesus spore sack",
        quantity: "1",
        rarity: "1/5,400 – 1/441",
        group: "Unique",
      }),
    ).toBe("unique");
  });

  it("dedupes Zuk normal/hard unique copies into one rate row", () => {
    const groups = groupDropsForPresentation([
      {
        item: "Scripture of Ful",
        quantity: "1",
        rarity: "1/100; 1/98",
        group: "Normal mode",
      },
      {
        item: "Scripture of Ful",
        quantity: "1",
        rarity: "1/50; 1/49",
        group: "Hard mode",
      },
      {
        item: "Magma Tempest ability codex",
        quantity: "1",
        rarity: "1/100; 1/98",
        group: "Normal mode",
      },
      {
        item: "Magma Tempest ability codex",
        quantity: "1",
        rarity: "1/50; 1/49",
        group: "Hard mode",
      },
    ]);
    const unique = groups.find((g) => g.id === "unique");
    expect(unique?.rows).toHaveLength(2);
    expect(unique?.rows.find((r) => r.item === "Scripture of Ful")?.rate).toMatch(/1\/100/);
    expect(unique?.rows.find((r) => r.item === "Scripture of Ful")?.rate).toMatch(/1\/50/);
  });

  it("falls back to item / rate heuristics", () => {
    expect(
      classifyDropGroup({
        item: "Leng artefact",
        quantity: "1",
        rarity: "1/500",
      }),
    ).toBe("unique");
    expect(
      classifyDropGroup({
        item: "Green charm",
        quantity: "1",
        rarity: "Common",
      }),
    ).toBe("valuable");
  });
});

describe("noted quantity parsing", () => {
  it("strips (noted)/(notes) and flags noted", () => {
    expect(parseDropQuantity("7–12 (noted)")).toEqual({
      quantity: "7–12",
      noted: true,
    });
    expect(parseDropQuantity("2 (notes)")).toEqual({
      quantity: "2",
      noted: true,
    });
    expect(parseDropQuantity("1–3")).toEqual({
      quantity: "1–3",
      noted: false,
    });
  });

  it("presentDrop never leaves noted text in the quantity", () => {
    const p = presentDrop({
      item: "Crushed nest",
      quantity: "7–12 (noted)",
      rarity: "3 × 18/200",
      noted: true,
    });
    expect(p.quantity).toBe("7–12");
    expect(p.noted).toBe(true);
    expect(p.quantity).not.toMatch(/note/i);
  });
});

describe("mergeDropVariants", () => {
  it("merges mechanic-scaled qty spans for the same item+rate", () => {
    const merged = mergeDropVariants([
      {
        item: "Uncut dragonstone",
        quantity: "3–5",
        rate: "3 × 20/200",
        rarityTier: "common",
        noted: true,
      },
      {
        item: "Uncut dragonstone",
        quantity: "4–7",
        rate: "3 × 20/200",
        rarityTier: "common",
        noted: true,
      },
      {
        item: "Uncut dragonstone",
        quantity: "6–10",
        rate: "3 × 20/200",
        rarityTier: "common",
        noted: true,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe("3–10");
    expect(merged[0]?.noted).toBe(true);
  });

  it("parseQtyBounds reads en-dash and hyphen ranges", () => {
    expect(parseQtyBounds("7–12")).toEqual({ min: 7, max: 12 });
    expect(parseQtyBounds("3-5")).toEqual({ min: 3, max: 5 });
    expect(parseQtyBounds("2")).toEqual({ min: 2, max: 2 });
  });
});

describe("groupDropsForPresentation", () => {
  it("splits into unique / valuable / common columns", () => {
    const groups = groupDropsForPresentation([
      {
        item: "Scripture of Wen",
        quantity: "1",
        rarity: "Very rare [ d 1 ]",
        group: "Unique (5 mechanics)",
      },
      {
        item: "Gold charm",
        quantity: "1",
        rarity: "87/1000",
        group: "Charms",
      },
      {
        item: "Ranarr seed",
        quantity: "1–2",
        rarity: "10/200",
        group: "Tertiary",
      },
    ]);
    expect(groups.map((g) => g.id)).toEqual(["unique", "valuable", "common"]);
    expect(groups[0]?.rows[0]?.rate).toBe("Very rare");
    expect(groups.find((g) => g.id === "common")?.collapsedByDefault).toBe(true);
  });

  it("collapses Main filler and merges noted qty variants", () => {
    const groups = groupDropsForPresentation([
      {
        item: "Uncut dragonstone",
        quantity: "3–5 (noted)",
        rarity: "3 × 20/200",
        group: "Main",
      },
      {
        item: "Uncut dragonstone",
        quantity: "6–10 (noted)",
        rarity: "3 × 20/200",
        group: "Main",
      },
      {
        item: "Water talisman",
        quantity: "4–7 (noted)",
        rarity: "3 × 20/200",
        group: "Main",
      },
    ]);
    const common = groups.find((g) => g.id === "common");
    expect(common?.collapsedByDefault).toBe(true);
    expect(common?.rows).toHaveLength(2);
    expect(common?.rows.find((r) => r.item === "Uncut dragonstone")).toMatchObject({
      quantity: "3–10",
      noted: true,
    });
  });
});

describe("notableDropsForPresentation", () => {
  it("prefers unique-section chase items and caps", () => {
    const notable = notableDropsForPresentation(
      [
        {
          item: "Scripture of Wen",
          quantity: "1",
          rarity: "Rare",
          group: "Unique (5 mechanics)",
        },
        {
          item: "Bones",
          quantity: "1",
          rarity: "Always",
          group: "100%",
        },
        {
          item: "Gold charm",
          quantity: "1",
          rarity: "Common",
          group: "Charms",
        },
      ],
      2,
    );
    expect(notable).toHaveLength(2);
    expect(notable[0]?.item).toBe("Scripture of Wen");
  });
});

describe("presentDrop", () => {
  it("cleans rates without inventing values", () => {
    expect(
      presentDrop({
        item: "Elder Trove (Wen, T1)",
        quantity: "1",
        rarity: "Varies [ d 2 ] [ d 3 ] [ d 4 ]",
      }),
    ).toMatchObject({
      item: "Elder Trove (Wen, T1)",
      quantity: "1",
      rate: "Varies",
      rarityTier: "varies",
    });
  });

  it("keeps wiki iconUrl when present", () => {
    const wiki = "https://runescape.wiki/images/Vestments_of_havoc_robe_top.png";
    expect(
      presentDrop({
        item: "Vestments of havoc robe top",
        quantity: "1",
        rarity: "Very rare",
        iconUrl: wiki,
      }).iconUrl,
    ).toBe(wiki);
  });

  it("falls back to local inventory art when wiki iconUrl is missing", () => {
    // Wiki table cells sometimes omit <img>; presentation resolves local /game art.
    const p = presentDrop({
      item: "Bonecrusher",
      quantity: "1",
      rarity: "Very rare",
      iconUrl: null,
    });
    expect(p.iconUrl).toMatch(/^\/game\//);
    expect(p.iconUrl).toMatch(/bonecrusher/i);
  });

  it("leaves iconUrl null when neither wiki nor local art exists", () => {
    expect(
      presentDrop({
        item: "Totally fictional drop xyzzy-999",
        quantity: "1",
        rarity: "Rare",
        iconUrl: null,
      }).iconUrl,
    ).toBeNull();
  });
});

describe("pickHeroFacts", () => {
  it("keeps real compact infobox facts and drops junk", () => {
    const facts = pickHeroFacts([
      { label: "Combat level", value: "7,000" },
      { label: "Location", value: "Glacor Front" },
      { label: "Image", value: "portrait" },
      { label: "JSON", value: '{"foo":1}' },
      { label: "Weakness", value: "None" },
      { label: "Style", value: "Magic" },
    ]);
    expect(facts.map((f) => f.label)).toEqual(["Combat level", "Weakness", "Style", "Location"]);
  });

  it("skips bare Level when Combat level is already present", () => {
    const facts = pickHeroFacts([
      { label: "Combat level", value: "7,000" },
      { label: "Level", value: "1" },
      { label: "Life points", value: "65,000" },
      { label: "League region", value: "Misthalin ✓" },
    ]);
    expect(facts.map((f) => f.label)).toEqual(["Combat level", "Life points", "League region"]);
    expect(facts.find((f) => f.label === "League region")?.value).toBe("Misthalin");
  });
});
