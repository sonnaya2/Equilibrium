import { describe, expect, it } from "vitest";
import {
  researchRowDetails,
  researchRowLinks,
  researchRowTitle,
  type ResearchRow,
} from "./ResearchSection";

const wikiSource = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Crystal_hatchet",
  title: "Crystal tools",
  verifiedAt: "2026-07-26",
};

describe("researchRowTitle", () => {
  it("uses name and never stringifies a source object", () => {
    expect(
      researchRowTitle({
        name: "Crystal tools",
        source: wikiSource,
      }),
    ).toBe("Crystal tools");
  });

  it("falls through scalars only — source object is ignored", () => {
    expect(
      researchRowTitle({
        source: wikiSource,
        confidence: "partial",
      }),
    ).toBe("—");
  });

  it("uses perk / component / monster before id", () => {
    expect(researchRowTitle({ perk: "Biting 4", id: "x" })).toBe("Biting 4");
    expect(researchRowTitle({ component: "Binding essence", id: "x" })).toBe("Binding essence");
    expect(researchRowTitle({ monster: "Abyssal lords", id: "x" })).toBe("Abyssal lords");
  });
});

describe("researchRowLinks", () => {
  it("pulls url from SourceReference objects and string fields", () => {
    const row: ResearchRow = {
      source: wikiSource,
      source_url: "https://pvme.io/guide",
      sourceUrls: ["https://runescape.wiki/w/Crystal_pickaxe", "https://pvme.io/guide"],
      secondary_source_url: { url: "https://runescape.com/news" },
    };
    const urls = researchRowLinks(row);
    expect(urls).toHaveLength(4);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://runescape.wiki/w/Crystal_hatchet",
        "https://pvme.io/guide",
        "https://runescape.wiki/w/Crystal_pickaxe",
        "https://runescape.com/news",
      ]),
    );
  });
});


describe("researchRowDetails", () => {
  it("leads with bare detail and labels requirements", () => {
    const lines = researchRowDetails({
      id: "anachronia:agility-course",
      name: "Anachronia Agility Course",
      recordType: "activity",
      regionHints: ["anachronia"],
      requiredRegions: ["anachronia"],
      comboLabel: "",
      isRegionCombo: false,
      category: "Agility course",
      detail: "Primary overland routing around Anachronia.",
      requirements: ["30 Agility", "Anachronia access"],
      confidence: "confirmed_wiki",
      source: wikiSource,
      sourceFile: "enrichment.json",
      status: "obtainable",
    });
    expect(lines[0]).toBe("Primary overland routing around Anachronia.");
    expect(lines).toContain("Reqs: 30 Agility · Anachronia access");
    expect(lines.join("\n")).not.toMatch(/confidence|sourceFile|recordType|status/i);
    expect(lines.join("\n")).not.toContain("runescape-wiki");
  });

  it("skips combo plumbing essays when detail is present", () => {
    const lines = researchRowDetails({
      id: "combo:crystal-tools",
      name: "Crystal tools",
      regions: ["tirannwn"],
      optionalRegions: ["fremennik", "anachronia"],
      allRegions: ["tirannwn", "fremennik", "anachronia"],
      skills: ["Woodcutting", "Mining"],
      detail: "Lady Ithell upgrades dragon-tier tools with harmonic dust.",
      confidence: "partial",
      modeled: "partial",
      gapAction: "promote per-tool records",
      source: wikiSource,
      sourceUrls: ["https://runescape.wiki/w/Crystal_hatchet"],
    });
    expect(lines).toEqual(["Lady Ithell upgrades dragon-tier tools with harmonic dust."]);
  });

  it("still shows known short fields when detail is empty", () => {
    const lines = researchRowDetails({
      perk: "Biting 4",
      role: "advanced armour damage perk",
      representative_recipe: ["7 Noxious", "1 Direct", "1 Blade"],
      planner_value: "Noxious supply is the dominant gate.",
      confidence: "pvme_current_recipe",
      source_url: "https://pvme.io/pvme-guides/invention-and-perks/perks/",
    });
    expect(lines.some((line) => line.includes("Noxious"))).toBe(true);
    expect(lines.some((line) => line.includes("dominant gate"))).toBe(true);
    expect(lines.join("\n")).not.toMatch(/confidence/i);
  });

  it("does not dump nested source envelopes as body text", () => {
    const lines = researchRowDetails({
      name: "Test",
      note: "Useful note",
      nested: {
        source: wikiSource,
        confidence: "partial",
        name: "Inner",
        amount: 3,
      },
    });
    expect(lines.join("\n")).not.toContain("runescape-wiki");
    expect(lines.join("\n")).not.toMatch(/confidence/i);
  });
});
