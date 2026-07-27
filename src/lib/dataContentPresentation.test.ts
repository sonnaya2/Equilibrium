import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clipRewardDisplay,
  contentRewardIcons,
  contentRewardTokens,
  contentRewardsSource,
  contentTypeLabel,
  mapPlaceHref,
  presentContentRewards,
  presentInterestMeta,
  presentInterestName,
  resolveContentLocation,
  resolveRewardIcon,
  resolveTrainingLocation,
  splitContentKind,
  REWARD_ICON_CAP,
} from "./dataContentPresentation";
import {
  REWARD_ICON_BY_LABEL,
  resolveRewardIconLabel,
} from "./rewardIconAliases";
import { contentRewardsFull, majorContentRows } from "./researchRewards";
import { getResearchCatalog } from "@/research/catalog";
const PUBLIC = join(process.cwd(), "public");
const catalog = getResearchCatalog();

function regionById(id: string) {
  const region = catalog.regions.find((r) => r.id === id);
  if (!region) throw new Error(`missing region ${id}`);
  return region;
}

function contentRow(regionId: string, name: string | RegExp) {
  const region = regionById(regionId);
  const row = region.content.find((c) =>
    typeof name === "string" ? c.name === name : name.test(c.name),
  );
  if (!row) throw new Error(`missing content ${String(name)} in ${regionId}`);
  return { row, upgrades: region.upgrades };
}

function publicOk(webPath: string | null): boolean {
  if (!webPath || !webPath.startsWith("/game/")) return false;
  return existsSync(join(PUBLIC, webPath.slice(1)));
}

describe("contentRewardsSource + clipRewardDisplay", () => {
  it("keeps full unclipped source and clips display separately", () => {
    const full =
      "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps, Scripture of Jas";
    expect(contentRewardsSource(full)).toBe(full);
    const display = clipRewardDisplay(full, 96);
    expect(display.length).toBeLessThanOrEqual(96);
    expect(display.endsWith("...") || display === full).toBe(true);
    // Last unique must remain in the source used for tokens.
    expect(contentRewardsSource(full)).toMatch(/Scripture of Jas/);
  });

  it("extracts Effects / Unlocks segments", () => {
    expect(
      contentRewardsSource(
        "Citadel above City of Um · Effects: Omni guard, Soulbound lantern, Robes of the First Necromancer",
      ),
    ).toBe("Omni guard, Soulbound lantern, Robes of the First Necromancer");
  });

  it("prefers Unlocks item lists over Effects prose when both exist", () => {
    const bandos =
      "Effects: Classic T70 non-degrading melee power armour ladder before Torva · Unlocks: Bandos helmet / chestplate / tassets";
    expect(contentRewardsSource(bandos)).toMatch(/Bandos helmet/i);
    expect(contentRewardsSource(bandos)).not.toMatch(/Classic T70/i);
    const tokens = contentRewardTokens(bandos);
    expect(tokens.some((t) => /bandos helmet/i.test(t))).toBe(true);
    expect(tokens.some((t) => /bandos chestplate/i.test(t))).toBe(true);
  });
});

describe("contentRewardTokens", () => {
  it("splits comma and middot lists", () => {
    expect(
      contentRewardTokens(
        "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps",
      ),
    ).toEqual([
      "Fractured Staff of Armadyl components",
      "Greater Concentrated Blast",
      "Kerapac's wrist wraps",
    ]);
    expect(contentRewardTokens("Hermodic plates · Necromancy power armour")).toEqual([
      "Hermodic plates",
      "Necromancy power armour",
    ]);
  });

  it("tokenizes Nex set shorthand without exploding prose", () => {
    expect(contentRewardTokens("Torva, Pernix, Virtus")).toEqual(["Torva", "Pernix", "Virtus"]);
  });

  it("returns empty for em dash and long non-list prose", () => {
    expect(contentRewardTokens("—")).toEqual([]);
    expect(
      contentRewardTokens(
        "This is a long narrative sentence about regional access without any list separators at all.",
      ),
    ).toEqual([]);
  });

  it("drops trailing upgrade noise tokens", () => {
    const tokens = contentRewardTokens(
      "Frozen core of Leng, Dark nilas, Leng artefact, Scripture of Wen, enhanced glove upgrades",
    );
    expect(tokens).toContain("Frozen core of Leng");
    expect(tokens).toContain("Scripture of Wen");
    expect(tokens.some((t) => /enhanced glove/i.test(t))).toBe(false);
  });
});

describe("resolveRewardIcon + contentRewardIcons", () => {
  it("resolves known Kerapac / Rasial reward tokens", () => {
    const tokens = contentRewardTokens(
      "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps, Scripture of Jas",
    );
    const icons = contentRewardIcons(tokens);
    expect(icons.length).toBeGreaterThanOrEqual(3);
    expect(icons.every((i) => publicOk(i.src))).toBe(true);
    expect(icons.some((i) => /fractured-staff|greater-concentrated|wrist-wrap|scripture-of-jas/i.test(i.src))).toBe(
      true,
    );
  });

  it("resolves Nex Torva/Pernix/Virtus set shorthand", () => {
    const icons = contentRewardIcons(contentRewardTokens("Torva, Pernix, Virtus"));
    expect(icons.length).toBe(3);
    expect(icons.map((i) => i.label)).toEqual(["Torva", "Pernix", "Virtus"]);
    expect(icons.every((i) => publicOk(i.src))).toBe(true);
    expect(icons[0]!.src).toMatch(/torva/i);
    expect(icons[1]!.src).toMatch(/pernix/i);
    expect(icons[2]!.src).toMatch(/virtus/i);
  });

  it("rejects skill glyphs and scenery for weak reward labels", () => {
    // Pure skill name must not become a skill cap chip in reward wells.
    expect(resolveRewardIcon("Mining")).toBeNull();
    expect(resolveRewardIcon("Random scenery hub")).toBeNull();
    // Hermod path may map "Necromancy power armour" to deathdealer inventory art (not skill glyph).
    const necro = resolveRewardIcon("Necromancy power armour");
    if (necro) {
      expect(necro).not.toMatch(/\/skills\//);
      expect(necro).toMatch(/deathdealer|upgrades\//);
    }
  });

  it("caps icon count", () => {
    const many = contentRewardTokens(
      "Roar of Awakening, Ode to Deceit, Divine Rage prayer codex, Scripture of Amascut, Shard of Genesis Essence, Extra filler item",
    );
    expect(contentRewardIcons(many, 3).length).toBeLessThanOrEqual(3);
  });
});

describe("presentContentRewards — major boss uniques", () => {
  const samples: { name: string; full: string; minResolved: number; srcRe: RegExp }[] = [
    {
      name: "Kerapac",
      full:
        "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps, Scripture of Jas",
      minResolved: 4,
      srcRe: /fractured-staff|greater-concentrated|wrist-wrap|scripture-of-jas/,
    },
    {
      name: "Arch-Glacor",
      full: "Frozen core of Leng, Dark nilas, Leng artefact, Scripture of Wen, enhanced glove upgrades",
      minResolved: 4,
      srcRe: /frozen-core|dark-nilas|leng-artefact|scripture-of-wen/,
    },
    {
      name: "Croesus",
      full: "Cryptbloom armour, Scripture of Bik, Sana's fyrtorch, Tagga's corehammer",
      minResolved: 4,
      srcRe: /cryptbloom|scripture-of-bik|sanas-fyrtorch|taggas-corehammer/,
    },
    {
      name: "Rasial",
      full: "Omni guard, Soulbound lantern, Robes of the First Necromancer",
      minResolved: 3,
      srcRe: /omni-guard|soulbound|first-necromancer/,
    },
    {
      name: "Nex",
      full: "Torva, Pernix, Virtus",
      minResolved: 3,
      srcRe: /torva|pernix|virtus/,
    },
    {
      name: "Vorago",
      full: "Seismic wand, Seismic singularity, Tectonic energy",
      minResolved: 3,
      srcRe: /seismic|tectonic-energy/,
    },
    {
      name: "Nex AoD",
      full: "Wand of the praesul, Imperium core, Praesul codex",
      minResolved: 3,
      srcRe: /praesul|imperium/,
    },
    {
      name: "DK rings",
      full: "Berserker ring, Warrior ring, Archers' ring, Seers' ring, Dragon hatchet · Source: Waterbirth Island",
      minResolved: 5,
      srcRe: /berserker-ring|warrior-ring|archers-ring|seers-ring|dragon-hatchet/,
    },
    {
      name: "Raksha",
      full: "Greater Ricochet, Greater Chain, Divert",
      minResolved: 3,
      srcRe: /greater-ricochet|greater-chain|divert/,
    },
    {
      name: "TzKal-Zuk",
      full: "Ek-ZekKil, Magma Tempest, Scripture of Ful, Igneous Kal-Zuk",
      minResolved: 4,
      srcRe: /ek-zekkil|magma-tempest|scripture-of-ful|igneous-kal-zuk/,
    },
    {
      name: "Sanctum of Rebirth",
      full:
        "Roar of Awakening, Ode to Deceit, Divine Rage prayer codex, Scripture of Amascut, Shard of Genesis Essence",
      minResolved: 5,
      srcRe: /roar-of-awakening|ode-to-deceit|divine-rage|scripture-of-amascut|shard-of-genesis/,
    },
    {
      name: "Gate of Elidinis",
      full: "Eclipsed Soul prayer codex, Memory dowser, Runic attuner, Scripture of Elidinis",
      minResolved: 4,
      srcRe: /eclipsed-soul|memory-dowser|runic-attuner|scripture-of-elidinis/,
    },
    {
      name: "Solak",
      full: "Blightbound crossbow, Off-hand Blightbound crossbow, Erethdor's grimoire, Torn grimoire pages",
      minResolved: 3,
      srcRe: /blightbound|erethdor/,
    },
    {
      name: "Araxxor",
      full: "Noxious scythe, Noxious staff, Noxious longbow",
      minResolved: 3,
      srcRe: /noxious/,
    },
    {
      name: "Amascut",
      full: "Devourer's Guard, Tumeken's Light, Tumeken's resplendence equipment, Shard of Genesis Essence",
      minResolved: 3,
      srcRe: /devourers-guard|tumekens-light|tumekens-resplendence|shard-of-genesis/,
    },
    {
      name: "Telos",
      full: "Seren godbow, Staff of Sliske, Zaros godsword",
      minResolved: 3,
      srcRe: /seren-godbow|staff-of-sliske|zaros-godsword/,
    },
    {
      name: "ED2 Dragonkin Laboratory",
      full: "Greater Fury, Greater Flurry, Greater Barge, Draconic energy",
      minResolved: 4,
      srcRe: /greater-fury|greater-flurry|greater-barge|draconic-energy/,
    },
    {
      name: "ED3 Shadow Reef",
      full: "Eldritch crossbow components",
      minResolved: 1,
      srcRe: /eldritch-crossbow/,
    },
    {
      name: "GWD2",
      full:
        "Dragon Rider lance, Wand of the Cywir elders, Orb of the Cywir elders, Shadow glaives, Blade of Avaryss, Blade of Nymora, Anima core equipment",
      minResolved: 5,
      srcRe: /dragon-rider-lance|cywir|shadow-glaive|blade-of|anima-core/,
    },
    {
      name: "Rise of the Six",
      full: "Malevolent energy, Malevolent armour",
      minResolved: 2,
      srcRe: /malevolent/,
    },
    {
      name: "Legiones",
      full: "Ascension crossbow, Off-hand Ascension crossbow",
      minResolved: 2,
      srcRe: /ascension/,
    },
    {
      name: "Kalphite King",
      full: "Drygore weapons",
      minResolved: 1,
      srcRe: /drygore/,
    },
    {
      name: "Zemouregal",
      full: "Dracolich armour, Elite Dracolich armour, Invoke Lord of Bones",
      minResolved: 3,
      srcRe: /dracolich|invoke-lord/,
    },
    {
      name: "Corporeal Beast",
      full: "Holy elixir, Spectral spirit shield, Arcane spirit shield, Divine spirit shield, Spirit shield",
      minResolved: 4,
      srcRe: /holy-elixir|spirit-shield/,
    },
    {
      name: "Anachronia uniques",
      full: "Dragon mattock, Gemstone armour, Terrasaur maul, Double Surge, Double Escape, Anachronia totems",
      minResolved: 5,
      srcRe: /dragon-mattock|gemstone|terrasaur|surge|escape|anachronia-totem/,
    },
    {
      name: "Hermod / necro power",
      full: "Necromancy power armour, Deathdealer armour, Deathwarden armour",
      minResolved: 2,
      srcRe: /deathdealer|deathwarden/,
    },
    {
      name: "GWD1 Bandos slash pieces",
      full: "Bandos helmet / chestplate / tassets / gloves / boots",
      minResolved: 4,
      srcRe: /bandos/,
    },
    {
      name: "GWD2 refined anima",
      full: "Anima core of Zaros armour, Refined anima core armour, Dragon Rider lance, Shadow glaives",
      minResolved: 3,
      srcRe: /anima-core|dragon-rider|shadow-glaive/,
    },
    {
      name: "Desert drygore pieces",
      full: "Drygore mace, Drygore longsword, Drygore rapier, Off-hand drygore mace",
      minResolved: 4,
      srcRe: /drygore/,
    },
    {
      name: "Fremennik lunar + DK",
      full: "Lunar spellbook, Berserker ring, Dragon hatchet",
      minResolved: 3,
      srcRe: /lunar-spellbook|berserker-ring|dragon-hatchet/,
    },
    {
      name: "Nex AoD praesul pack",
      full: "Wand of the praesul, Wand of praesul, Imperium core, Praesul codex",
      minResolved: 3,
      srcRe: /praesul|imperium/,
    },
  ];

  it("covers at least 15 high-profile boss unique packs", () => {
    expect(samples.length).toBeGreaterThanOrEqual(15);
  });

  for (const sample of samples) {
    it(`${sample.name}: high resolve rate, files exist, +N only for overflow`, () => {
      const presented = presentContentRewards(sample.full);
      const all = contentRewardIcons(presented.tokens, 99);
      expect(all.length, `${sample.name} resolved`).toBeGreaterThanOrEqual(sample.minResolved);
      expect(all.every((i) => publicOk(i.src))).toBe(true);
      expect(all.some((i) => sample.srcRe.test(i.src))).toBe(true);
      // Prefer inventory / upgrade chips over boss plate photos.
      expect(all.every((i) => !i.src.includes("/game/bosses/"))).toBe(true);
      // Display cap: overflow only when more *resolved* than cap.
      expect(presented.icons.length).toBeLessThanOrEqual(REWARD_ICON_CAP);
      expect(presented.overflowResolved).toBe(Math.max(0, all.length - presented.icons.length));
      // Unresolved failures must not inflate +N.
      if (all.length <= REWARD_ICON_CAP) {
        expect(presented.overflowResolved).toBe(0);
      }
    });
  }

  it("does not show +N when tokens fail to resolve (user complaint)", () => {
    // Tokens with no honest inventory art — must not invent chips or fake +N.
    const presented = presentContentRewards(
      "Hermodic plates, Ascension signet keystone, Savage spear components",
    );
    expect(presented.icons.length).toBe(0);
    expect(presented.overflowResolved).toBe(0);
  });

  it("clips display while resolving past the 96-char boundary", () => {
    const full =
      "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps, Scripture of Jas";
    const clipped = clipRewardDisplay(full, 96);
    const fullPresented = presentContentRewards(full);
    expect(fullPresented.tokens).toContain("Scripture of Jas");
    expect(fullPresented.icons.some((i) => /scripture-of-jas/i.test(i.src))).toBe(true);
    expect(clipped.length).toBeLessThan(full.length);
    // Prove the old bug: truncated last token would not resolve.
    expect(resolveRewardIcon("Scripture of Ja")).toBeNull();
  });
});

describe("REWARD_ICON_BY_LABEL", () => {
  it("has unique keys, published paths, and end-to-end resolveRewardIcon hits", () => {
    const keys = Object.keys(REWARD_ICON_BY_LABEL);
    expect(keys.length).toBeGreaterThan(80);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [key, src] of Object.entries(REWARD_ICON_BY_LABEL)) {
      expect(key).toBe(key.trim().toLowerCase());
      expect(src.startsWith("/game/")).toBe(true);
      expect(publicOk(src), `missing file ${key} → ${src}`).toBe(true);
      expect(src.includes("/game/bosses/")).toBe(false);
      // Alias must survive acceptRewardPath (EQUIPMENT_OK gate for equipment/*).
      const resolved = resolveRewardIcon(key);
      expect(resolved, `resolveRewardIcon failed for alias "${key}"`).toBe(src);
    }
  });

  it("resolveRewardIconLabel is case-insensitive on trim", () => {
    expect(resolveRewardIconLabel("  Omni Guard  ")).toMatch(/omni-guard\.png$/);
    expect(resolveRewardIconLabel("unknown unique xyz")).toBeNull();
  });

  it("resolveRewardIconLabel is apostrophe-insensitive both ways", () => {
    expect(resolveRewardIconLabel("Kerapac's wrist wraps")).toMatch(/kerapacs-wrist-wraps\.png$/);
    expect(resolveRewardIconLabel("Kerapacs wrist wraps")).toMatch(/kerapacs-wrist-wraps\.png$/);
    expect(resolveRewardIconLabel("Tumeken’s Light")).toMatch(/tumekens-light\.png$/); // curly ’
    expect(resolveRewardIconLabel("Sana's fyrtorch")).toMatch(/sanas-fyrtorch\.png$/);
    expect(resolveRewardIconLabel("Sanas fyrtorch")).toMatch(/sanas-fyrtorch\.png$/);
  });

  it("resolves anachronia / corp / lunar access tokens", () => {
    expect(resolveRewardIcon("Double Surge")).toMatch(/abilities\/movement\/surge\.png$/);
    expect(resolveRewardIcon("Dragon mattock")).toMatch(/dragon-mattock\.png$/);
    expect(resolveRewardIcon("Spirit shield")).toMatch(/spirit-shield\.png$/);
    expect(resolveRewardIcon("Lunar spellbook")).toMatch(/lunar-spellbook\.png$/);
    expect(resolveRewardIcon("Pale energy")).toMatch(/pale-energy\.png$/);
  });
});


describe("splitContentKind", () => {
  it("keeps pure types as Type without location", () => {
    expect(splitContentKind("boss", "Raksha")).toEqual({ type: "Boss", locationHint: null });
    expect(splitContentKind("upgrade", "Bandos equipment")).toEqual({
      type: "Upgrade",
      locationHint: null,
    });
    expect(splitContentKind("Hunter", "Birdhouses")).toEqual({
      type: "Hunter",
      locationHint: null,
    });
  });

  it("treats place kinds as location hints", () => {
    const gwd = splitContentKind("God Wars Dungeon 1", "General Graardor");
    expect(gwd.locationHint).toMatch(/God Wars/i);
    expect(gwd.type).toBe("Boss");

    const mole = splitContentKind("Falador", "Giant Mole");
    expect(mole.locationHint).toBe("Falador");
  });

  it("splits mixed dungeon / skilling boss kinds", () => {
    const croesus = splitContentKind("Elder God Wars Dungeon / skilling boss", "Croesus");
    expect(croesus.type).toMatch(/boss/i);
    expect(croesus.locationHint).toMatch(/Elder God Wars/i);
  });
});

describe("resolveContentLocation", () => {
  it("links pinned places with exact anchor names", () => {
    const dig = resolveContentLocation(
      "misthalin",
      "Varrock Dig Site / early Archaeology",
      "skilling",
    );
    expect(dig.place).toBe("Varrock Dig Site");
    expect(dig.href).toBe(mapPlaceHref("misthalin", "Varrock Dig Site"));

    const graardor = resolveContentLocation("asgarnia", "General Graardor", "God Wars Dungeon 1");
    expect(graardor.href).toBeTruthy();
    expect(graardor.place).toBeTruthy();
  });

  it("does not invent centroid links for unpinned upgrade rows", () => {
    const bandos = resolveContentLocation("asgarnia", "Bandos equipment", "upgrade");
    expect(bandos.href).toBeNull();
  });

  it("may label unpinned place-like kinds without href", () => {
    // If kind is place-like but no anchor match, label without link is ok.
    const loc = resolveContentLocation("fremennik", "Some unknown site", "Wilderness");
    if (loc.label) expect(loc.href === null || typeof loc.href === "string").toBe(true);
  });
});

describe("resolveTrainingLocation", () => {
  it("links known training places", () => {
    const loc = resolveTrainingLocation("kandarin", "Barbarian Outpost", ["kandarin"]);
    expect(loc.href).toBe(mapPlaceHref("kandarin", "Barbarian Outpost"));
  });

  it("shows text without href when unpinned", () => {
    const loc = resolveTrainingLocation("misthalin", "Some invented cave", []);
    expect(loc.label).toBe("Some invented cave");
    expect(loc.href).toBeNull();
  });
});

describe("contentTypeLabel", () => {
  it("returns short type labels for catalog samples", () => {
    expect(contentTypeLabel("Elder God Wars Dungeon", "Kerapac, the bound")).toBeTruthy();
    expect(contentTypeLabel("Divination", "Pale wisps near Draynor")).toBe("Divination");
  });
});

describe("presentInterestName / presentInterestMeta", () => {
  it("drops planner hub suffixes from place names", () => {
    expect(presentInterestName("Draynor Village skilling hub")).toBe("Draynor Village");
    expect(presentInterestName("Edgeville skilling and Wilderness on-ramp hub")).toBe(
      "Edgeville",
    );
    expect(presentInterestName("Lumbridge early skilling hub")).toBe("Lumbridge");
    expect(presentInterestName("Port Sarim docks and skilling hub")).toBe("Port Sarim");
    expect(presentInterestName("Seers' Village skilling hub")).toBe("Seers' Village");
    expect(presentInterestName("Fort Forinthry Town Hall (full T1–T3 building hub)")).toBe(
      "Fort Town Hall",
    );
    expect(presentInterestName("Fort Forinthry Guardhouse and Raptor Slayer hub")).toBe(
      "Fort Guardhouse",
    );
    expect(presentInterestName("Fort Forinthry Kitchen")).toBe("Fort Kitchen");
  });

  it("rewrites region-prefixed RC altar packages into player labels", () => {
    expect(
      presentInterestName(
        "Misthalin Runecrafting altars (Water, Earth) and essence access",
      ),
    ).toBe("Water & Earth altars");
    expect(presentInterestName("Asgarnia Runecrafting altars (Mind, Body, Law)")).toBe(
      "Mind, Body & Law altars",
    );
    expect(presentInterestName("Entrana Law altar and island skilling access")).toBe(
      "Law altar (Entrana)",
    );
    expect(presentInterestName("Blood altar Runecrafting")).toBe("Blood altar");
    expect(presentInterestName("Abyss Runecrafting stack")).toBe("Abyss Runecrafting");
  });

  it("rewrites Um / diary / combat planner titles", () => {
    expect(presentInterestName("Soul Supplies and City of Um skilling shops")).toBe(
      "Soul Supplies",
    );
    expect(presentInterestName("City of Um ritual site and focus storage")).toBe(
      "Um ritual site",
    );
    expect(
      presentInterestName("Selene Necromancy prayer and curse unlocks (City of Um)"),
    ).toBe("Selene prayers");
    expect(presentInterestName("Underworld Grimoire 1-4")).toBe("Underworld Grimoire");
    expect(
      presentInterestName("Underworld Grimoire skilling milestone ladder (UG1–4 densify)"),
    ).toBe("Underworld Grimoire");
    expect(presentInterestName("Varrock Lumber Yard sawmill operator")).toBe(
      "Varrock sawmill",
    );
    expect(presentInterestName("Ring of Vigour and passive conversion")).toBe("Ring of Vigour");
    expect(presentInterestName("Ring of Vigour passive")).toBe("RoV passive");
    expect(presentInterestName("Ring of Vigour")).toBe("Ring of Vigour");
    expect(presentInterestMeta("permanent adrenaline combat progression")).toBe("Adrenaline");
    expect(presentInterestName("Kerapac Magic progression")).toBe("Kerapac magic");
    expect(presentInterestName("Velucia museum Archaeology collections")).toBe(
      "Velucia collections",
    );
  });

  it("rewrites multi-skill category taxonomy into short meta", () => {
    expect(presentInterestMeta("regional multi-skill bank and production hub")).toBe(
      "Bank and production",
    );
    expect(
      presentInterestMeta("regional multi-skill transport and shop infrastructure"),
    ).toBe("Docks and shops");
    expect(presentInterestMeta("regional starter multi-skill infrastructure")).toBe(
      "Starter town",
    );
    expect(presentInterestMeta("Runecrafting geography")).toBe("Runecrafting");
    expect(presentInterestMeta("Runecrafting altar infrastructure")).toBe("Runecrafting");
    expect(presentInterestMeta("regional boss BiS drop source")).toBe("Boss uniques");
    expect(presentInterestMeta("achievement diary acquisition frame")).toBe("Diary rewards");
    expect(presentInterestMeta("Necromancy supply shops")).toBe("Necromancy shops");
    expect(presentInterestMeta("Necromancy ritual infrastructure")).toBe("Rituals");
    expect(presentInterestMeta("Prayer unlock infrastructure")).toBe("Prayer");
    expect(presentInterestMeta("Construction plank production infrastructure")).toBe(
      "Sawmill",
    );
    expect(presentInterestMeta("Magic ability codex gloves and scripture")).toBe(
      "Magic uniques",
    );
    expect(presentInterestMeta("combat Archaeology relic cross-region chain")).toBe(
      "Archaeology relic",
    );
    expect(presentInterestMeta("quest-challenge combat equipment")).toBe("Quest reward");
    expect(presentInterestMeta("style glove T90 upgrade hub")).toBe("T90 gloves");
    expect(presentInterestMeta("Necromancy crafted armour progression")).toBe("Necro armour");
  });
});

describe("contentRewardsFull — catalog boss packages", () => {
  it("Necromantic Rune Temple shows four runes and max XP/h", () => {
    const { row, upgrades } = contentRow("misthalin", "Necromantic Rune Temple");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Spirit rune/i);
    expect(full).toMatch(/Bone rune/i);
    expect(full).toMatch(/Flesh rune/i);
    expect(full).toMatch(/Miasma rune/i);
    expect(full).toMatch(/50k XP\/h/i);
    expect(full).not.toMatch(/Spirit altar \(spirit runes\)/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.map((i) => i.label.toLowerCase())).toEqual(
      expect.arrayContaining([
        "spirit rune",
        "bone rune",
        "flesh rune",
        "miasma rune",
      ]),
    );
    expect(presented.icons).toHaveLength(4);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Bloodweed & aggression potions shows pot stack icons", () => {
    const { row, upgrades } = contentRow("forinthry", "Bloodweed & aggression potions");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Clean bloodweed/i);
    expect(full).toMatch(/Searing ashes/i);
    expect(full).toMatch(/Aggression potion/i);
    expect(full).toMatch(/82 Herb/i);
    expect(full).toMatch(/17/i);
    expect(full).not.toMatch(/G\.A\.G\.|Demonic skull/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.map((i) => i.label.toLowerCase())).toEqual(
      expect.arrayContaining(["clean bloodweed", "searing ashes", "aggression potion"]),
    );
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presentInterestName(row.name)).toBe("Bloodweed / aggression pots");
  });

  it("Desert majors: Shifting Tombs, Magister split, KQ/KK rewards", () => {
    const cases: Array<{ name: string; must: RegExp[]; minIcons?: number }> = [
      {
        name: "Shifting Tombs",
        must: [/Menaphos reputation/i, /Feather of Ma'at/i],
        minIcons: 2,
      },
      {
        name: "The Magister",
        must: [/Gloves of passage/i, /Phylactery/i],
        minIcons: 2,
      },
      {
        name: "Corrupted creatures & soul devourers",
        must: [/Vital spark/i, /Key to the Crossing/i, /Corrupted gem/i],
        minIcons: 3,
      },
      {
        name: "Kalphite King",
        must: [/Drygore rapier/i, /Drygore mace/i, /Off-hand drygore/i],
        minIcons: 6,
      },
      {
        name: "Kalphite Queen",
        must: [/Dragon chainbody/i, /Kalphite queen head/i],
        minIcons: 2,
      },
      {
        name: "Het's Oasis",
        must: [/Powder of burials/i, /Powder of penance/i, /Powder of pulverising/i],
        minIcons: 5,
      },
      {
        name: "Desert strykewyrm",
        must: [/Focus sight/i],
        minIcons: 1,
      },
    ];
    for (const { name, must, minIcons } of cases) {
      const { row, upgrades } = contentRow("desert", name);
      const full = contentRewardsFull(row, upgrades);
      for (const re of must) expect(full, name).toMatch(re);
      const presented = presentContentRewards(full);
      if (minIcons) expect(presented.icons.length, name).toBeGreaterThanOrEqual(minIcons);
      expect(presented.icons.every((i) => publicOk(i.src)), name).toBe(true);
    }
    expect(presentInterestName("Corrupted creatures & soul devourers")).toBe(
      "Corrupted creatures",
    );
    // Het powders must not collapse to a single generic "Prayer powders" chip.
    const het = contentRow("desert", "Het's Oasis");
    const hetPresented = presentContentRewards(contentRewardsFull(het.row, het.upgrades));
    expect(hetPresented.icons.some((i) => /powder-of-burials/i.test(i.src))).toBe(true);
    expect(hetPresented.icons.some((i) => /powder-of-penance/i.test(i.src))).toBe(true);
  });

  it("Forinthry majors: Abyss, Chaotics, Corp shields, Dark facets", () => {
    const cases: Array<{ name: string; must: RegExp[]; minIcons?: number }> = [
      { name: "Abyss Runecrafting", must: [/Magical thread/i, /Multi-altar/i] },
      {
        name: "Chaotic weapons",
        must: [/Chaotic rapier/i, /Chaotic staff/i, /Chaotic maul/i],
        minIcons: 8,
      },
      {
        name: "Corporeal Beast",
        must: [/Spirit shield/i, /Holy elixir/i, /sigil/i],
        minIcons: 4,
      },
      {
        name: "Dark facets",
        must: [/Grace/i, /Luck/i, /Passage/i],
        minIcons: 3,
      },
      { name: "Ruinous weapons", must: [/Ruinous rapier/i, /Ruinous staff/i] },
    ];
    for (const { name, must, minIcons } of cases) {
      const { row, upgrades } = contentRow("forinthry", name);
      const full = contentRewardsFull(row, upgrades);
      for (const re of must) expect(full, name).toMatch(re);
      expect(full, name).not.toMatch(/working taxonomy|densify residual|WikiCombat/i);
      const presented = presentContentRewards(full);
      if (minIcons) expect(presented.icons.length, name).toBeGreaterThanOrEqual(minIcons);
      expect(presented.icons.every((i) => publicOk(i.src)), name).toBe(true);
    }
    // AI noise rows removed from majors/upgrades surface via content list.
    const for_ = contentRow("forinthry", "Corporeal Beast");
    expect(
      for_.upgrades.some((u) => /holy-elixir supply|Resource dungeon unlock map/i.test(u.name)),
    ).toBe(false);
  });

  it("Havenhythe bosses resolve unique drops with inventory icons", () => {
    const cases: Array<{ name: string; must: RegExp[] }> = [
      {
        name: "Ivar, King of Bones",
        must: [/Bonecrusher maul/i, /Magic skull mask/i, /Colossal bone/i],
      },
      {
        name: "Silverquill, the Dreadhog",
        must: [/Silver spines/i, /Sanguine spines/i],
      },
      {
        name: "Sanguine Crawler",
        must: [/Vampyrism gloves/i, /Tainted seed/i, /Sanguine matter/i],
      },
    ];
    for (const { name, must } of cases) {
      const { row, upgrades } = contentRow("havenhythe", name);
      const full = contentRewardsFull(row, upgrades);
      for (const re of must) expect(full).toMatch(re);
      expect(full).not.toMatch(/unique drop ladder|unique path/i);
      const presented = presentContentRewards(full);
      expect(presented.icons.length).toBeGreaterThanOrEqual(must.length);
      expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    }
  });

  it("Kerapac full text contains Fractured Staff of Armadyl", () => {
    const { row, upgrades } = contentRow("misthalin", "Kerapac, the bound");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Fractured Staff of Armadyl/i);
    expect(full).not.toMatch(/working league mapping|densify|residual/i);
  });

  it("TzKal-Zuk rewards show main uniques + igneous cape without +N", () => {
    const { row, upgrades } = contentRow("misthalin", "TzKal-Zuk");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Ek-ZekKil/i);
    expect(full).toMatch(/Magma Tempest/i);
    expect(full).toMatch(/Scripture of Ful/i);
    expect(full).toMatch(/Igneous Kal-Zuk/i);
    // Style stones not listed — listing all five caused +3 chip spam.
    expect(full).not.toMatch(/Igneous Kal-Ket|Igneous Kal-Mej|Igneous Kal-Xil|Igneous Kal-Mor/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBe(4);
    expect(presented.overflowResolved).toBe(0);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Fight Cave → fire cape; Fight Kiln → TokHaar-Kal", () => {
    const cave = contentRow("karamja", "TzHaar Fight Cave");
    const caveFull = contentRewardsFull(cave.row, cave.upgrades);
    expect(caveFull).toMatch(/Fire cape/i);
    const cavePresented = presentContentRewards(caveFull);
    expect(cavePresented.icons.some((i) => /fire-cape/i.test(i.src))).toBe(true);

    const kiln = contentRow("karamja", "Fight Kiln");
    const kilnFull = contentRewardsFull(kiln.row, kiln.upgrades);
    expect(kilnFull).toMatch(/TokHaar-Kal/i);
    const kilnPresented = presentContentRewards(kilnFull);
    expect(kilnPresented.icons.some((i) => /tokhaar-kal/i.test(i.src))).toBe(true);
    expect(kilnPresented.icons.length).toBeGreaterThanOrEqual(3);
    expect(kilnPresented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Bandos equipment prefers Unlocks piece list over Effects prose", () => {
    const { row, upgrades } = contentRow("asgarnia", "Bandos equipment");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Bandos helmet/i);
    expect(full).not.toMatch(/Classic T70/i);
    expect(full).not.toMatch(/densify|residual/i);
  });

  it("Raksha merges ability codices and boot upgrades", () => {
    const { row, upgrades } = contentRow("anachronia", "Raksha");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Greater Ricochet/i);
    expect(full).toMatch(/Fleeting boots|Laceration boots|Blast diffusion/i);
  });

  it("maps GWD generals and major bosses to clean unique packages", () => {
    const samples: { region: string; name: string | RegExp; re: RegExp }[] = [
      { region: "asgarnia", name: "General Graardor", re: /Bandos helmet|Bandos equipment/i },
      { region: "asgarnia", name: "Kree'arra", re: /Armadyl helmet|Armadyl/i },
      { region: "asgarnia", name: /K'ril/, re: /subjugation/i },
      { region: "asgarnia", name: "Nex", re: /Torva|Pernix|Virtus/i },
      { region: "asgarnia", name: "Vorago", re: /Seismic/i },
      { region: "asgarnia", name: "Queen Black Dragon", re: /Royal|Draconic visage/i },
      { region: "morytania", name: /Araxxor/, re: /Noxious/i },
      // Rot6 is upgrade-only in catalog (no content row) — covered by alias pack tests.
      { region: "desert", name: /Telos/, re: /Seren godbow|Staff of Sliske|Zaros godsword/i },
      { region: "desert", name: /Amascut/, re: /Devourer's Guard|Tumeken/i },
      { region: "desert", name: "Kalphite King", re: /Drygore/i },
      {
        region: "desert",
        name: /Heart of Gielinor/,
        re: /Dragon Rider lance|Cywir|Shadow glaive/i,
      },
      { region: "fremennik", name: "Dagannoth Kings", re: /Berserker ring|Dragon hatchet|Warrior ring|Archers/i },
      { region: "kandarin", name: "Legiones", re: /Ascension/i },
      { region: "tirannwn", name: "Solak", re: /Blightbound|Erethdor/i },
      { region: "forinthry", name: /Dragonkin Laboratory/, re: /Greater Fury|Draconic energy/i },
      { region: "forinthry", name: /Shadow Reef/, re: /Eldritch/i },
      { region: "forinthry", name: "Corporeal Beast", re: /spirit shield/i },
      { region: "misthalin", name: "Arch-Glacor", re: /Frozen core of Leng|Scripture of Wen/i },
      { region: "misthalin", name: "Croesus", re: /Cryptbloom|Scripture of Bik/i },
      { region: "misthalin", name: "TzKal-Zuk", re: /Igneous Kal|Ek-ZekKil|Scripture of Ful/i },
    ];
    for (const sample of samples) {
      const { row, upgrades } = contentRow(sample.region, sample.name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, `${sample.region}:${row.name}`).toMatch(sample.re);
      expect(full, `${row.name} residual`).not.toMatch(/working league mapping/i);
    }
  });

  it("Fort Forinthry stays text-only access (no wrong package)", () => {
    const { row, upgrades } = contentRow("misthalin", "Fort Forinthry");
    expect(contentRewardsFull(row, upgrades)).toMatch(/Fort buildings/i);
  });

  it("parent Sanctum and child bosses share the same unique list for filter", () => {
    const region = regionById("misthalin");
    const parent = region.content.find((c) => c.name === "Sanctum of Rebirth")!;
    const child = region.content.find((c) => c.name === "Vermyx, Brood Mother")!;
    expect(contentRewardsFull(parent, region.upgrades)).toBe(
      contentRewardsFull(child, region.upgrades),
    );
  });

  it("Tirannwn majors keep Solak (not collapsed under Lost Grove)", () => {
    const region = regionById("tirannwn");
    const majors = majorContentRows(region.content, region.upgrades);
    expect(majors.some((c) => c.name === "Solak")).toBe(true);
    expect(majors.some((c) => c.name === "The Lost Grove")).toBe(true);
    // Sanctum children still collapse on Misthalin.
    const misth = regionById("misthalin");
    const misthMajors = majorContentRows(misth.content, misth.upgrades);
    expect(misthMajors.some((c) => c.name === "Sanctum of Rebirth")).toBe(true);
    expect(misthMajors.some((c) => c.name === "Vermyx, Brood Mother")).toBe(false);
  });
});
