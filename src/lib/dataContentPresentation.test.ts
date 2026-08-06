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
import { dataEntityIconPath } from "./gameArt";
import { REWARD_ICON_BY_LABEL, resolveRewardIconLabel } from "./rewardIconAliases";
import { contentDetailOrRewards, contentRewardsFull, majorContentRows } from "./researchRewards";
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
    expect(
      icons.some((i) =>
        /fractured-staff|greater-concentrated|wrist-wrap|scripture-of-jas/i.test(i.src),
      ),
    ).toBe(true);
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
    expect(resolveRewardIcon("Mining")).toBeNull();
    expect(resolveRewardIcon("Random scenery hub")).toBeNull();
    expect(resolveRewardIcon("Menaphos")).toBeNull();
    expect(resolveRewardIcon("Liberation of Mazcab")).toBeNull();
    expect(resolveRewardIcon("Het's Oasis")).toBeNull();
    const soul = resolveRewardIcon("Soul altar");
    if (soul) expect(soul).not.toMatch(/\/soul-altar\.(webp|png)$/);
    expect(resolveRewardIcon("Menaphos reputation")).toMatch(/menaphos-reputation\.(webp|png)$/);
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
      full: "Fractured Staff of Armadyl components, Greater Concentrated Blast, Kerapac's wrist wraps, Scripture of Jas",
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
      full: "Roar of Awakening, Ode to Deceit, Divine Rage prayer codex, Scripture of Amascut, Shard of Genesis Essence",
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
      full: "Dragon Rider lance, Wand of the Cywir elders, Shadow glaives, Blade of Avaryss, Blade of Nymora",
      minResolved: 5,
      srcRe: /dragon-rider-lance|cywir|shadow-glaive|blade-of-avaryss|blade-of-nymora/,
    },
    {
      name: "Commander Zilyana",
      full: "Saradomin sword, Saradomin godsword, Armadyl crossbow, Off-hand Armadyl crossbow",
      minResolved: 4,
      srcRe: /saradomin-sword|saradomin-godsword|armadyl-crossbow/,
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
      full: "Dragon mattock, Terrasaur maul, Double Surge, Double Escape, Anachronia totems",
      minResolved: 5,
      srcRe: /dragon-mattock|terrasaur|surge|escape|anachronia-totem/,
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

  it("resolves high-profile boss unique packs (rate, files, overflow)", () => {
    expect(samples.length).toBeGreaterThanOrEqual(15);
    for (const sample of samples) {
      const presented = presentContentRewards(sample.full);
      const all = contentRewardIcons(presented.tokens, 99);
      expect(all.length, `${sample.name} resolved`).toBeGreaterThanOrEqual(sample.minResolved);
      expect(
        all.every((i) => publicOk(i.src)),
        sample.name,
      ).toBe(true);
      expect(
        all.some((i) => sample.srcRe.test(i.src)),
        sample.name,
      ).toBe(true);
      expect(
        all.every((i) => !i.src.includes("/game/bosses/")),
        sample.name,
      ).toBe(true);
      expect(presented.icons.length, sample.name).toBeLessThanOrEqual(REWARD_ICON_CAP);
      expect(presented.overflowResolved, sample.name).toBe(
        Math.max(0, all.length - presented.icons.length),
      );
      if (all.length <= REWARD_ICON_CAP) {
        expect(presented.overflowResolved, sample.name).toBe(0);
      }
    }
  });

  it("does not show +N when tokens fail to resolve (user complaint)", () => {
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
      // Inventory preferred; boss plates allowed for creature tokens (e.g. Muspah).
      expect(
        src.startsWith("/game/upgrades/") ||
          src.startsWith("/game/combat/") ||
          src.startsWith("/game/bosses/"),
        `unexpected root ${key} → ${src}`,
      ).toBe(true);
      const resolved = resolveRewardIcon(key);
      expect(resolved, `resolveRewardIcon failed for alias "${key}"`).toBe(src);
    }
  });

  it("resolveRewardIconLabel is case-insensitive on trim", () => {
    expect(resolveRewardIconLabel("  Omni Guard  ")).toMatch(/omni-guard\.(webp|png)$/);
    expect(resolveRewardIconLabel("unknown unique xyz")).toBeNull();
  });

  it("resolveRewardIconLabel is apostrophe-insensitive both ways", () => {
    expect(resolveRewardIconLabel("Kerapac's wrist wraps")).toMatch(
      /kerapacs-wrist-wraps\.(webp|png)$/,
    );
    expect(resolveRewardIconLabel("Kerapacs wrist wraps")).toMatch(
      /kerapacs-wrist-wraps\.(webp|png)$/,
    );
    expect(resolveRewardIconLabel("Tumeken’s Light")).toMatch(/tumekens-light\.(webp|png)$/); // curly ’
    expect(resolveRewardIconLabel("Sana's fyrtorch")).toMatch(/sanas-fyrtorch\.(webp|png)$/);
    expect(resolveRewardIconLabel("Sanas fyrtorch")).toMatch(/sanas-fyrtorch\.(webp|png)$/);
  });

  it("resolves anachronia / corp / lunar access tokens", () => {
    expect(resolveRewardIcon("Double Surge")).toMatch(
      /abilities\/movement\/surge\.(webp|png)$|ability-codices\/double-surge\.(webp|png)$/,
    );
    expect(resolveRewardIcon("Dragon mattock")).toMatch(/dragon-mattock\.(webp|png)$/);
    expect(resolveRewardIcon("Spirit shield")).toMatch(/spirit-shield\.(webp|png)$/);
    expect(resolveRewardIcon("Lunar spellbook")).toMatch(/lunar-spellbook\.(webp|png)$/);
    expect(resolveRewardIcon("Pale energy")).toMatch(/pale-energy\.(webp|png)$/);
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
    expect(contentTypeLabel("Divination", "Misthalin wisp colonies")).toBe("Divination");
  });
});

describe("presentInterestName / presentInterestMeta", () => {
  it("drops planner hub suffixes from place names", () => {
    expect(presentInterestName("Draynor Village skilling hub")).toBe("Draynor Village");
    expect(presentInterestName("Edgeville skilling and Wilderness on-ramp hub")).toBe("Edgeville");
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
      presentInterestName("Misthalin Runecrafting altars (Water, Earth) and essence access"),
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
    expect(presentInterestName("City of Um ritual site and focus storage")).toBe("Um ritual site");
    expect(presentInterestName("Selene Necromancy prayer and curse unlocks (City of Um)")).toBe(
      "Selene prayers",
    );
    expect(presentInterestName("Underworld Grimoire 1-4")).toBe("Underworld Grimoire");
    expect(
      presentInterestName("Underworld Grimoire skilling milestone ladder (UG1–4 densify)"),
    ).toBe("Underworld Grimoire");
    expect(presentInterestName("Varrock Lumber Yard sawmill operator")).toBe("Varrock sawmill");
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
    expect(presentInterestMeta("regional multi-skill transport and shop infrastructure")).toBe(
      "Docks and shops",
    );
    expect(presentInterestMeta("regional starter multi-skill infrastructure")).toBe("Starter town");
    expect(presentInterestMeta("Runecrafting geography")).toBe("Runecrafting");
    expect(presentInterestMeta("Runecrafting altar infrastructure")).toBe("Runecrafting");
    expect(presentInterestMeta("regional boss BiS drop source")).toBe("Boss uniques");
    expect(presentInterestMeta("achievement diary acquisition frame")).toBe("Diary rewards");
    expect(presentInterestMeta("Necromancy supply shops")).toBe("Necromancy shops");
    expect(presentInterestMeta("Necromancy ritual infrastructure")).toBe("Rituals");
    expect(presentInterestMeta("Prayer unlock infrastructure")).toBe("Prayer");
    expect(presentInterestMeta("Construction plank production infrastructure")).toBe("Sawmill");
    expect(presentInterestMeta("Magic ability codex gloves and scripture")).toBe("Magic uniques");
    expect(presentInterestMeta("combat Archaeology relic cross-region chain")).toBe(
      "Archaeology relic",
    );
    expect(presentInterestMeta("quest-challenge combat equipment")).toBe("Quest reward");
    expect(presentInterestMeta("style glove T90 upgrade hub")).toBe("T90 gloves");
    expect(presentInterestMeta("Necromancy crafted armour progression")).toBe("Necro armour");
  });
});

describe("contentRewardsFull — catalog boss packages", () => {
  it("GWD2 Heart bosses resolve per-general weapon chips", () => {
    const cases: Array<{ name: string | RegExp; re: RegExp; minIcons: number }> = [
      { name: /Vindicta/, re: /Dragon Rider lance/i, minIcons: 1 },
      { name: "Helwyr", re: /Cywir/i, minIcons: 2 },
      { name: "Twin Furies", re: /Blade of Avaryss|Blade of Nymora/i, minIcons: 2 },
      { name: "Gregorovic", re: /Shadow glaive/i, minIcons: 1 },
      { name: /Telos/, re: /Seren godbow|Staff of Sliske|Zaros godsword/i, minIcons: 3 },
    ];
    for (const { name, re, minIcons } of cases) {
      const { row, upgrades } = contentRow("desert", name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, String(name)).toMatch(re);
      const presented = presentContentRewards(full);
      expect(presented.icons.length, String(name)).toBeGreaterThanOrEqual(minIcons);
      expect(
        presented.icons.every((i) => publicOk(i.src)),
        String(name),
      ).toBe(true);
    }
  });

  it("Commander Zilyana resolves Saradomin / ACB uniques (not bare Godswords package)", () => {
    const { row, upgrades } = contentRow("asgarnia", "Commander Zilyana");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Saradomin sword/i);
    expect(full).toMatch(/Armadyl crossbow/i);
    expect(full).not.toMatch(/^Godswords$/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(3);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.some((i) => /saradomin-sword/i.test(i.src))).toBe(true);
  });

  it("Queen Black Dragon uses Dragon kiteshield, not Kalphite Queen drops", () => {
    const { row, upgrades } = contentRow("asgarnia", "Queen Black Dragon");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toBe("Dragon kiteshield");
    expect(full).not.toMatch(/Dragon chainbody|Dragon 2h sword/i);
    expect(resolveRewardIcon("Dragon kiteshield")).toMatch(/dragon-kiteshield\.webp$/);
    expect(publicOk(resolveRewardIcon("Dragon kiteshield"))).toBe(true);
  });

  it("Empty Throne Room is dark animica (not light) with auto-cycle chips", () => {
    const { row, upgrades } = contentRow("misthalin", /Empty Throne Room/);
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Dark animica/i);
    expect(full).toMatch(/Auto-cycle/i);
    expect(full).not.toMatch(/Light animica/i);
    const p = presentContentRewards(full);
    expect(p.icons.some((i) => /dark-animica/i.test(i.src))).toBe(true);
    expect(p.icons.some((i) => /manual-auto-cycle|auto-cycle/i.test(i.src))).toBe(true);
    expect(p.icons.every((i) => publicOk(i.src))).toBe(true);
  });

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
      expect.arrayContaining(["spirit rune", "bone rune", "flesh rune", "miasma rune"]),
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
    expect(full).not.toMatch(/G\.A\.G\.|Demonic skull/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.map((i) => i.label.toLowerCase())).toEqual(
      expect.arrayContaining(["clean bloodweed", "searing ashes", "aggression potion"]),
    );
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presentInterestName(row.name)).toBe("Bloodweed / aggression pots");
  });

  it("Darkmeyer Thieving (Morytania potion stall) potion chips all publicOk", () => {
    const { row, upgrades } = contentRow("morytania", "Darkmeyer Thieving");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Extreme attack/i);
    expect(full).toMatch(/Spirit attraction potion/i);
    expect(full).toMatch(/Weapon poison\+\+\+/i);
    expect(full).toMatch(/Potion flask/i);
    const presented = presentContentRewards(full, 14);
    expect(presented.icons.length).toBe(14);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    // Stall loot inventory art lives under skilling-production (not scenery stalls plate).
    expect(
      presented.icons
        .filter((i) => i.label !== "Ring of Vitur")
        .every((i) => /\/skilling-production\//.test(i.src)),
    ).toBe(true);
    expect(resolveRewardIcon("Extreme attack (1)")).toMatch(/extreme-attack\.(webp|png)$/);
    expect(resolveRewardIcon("Weapon poison+++ (1)")).toMatch(
      /weapon-poison-plus-plus-plus\.(webp|png)$/,
    );
    expect(publicOk(resolveRewardIcon("Potion flask"))).toBe(true);
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
      {
        name: "Pyramid Plunder",
        must: [/Black ibis/i, /Sceptre of the gods/i, /Pharaoh/i],
        minIcons: 3,
      },
      {
        name: "Mazcab Emergency Merchants",
        must: [/Super restore/i, /Super attack/i, /Cooked eeligator/i],
        minIcons: 5,
      },
      {
        name: "Kharid-et Dig Site",
        must: [/Pontifex/i, /Tetracompass/i, /Inquisitor/i],
        minIcons: 3,
      },
      {
        name: "Pontifex observation ring",
        must: [/Pontifex/i],
        minIcons: 1,
      },
    ];
    for (const { name, must, minIcons } of cases) {
      const { row, upgrades } = contentRow("desert", name);
      const full = contentRewardsFull(row, upgrades);
      for (const re of must) expect(full, name).toMatch(re);
      const presented = presentContentRewards(full);
      if (minIcons) expect(presented.icons.length, name).toBeGreaterThanOrEqual(minIcons);
      expect(
        presented.icons.every((i) => publicOk(i.src)),
        name,
      ).toBe(true);
    }
    expect(presentInterestName("Corrupted creatures & soul devourers")).toBe("Corrupted creatures");
    const desert = regionById("desert");
    expect(desert.content.some((c) => /Heart of Gielinor \/ God Wars/i.test(c.name))).toBe(false);
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
        must: [/Grace of the Elves|GOTE/i, /Dark Facet of Grace/i, /Luck/i, /Passage/i],
        minIcons: 4,
      },
      { name: "Ruinous weapons", must: [/Ruinous rapier/i, /Ruinous staff/i] },
      {
        name: "Revenants",
        must: [/Statius/i, /Vesta/i, /Morrigan/i, /Zuriel/i],
        minIcons: 4,
      },
      {
        name: "Ripper Demons",
        must: [/Ripper claw/i, /Off-hand ripper claw/i],
        minIcons: 2,
      },
      { name: "Abyssal beasts", must: [/Jaws of the Abyss/i], minIcons: 1 },
      { name: "Abyssal lords", must: [/Abyssal scourge/i], minIcons: 1 },
      {
        name: "Glacors",
        must: [/Steadfast/i, /Ragefire/i, /Glaiven/i],
        minIcons: 3,
      },
      { name: "Ice strykewyrms", must: [/Staff of light/i], minIcons: 1 },
      {
        name: "Acheron mammoths",
        must: [/Mammoth tusk/i],
        minIcons: 1,
      },
    ];
    for (const { name, must, minIcons } of cases) {
      const { row, upgrades } = contentRow("forinthry", name);
      const full = contentRewardsFull(row, upgrades);
      for (const re of must) expect(full, name).toMatch(re);
      expect(full, name).not.toMatch(/working taxonomy|densify residual|WikiCombat/i);
      const presented = presentContentRewards(full);
      if (minIcons) expect(presented.icons.length, name).toBeGreaterThanOrEqual(minIcons);
      expect(
        presented.icons.every((i) => publicOk(i.src)),
        name,
      ).toBe(true);
    }
    const for_ = contentRow("forinthry", "Corporeal Beast");
    expect(
      for_.upgrades.some((u) => /holy-elixir supply|Resource dungeon unlock map/i.test(u.name)),
    ).toBe(false);
    const region = regionById("forinthry");
    expect(
      region.content.some((c) =>
        /Edgeville Dungeon combat|Edgeville resource dungeons/.test(c.name),
      ),
    ).toBe(false);
    expect(region.upgrades.find((u) => u.name === "Edgeville resource dungeons")?.detail).toMatch(
      /grimy ranarr.*limpwurt roots/i,
    );
    expect(region.content.some((c) => c.name === "Forinthry Dungeon")).toBe(false);
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

  it("Havenhythe Big Game Hunter lists apex hide set with inventory icons", () => {
    const full = contentRewardsFull({ name: "Havenhythe Big Game Hunter" }, []);
    expect(full).toMatch(/Apex hide cowl/i);
    expect(full).toMatch(/Apex hide body/i);
    expect(full).toMatch(/Apex hide chaps/i);
    expect(full).toMatch(/Apex hide vambraces/i);
    expect(full).toMatch(/Apex hide boots/i);
    expect(full).not.toMatch(/Best Hunter XP route, new BGH/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBe(5);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.every((i) => /apex-hide-/i.test(i.src))).toBe(true);
    expect(presented.icons.map((i) => i.src)).toEqual([
      "/game/combat/equipment/apex-hide-cowl.webp",
      "/game/combat/equipment/apex-hide-body.webp",
      "/game/combat/equipment/apex-hide-chaps.webp",
      "/game/combat/equipment/apex-hide-vambraces.webp",
      "/game/combat/equipment/apex-hide-boots.webp",
    ]);
    expect(dataEntityIconPath({ name: "Havenhythe Big Game Hunter" })).toMatch(
      /apex-hide-body\.(webp|png)$/,
    );
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
    expect(full).not.toMatch(/Igneous Kal-Ket|Igneous Kal-Mej|Igneous Kal-Xil|Igneous Kal-Mor/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBe(4);
    expect(presented.overflowResolved).toBe(0);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Zamorak LoC is Misthalin and shows Vestments, Bolg, Chaos Roar, and Lost Knowledge codices", () => {
    expect(() => contentRow("forinthry", "Zamorak, Lord of Chaos")).toThrow();
    const { row, upgrades } = contentRow("misthalin", "Zamorak, Lord of Chaos");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Vestments of havoc/i);
    expect(full).toMatch(/Bow of the Last Guardian/i);
    expect(full).toMatch(/Chaos Roar/i);
    expect(full).toMatch(/Greater Sunshine/i);
    expect(full).toMatch(/Greater Death'?s Swiftness/i);
    expect(full).not.toMatch(/Chaos witch/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBe(5);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    const labels = presented.icons.map((i) => i.label.toLowerCase());
    expect(labels).toEqual(
      expect.arrayContaining([
        "vestments of havoc",
        "bow of the last guardian",
        "chaos roar",
        "greater sunshine",
      ]),
    );
  });

  it("Soulgazers own Hexhunter; Shadow Reef does not", () => {
    const reef = contentRow("forinthry", /Shadow Reef/);
    const reefFull = contentRewardsFull(reef.row, reef.upgrades);
    expect(reefFull).toMatch(/Eldritch/i);
    expect(reefFull).not.toMatch(/Hexhunter/i);
    const soul = contentRow("forinthry", "Soulgazers");
    const soulFull = contentRewardsFull(soul.row, soul.upgrades);
    expect(soulFull).toMatch(/Hexhunter/i);
    expect(presentContentRewards(soulFull).icons.some((i) => /hexhunter/i.test(i.src))).toBe(true);
  });

  it("Bloodwoods, Agility, and Wildy Slayer chip dark onyx core", () => {
    for (const name of [
      "Wilderness bloodwood trees",
      "Wilderness Agility Course",
      "Wilderness Slayer",
    ]) {
      const { row, upgrades } = contentRow("forinthry", name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, name).toMatch(/Dark onyx core/i);
      const presented = presentContentRewards(full);
      expect(
        presented.icons.some((i) => /dark-onyx-core|onyx/i.test(i.src)),
        name,
      ).toBe(true);
    }
  });

  it("Wilderness herb patch is not a duplicate pot stack of Bloodweed majors", () => {
    const pot = contentRow("forinthry", "Bloodweed & aggression potions");
    const patch = contentRow("forinthry", "Wilderness herb patch");
    const potFull = contentRewardsFull(pot.row, pot.upgrades);
    const patchFull = contentRewardsFull(patch.row, patch.upgrades);
    expect(potFull).toMatch(/Aggression potion/i);
    expect(patchFull).toMatch(/Dark onyx core|Bloodweed seed/i);
    expect(patchFull).not.toMatch(/Aggression potion/i);
  });

  it("Infernal Source shows Ancient Summoning, contracts, tetras, and relics", () => {
    const cases: Array<{ region: string; name: string | RegExp }> = [
      { region: "forinthry", name: /Infernal Source Dig Site/ },
    ];
    expect(
      regionById("misthalin").content.some((row) => row.name === "Infernal Source Dig Site"),
    ).toBe(false);
    for (const { region, name } of cases) {
      const { row, upgrades } = contentRow(region, name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, row.name).toMatch(/Ancient Summoning/i);
      expect(full, row.name).toMatch(/Binding contract/i);
      expect(full, row.name).toMatch(/Tetracompass/i);
      expect(full, row.name).toMatch(/Inspire Love/i);
      expect(full, row.name).toMatch(/Slayer Introspection/i);
      expect(full, row.name).not.toMatch(/Hotspots/i);
      const presented = presentContentRewards(full);
      expect(presented.icons.length, row.name).toBe(5);
      expect(
        presented.icons.every((i) => publicOk(i.src)),
        row.name,
      ).toBe(true);
    }
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

  it("Graardor owns Bandos piece list (Bandos equipment content row merged away)", () => {
    const { row, upgrades } = contentRow("asgarnia", "General Graardor");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Bandos helmet/i);
    expect(full).not.toMatch(/Classic T70/i);
    expect(full).not.toMatch(/densify|residual/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(5);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    const asg = regionById("asgarnia");
    expect(asg.content.some((c) => c.name === "Bandos equipment")).toBe(false);
  });

  it("Anachronia majors: BGH, Orthen, Ranch, Rex rings, promoted unlocks", () => {
    const ana = regionById("anachronia");
    expect(ana.content.some((c) => /codex lectern/i.test(c.name))).toBe(false);
    expect(ana.content.some((c) => c.name === "Dream of Iaia")).toBe(true);
    expect(ana.content.some((c) => c.name === "Herby Werby")).toBe(true);
    expect(ana.content.some((c) => c.name === "Skillcape rack")).toBe(true);
    expect(ana.content.some((c) => c.name === "Volcanic trapper outfit")).toBe(true);
    expect(
      ana.upgrades.some((u) =>
        /building-by-building|structure tier|poison frog|Farmers' Market \(beans\)|elder animal|gathered produce|Fury shark|furnace core full|Superheat Form \+ smithing/i.test(
          u.name,
        ),
      ),
    ).toBe(false);

    const cases: Array<{ name: string | RegExp; min: number; re: RegExp }> = [
      {
        name: "Anachronia Agility Course",
        min: 2,
        re: /Double Surge|Double Escape/i,
      },
      {
        name: "Anachronia Big Game Hunter",
        min: 3,
        re: /Dragon mattock|Terrasaur maul|Quick traps/i,
      },
      {
        name: "Orthen Dig Site",
        min: 4,
        re: /Orthen furnace core|Flow State|Death Note|Mysterious City/i,
      },
      {
        name: /Ranch Out of Time/,
        min: 3,
        re: /King of Beasts|No Fear|Armoured Hide/i,
      },
      {
        name: /Rex Matriarchs/,
        min: 4,
        re: /Champion|Reaver|Stalker|Channeller|Occultist|Skeka/i,
      },
      { name: "Raksha", min: 7, re: /Blast diffusion|Laceration|Fleeting/i },
      { name: /Laniakea \(Anachronia/, min: 1, re: /Laniakea's spear/i },
      { name: "Volcanic trapper outfit", min: 1, re: /Volcanic trapper/i },
      { name: "Dream of Iaia", min: 1, re: /Dream of Iaia/i },
      { name: "Skillcape rack", min: 1, re: /Skillcape rack/i },
    ];
    for (const c of cases) {
      const { row, upgrades } = contentRow("anachronia", c.name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, row.name).toMatch(c.re);
      expect(full, row.name).not.toMatch(/\bpath\b/i);
      const p = presentContentRewards(full);
      expect(p.icons.length, row.name).toBeGreaterThanOrEqual(c.min);
      expect(
        p.icons.every((i) => publicOk(i.src)),
        row.name,
      ).toBe(true);
    }
  });

  it("Kandarin Manor Farm, dig-site relics, Freneskae portal, Wizards Guild; Yanille hub gone", () => {
    const kan = regionById("kandarin");
    expect(kan.content.some((c) => /yanille multi/i.test(c.name))).toBe(false);
    expect(kan.content.some((c) => /Wizards' Guild/i.test(c.name))).toBe(true);
    expect(kan.content.some((c) => c.name === "Manor Farm")).toBe(true);
    expect(
      kan.content.some((c) => /Freneskae|Nightmare creatures|Muspah|Rune dragons/i.test(c.name)),
    ).toBe(true);

    const pof = contentRow("kandarin", "Manor Farm");
    const pofP = presentContentRewards(contentRewardsFull(pof.row, pof.upgrades));
    expect(pofP.icons.length).toBeGreaterThanOrEqual(3);
    expect(pofP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(pofP.icons.some((i) => /master-farmer|beans|nopenopenope/i.test(i.src))).toBe(true);

    const war = contentRow("kandarin", /Warforge Dig Site/);
    const warP = presentContentRewards(contentRewardsFull(war.row, war.upgrades));
    expect(warP.icons.some((i) => /imcando-mattock/i.test(i.src))).toBe(true);
    expect(warP.icons.some((i) => /inspire-awe/i.test(i.src))).toBe(true);

    const thalmund = contentRow("kandarin", "Thalmund's Forge");
    expect(thalmund.row.name).toBe("Thalmund's Forge");
    const thalmundFull = contentRewardsFull(thalmund.row, thalmund.upgrades);
    expect(thalmundFull).toMatch(/Burial armour \(Artisans' Workshop alternative\)/i);
    expect(thalmundFull).toMatch(/Burial anvil/i);
    expect(thalmundFull).toMatch(/Burial forge/i);
    const thalmundP = presentContentRewards(thalmundFull);
    expect(thalmundP.icons.length).toBeGreaterThanOrEqual(3);
    expect(thalmundP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(thalmundP.icons.some((i) => /burial-armour/i.test(i.src))).toBe(true);
    expect(thalmundP.icons.some((i) => /burial-anvil/i.test(i.src))).toBe(true);
    expect(thalmundP.icons.some((i) => /burial-forge/i.test(i.src))).toBe(true);

    const storm = contentRow("kandarin", /Stormguard/);
    const stormP = presentContentRewards(contentRewardsFull(storm.row, storm.upgrades));
    expect(stormP.icons.some((i) => /inspire-genius/i.test(i.src))).toBe(true);
    expect(stormP.icons.some((i) => /ancient-invention/i.test(i.src))).toBe(true);

    const fren = contentRow("kandarin", /Freneskae via World Gate/);
    const frenP = presentContentRewards(contentRewardsFull(fren.row, fren.upgrades));
    expect(frenP.icons.length).toBeGreaterThanOrEqual(3);
    expect(frenP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(frenP.icons.some((i) => /\/bosses\/muspah\.(webp|png)$/i.test(i.src))).toBe(true);
    expect(frenP.icons.some((i) => /nightmare-gauntlets/i.test(i.src))).toBe(true);
    expect(frenP.icons.some((i) => /rune-dragon/i.test(i.src))).toBe(true);

    const muspahRow = contentRow("kandarin", /^Muspah$/);
    expect(dataEntityIconPath({ name: muspahRow.row.name, kind: muspahRow.row.kind })).toBe(
      "/game/bosses/muspah.webp",
    );
    const muspahFull = contentRewardsFull(muspahRow.row, muspahRow.upgrades);
    expect(muspahFull).toMatch(/Muspah spine/i);
    expect(muspahFull).toMatch(/Dragon ward/i);
    expect(muspahFull).toMatch(/Dragon knives/i);
    const muspahP = presentContentRewards(muspahFull);
    expect(muspahP.icons.length).toBeGreaterThanOrEqual(3);
    expect(muspahP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(
      muspahP.icons.some((i) => i.label === "Muspah spine" && /muspah-spine/i.test(i.src)),
    ).toBe(true);
    expect(muspahP.icons.some((i) => i.label === "Dragon ward" && /dragon-ward/i.test(i.src))).toBe(
      true,
    );
    expect(
      muspahP.icons.some((i) => i.label === "Dragon knives" && /dragon-knife/i.test(i.src)),
    ).toBe(true);

    const kd = contentRow("kandarin", "Kuradal");
    const kdP = presentContentRewards(contentRewardsFull(kd.row, kd.upgrades));
    expect(kdP.icons.some((i) => /ferocious-ring/i.test(i.src))).toBe(true);

    const em = contentRow("kandarin", "Eternal magic trees");
    const emFull = contentRewardsFull(em.row, em.upgrades);
    expect(emFull).toMatch(/Eternal magic logs/i);
    expect(emFull).toMatch(/Eternal magic planks/i);
    expect(emFull).toMatch(/3x faster XP\/h than mahogany/i);
    const emP = presentContentRewards(emFull);
    expect(emP.icons.some((i) => /eternal-magic-logs/i.test(i.src))).toBe(true);
    expect(emP.icons.some((i) => /plank\.(webp|png)$/i.test(i.src))).toBe(true);
    expect(emP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(dataEntityIconPath({ name: em.row.name, kind: em.row.kind })).toMatch(
      /eternal-magic-(trees|logs)\.(webp|png)$/,
    );

    const ba = contentRow("kandarin", "Barbarian Assault");
    const baFull = contentRewardsFull(ba.row, ba.upgrades);
    expect(baFull).toMatch(/Fighter torso/i);
    expect(baFull).toMatch(/Penance trident/i);
    expect(baFull).toMatch(/Attacker's insignia/i);
    expect(baFull).not.toMatch(/agile top/i);
    const baP = presentContentRewards(baFull);
    expect(baP.icons.some((i) => /fighter-torso/i.test(i.src))).toBe(true);
    expect(baP.icons.some((i) => /penance-trident/i.test(i.src))).toBe(true);
    expect(baP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(dataEntityIconPath({ name: ba.row.name, kind: ba.row.kind })).toMatch(
      /barbarian-assault\.(webp|png)$/,
    );
  });

  it("Asgarnia hubs: Port Sarim Arc, Warriors defender, safecracking", () => {
    const port = contentRow("asgarnia", "Port Sarim docks and skilling hub");
    const portFull = contentRewardsFull(port.row, port.upgrades);
    expect(portFull).not.toMatch(/Player-owned port/i);
    expect(portFull).toMatch(/The Arc/i);
    const portP = presentContentRewards(portFull);
    expect(portP.icons.length).toBeGreaterThanOrEqual(1);
    expect(portP.icons.every((i) => publicOk(i.src))).toBe(true);
    // the-arc.webp is Archaeology skill art; reward chip uses Arc map inventory.
    expect(
      portP.icons.some((i) => i.label === "The Arc" && /uncharted-island-map/i.test(i.src)),
    ).toBe(true);
    expect(portP.icons.every((i) => !/the-arc\.webp$/i.test(i.src))).toBe(true);

    const arc = contentRow("asgarnia", "The Arc");
    const arcFull = contentRewardsFull(arc.row, arc.upgrades);
    expect(arcFull).toMatch(/Waiko contracts/i);
    expect(arcFull).toMatch(/chimes|chime shop/i);
    expect(arcFull).toMatch(/uncharted isles/i);
    const arcP = presentContentRewards(arcFull);
    expect(arcP.icons.length).toBeGreaterThanOrEqual(3);
    expect(arcP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(arcP.icons.some((i) => /waiko-contracts/i.test(i.src))).toBe(true);
    expect(arcP.icons.some((i) => /chimes/i.test(i.src))).toBe(true);
    expect(arcP.icons.some((i) => /uncharted-island-map/i.test(i.src))).toBe(true);

    const aod = contentRow("asgarnia", "Nex: Angel of Death");
    const aodFull = contentRewardsFull(aod.row, aod.upgrades);
    expect(aodFull).toMatch(/Wand of the praesul/i);
    expect(aodFull).toMatch(/Imperium core/i);
    expect(aodFull).toMatch(/Praesul codex/i);
    const aodP = presentContentRewards(aodFull);
    expect(aodP.icons.length).toBeGreaterThanOrEqual(3);
    expect(aodP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(aodP.icons.some((i) => /praesul|wand/i.test(i.src))).toBe(true);
    expect(aodP.icons.some((i) => /imperium/i.test(i.src))).toBe(true);

    const wg = contentRow("asgarnia", "Warriors' Guild");
    const wgFull = contentRewardsFull(wg.row, wg.upgrades);
    expect(wgFull).toMatch(/Dragon defender/i);
    const wgP = presentContentRewards(wgFull);
    expect(wgP.icons.some((i) => /dragon-defender/i.test(i.src))).toBe(true);

    const safe = contentRow("asgarnia", /^Safes$|Safecracking route/);
    expect(presentInterestName(safe.row.name)).toBe("Safes");
    const safeFull = contentRewardsFull(safe.row, safe.upgrades);
    expect(safeFull).toMatch(/Falador/i);
    expect(safeFull).toMatch(/Port Sarim/i);
    expect(safeFull).toMatch(/Burthorpe/i);
    const safeP = presentContentRewards(safeFull);
    expect(safeP.icons.some((i) => /safe\.(webp|png)$/i.test(i.src))).toBe(true);
  });

  it("K'ril Tsutsaroth presents full subjugation piece icons", () => {
    const { row, upgrades } = contentRow("asgarnia", /K'ril/);
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Hood of subjugation/i);
    expect(full).toMatch(/Boots of subjugation/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(5);
    expect(presented.icons.every((i) => /subjugation/i.test(i.src))).toBe(true);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    for (const piece of ["hood", "garb", "gown", "gloves", "boots"]) {
      expect(
        presented.icons.some((i) => i.src.includes(`${piece}-of-subjugation`)),
        piece,
      ).toBe(true);
    }
  });

  it("Meilyr Recipe Shop lists named combination potions with distinct icons", () => {
    const { row, upgrades } = contentRow("tirannwn", "Meilyr Recipe Shop");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Supreme overload/i);
    expect(full).toMatch(/Elder overload/i);
    expect(full).toMatch(/Elder overload salve/i);
    expect(full).toMatch(/Holy overload/i);
    expect(full).toMatch(/Spiritual prayer/i);
    expect(full).toMatch(/Combination potions/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(5);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    const srcs = presented.icons.map((i) => i.src);
    expect(srcs.some((s) => /supreme-overload/i.test(s))).toBe(true);
    expect(
      srcs.some((s) => /elder-overload(?!-salve)/i.test(s) || /\/elder-overload\.webp$/i.test(s)),
    ).toBe(true);
    expect(srcs.some((s) => /elder-overload-salve/i.test(s))).toBe(true);
    expect(srcs.some((s) => /holy-overload/i.test(s))).toBe(true);
    expect(srcs.some((s) => /spiritual-prayer/i.test(s))).toBe(true);
    expect(srcs.some((s) => /combination-potions/i.test(s))).toBe(true);
  });

  it("expands low-icon majors: Mole, QBD, Legiones, ED2, ED3, Achto, Barrows", () => {
    const cases: Array<{ region: string; name: string | RegExp; min: number; re: RegExp }> = [
      { region: "asgarnia", name: "Giant Mole", min: 1, re: /Dragon 2h/i },
      { region: "asgarnia", name: "Queen Black Dragon", min: 1, re: /Dragon kiteshield/i },
      { region: "kandarin", name: "Legiones", min: 3, re: /Ascension/i },
      {
        region: "forinthry",
        name: /Dragonkin Laboratory/,
        min: 4,
        re: /Greater Fury|Greater Flurry|Greater Barge|Draconic energy|Tectonic energy/i,
      },
      { region: "forinthry", name: /Shadow Reef/, min: 2, re: /Eldritch|Black stone/i },
      { region: "desert", name: "Beastmaster Durzag", min: 3, re: /Achto/i },
      { region: "desert", name: "Yakamaru", min: 3, re: /Achto/i },
      {
        region: "morytania",
        name: "Barrows",
        min: 5,
        re: /Ahrim|Dharok|Karil|Guthan|Torag|Verac/i,
      },
      { region: "kandarin", name: "Kuradal", min: 1, re: /Ferocious ring/i },
      { region: "misthalin", name: /Polypore Dungeon/, min: 2, re: /Polypore staff|Ganodermic/i },
      {
        region: "anachronia",
        name: "Rex Matriarchs",
        min: 4,
        re: /Champion|Reaver|Stalker|Channeller|Occultist|Skeka/i,
      },
      {
        region: "asgarnia",
        name: "Elite Dungeon 1",
        min: 2,
        re: /Ancient scales|Sirenic scales/i,
      },
    ];
    for (const c of cases) {
      const { row, upgrades } = contentRow(c.region, c.name);
      const full = contentRewardsFull(row, upgrades);
      expect(full, row.name).toMatch(c.re);
      const presented = presentContentRewards(full);
      expect(presented.icons.length, row.name).toBeGreaterThanOrEqual(c.min);
      expect(
        presented.icons.every((i) => publicOk(i.src)),
        row.name,
      ).toBe(true);
    }
  });

  it("ED2 ability codex labels resolve to published inventory art", () => {
    const labels = [
      "Greater Fury",
      "Greater Fury ability codex",
      "Greater Flurry",
      "Greater Flurry ability codex",
      "Greater Barge",
      "Greater Barge ability codex",
      "Draconic energy",
    ];
    for (const label of labels) {
      const src = resolveRewardIcon(label);
      expect(src, label).toBeTruthy();
      expect(publicOk(src), `${label} → ${src}`).toBe(true);
      expect(src, label).not.toMatch(/\/game\/bosses\//);
    }
    expect(resolveRewardIcon("Greater Fury")).toMatch(/greater-fury\.(webp|png)$/);
    expect(resolveRewardIcon("Draconic energy")).toMatch(/draconic-energy\.(webp|png)$/);
  });

  it("Amascut's Enchanted Gem resolves to gem inventory art not boss plate", () => {
    expect(resolveRewardIcon("Amascut's Enchanted Gem")).toMatch(/enchanted-gem\.(webp|png)$/);
    expect(publicOk(resolveRewardIcon("Amascut's Enchanted Gem"))).toBe(true);
  });

  it("expands trailing of-set slash lists into full piece names", () => {
    const tokens = contentRewardTokens(
      "Hood / garb / gown / gloves / boots of subjugation, Ward of subjugation",
    );
    expect(tokens.some((t) => /^hood of subjugation$/i.test(t))).toBe(true);
    expect(tokens.some((t) => /^garb of subjugation$/i.test(t))).toBe(true);
    expect(tokens.some((t) => /^boots of subjugation$/i.test(t))).toBe(true);
    const icons = contentRewardIcons(tokens);
    expect(icons.length).toBeGreaterThanOrEqual(5);
    expect(icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Subjugation equipment / Robes of subjugation resolve as set chips", () => {
    expect(resolveRewardIcon("Subjugation equipment")).toMatch(/subjugation/i);
    expect(resolveRewardIcon("subjugation")).toMatch(/subjugation/i);
    expect(resolveRewardIcon("Robes of subjugation")).toMatch(/garb-of-subjugation|subjugation/);
    expect(publicOk(resolveRewardIcon("Subjugation equipment"))).toBe(true);
    expect(publicOk(resolveRewardIcon("Robes of subjugation"))).toBe(true);
  });

  it("Raksha lists every unique under one boss", () => {
    const { row, upgrades } = contentRow("anachronia", "Raksha");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toBe(
      "Greater Ricochet, Greater Chain, Divert, Fleeting boots, Laceration boots, Blast diffusion boots, Shadow spike, Broken shackle",
    );
    expect(upgrades.some((upgrade) => upgrade.name.startsWith("Raksha"))).toBe(false);
    expect(presentContentRewards(full, 10).icons).toHaveLength(7);
  });

  it("maps GWD generals and major bosses to clean unique packages", () => {
    const samples: { region: string; name: string | RegExp; re: RegExp }[] = [
      { region: "asgarnia", name: "General Graardor", re: /Bandos helmet|Bandos equipment/i },
      { region: "asgarnia", name: "Kree'arra", re: /Armadyl helmet|Armadyl/i },
      { region: "asgarnia", name: /K'ril/, re: /subjugation/i },
      { region: "asgarnia", name: "Nex", re: /Torva|Pernix|Virtus/i },
      { region: "asgarnia", name: "Vorago", re: /Seismic/i },
      { region: "asgarnia", name: "Queen Black Dragon", re: /Dragon kiteshield/i },
      { region: "morytania", name: /Araxxor/, re: /Noxious/i },
      { region: "desert", name: /Telos/, re: /Seren godbow|Staff of Sliske|Zaros godsword/i },
      { region: "desert", name: /Amascut/, re: /Devourer's Guard|Tumeken/i },
      {
        region: "desert",
        name: "Citharede Abbey",
        re: /Sacrifice|Devotion|Transfigure|Illuminated god books/i,
      },
      { region: "desert", name: "Kalphite King", re: /Drygore/i },
      {
        region: "desert",
        name: /Vindicta/,
        re: /Dragon Rider lance/i,
      },
      {
        region: "desert",
        name: "Helwyr",
        re: /Cywir/i,
      },
      {
        region: "desert",
        name: "Twin Furies",
        re: /Blade of Avaryss|Blade of Nymora/i,
      },
      {
        region: "desert",
        name: "Gregorovic",
        re: /Shadow glaive/i,
      },
      {
        region: "asgarnia",
        name: "Commander Zilyana",
        re: /Saradomin sword|Saradomin godsword|Armadyl crossbow/i,
      },
      {
        region: "fremennik",
        name: "Dagannoth Kings",
        re: /Berserker ring|Dragon hatchet|Warrior ring|Archers/i,
      },
      { region: "kandarin", name: "Legiones", re: /Ascension/i },
      { region: "tirannwn", name: "Solak", re: /Blightbound|Erethdor/i },
      {
        region: "forinthry",
        name: /Dragonkin Laboratory/,
        re: /Greater Fury|Draconic energy|Tectonic energy/i,
      },
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

  it("Fort Forinthry surfaces The Raptor + Construction training icons", () => {
    const { row, upgrades } = contentRow("misthalin", "Fort Forinthry");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/The Raptor/i);
    expect(full).toMatch(/Construction training/i);
    expect(full).toMatch(/Fort buildings/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.some((i) => /raptor/i.test(i.label))).toBe(true);
    expect(presented.icons.some((i) => /construction training/i.test(i.label))).toBe(true);
    expect(presented.icons.some((i) => /slayer-helmet/i.test(i.src))).toBe(true);
    expect(presented.icons.some((i) => /constructors-outfit/i.test(i.src))).toBe(true);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("parent Sanctum and child bosses share the same unique list for filter", () => {
    const region = regionById("misthalin");
    const parent = region.content.find((c) => c.name === "Sanctum of Rebirth")!;
    const child = region.content.find((c) => c.name === "Vermyx, Brood Mother")!;
    expect(contentRewardsFull(parent, region.upgrades)).toBe(
      contentRewardsFull(child, region.upgrades),
    );
  });

  it("Fremennik Zorgoth's ring and Ungael ritual site are major unlocks", () => {
    const frem = regionById("fremennik");
    expect(frem.upgrades.some((u) => u.name === "Zorgoth's ring")).toBe(true);
    expect(frem.upgrades.some((u) => u.name === "Ungael ritual site")).toBe(true);

    const ring = frem.upgrades.find((u) => u.name === "Zorgoth's ring")!;
    const ringFull = contentRewardsFull(ring, frem.upgrades);
    expect(ringFull).toMatch(/Zorgoth's ring/i);
    expect(ringFull).toMatch(/Zorgoth's soul ring/i);
    const ringP = presentContentRewards(ringFull);
    expect(ringP.icons.length).toBeGreaterThanOrEqual(1);
    expect(ringP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(ringP.icons.some((i) => /zorgoths/i.test(i.src))).toBe(true);

    const site = frem.upgrades.find((u) => u.name === "Ungael ritual site")!;
    const siteFull = contentRewardsFull(site, frem.upgrades);
    expect(siteFull).toMatch(/Ungael ritual site/i);
    expect(siteFull).toMatch(/soul ring/i);
    const siteP = presentContentRewards(siteFull);
    expect(siteP.icons.length).toBeGreaterThanOrEqual(1);
    expect(siteP.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Havenhythe Wendlewick fish farm type is Fishing not taxonomy string", () => {
    expect(contentTypeLabel("starting-region Fishing infrastructure", "Wendlewick fish farm")).toBe(
      "Fishing",
    );
    expect(contentTypeLabel("Fishing", "Wendlewick fish farm")).toBe("Fishing");
    const { row, upgrades } = contentRow("havenhythe", "Wendlewick fish farm");
    expect(contentTypeLabel(row.kind ?? "", row.name)).toBe("Fishing");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Raw lobster/i);
    expect(full).toMatch(/Raw shark/i);
    expect(full).toMatch(/Raw giant crayfish/i);
    expect(full).not.toMatch(/High XP\/h Active Fishing method/i);
    expect(full).not.toMatch(/starting-region/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(3);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Havenhythe Old Meats uses butcher shop plate not crayfish", () => {
    const path = dataEntityIconPath({
      name: "Old Meats",
      kind: "Food and farm-supply shop",
    });
    expect(path).toMatch(/old-meats\.(webp|png)$/);
    expect(path).not.toMatch(/crayfish/i);
    const full = contentRewardsFull({ name: "Old Meats", detail: "" }, []);
    expect(full).toMatch(/Raw beef/i);
    expect(full).toMatch(/Raw chicken/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(3);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.every((i) => !/crayfish/i.test(i.src))).toBe(true);
  });

  it("Havenhythe Moonrise Dig Site has payoff reward icons", () => {
    const { row, upgrades } = contentRow("havenhythe", "Moonrise Dig Site");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Ring of Kayazu/i);
    expect(full).toMatch(/Tear of Inanna/i);
    expect(full).toMatch(/Hungry Like the Wolf/i);
    expect(full).toMatch(/Anzagar/i);
    // Prose tokens that never resolve icons should not be the whole reward string
    expect(full).not.toMatch(/Lv 52/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(4);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.some((i) => /ring-of-kayazu/i.test(i.src))).toBe(true);
    expect(
      presented.icons.some((i) => /tear-of-inanna|hungry-like-the-wolf|anzagar/i.test(i.src)),
    ).toBe(true);
  });

  it("Havenhythe Fern's Finds uses shop plate not Meilyr recipe shop", () => {
    const path = dataEntityIconPath({ name: "Fern's Finds", kind: "Mushroom shop" });
    expect(path).toMatch(/ferns-finds\.(webp|png)$/);
    expect(path).not.toMatch(/meilyr/i);
    const { row, upgrades } = contentRow("havenhythe", "Fern's Finds");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Button mushroom/i);
    expect(full).toMatch(/Bittercap mushroom/i);
    expect(full).toMatch(/Morchella mushroom/i);
    expect(full).not.toBe("Mushroom shop");
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(4);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.every((i) => !/meilyr/i.test(i.src))).toBe(true);
  });

  it("Morytania Vyrewatch has plate icon and drop reward chips", () => {
    expect(dataEntityIconPath({ name: "Vyrewatch", kind: "Slayer / multi-skill combat" })).toMatch(
      /vyrewatch\.(webp|png)$/,
    );
    const { row, upgrades } = contentRow("morytania", "Vyrewatch");
    const full = contentRewardsFull(row, upgrades);
    expect(full).toMatch(/Vyre corpse/i);
    expect(full).toMatch(/Congealed blood/i);
    expect(full).toMatch(/Death runes/i);
    expect(full).toMatch(/Splitbark/i);
    // Access prose must not replace the reward chip list
    expect(full.toLowerCase()).not.toMatch(/^blisterwood/);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(5);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.some((i) => /vyre-corpse|congealed-blood/i.test(i.src))).toBe(true);
  });

  it("Morytania Noxious components major has component + weapon icons", () => {
    const mory = regionById("morytania");
    expect(mory.upgrades.some((u) => u.name === "Noxious components")).toBe(true);
    const face = mory.upgrades.find((u) => u.name === "Noxious components")!;
    const full = contentRewardsFull(face, mory.upgrades);
    expect(full).toMatch(/Araxxi's eye/i);
    expect(full).toMatch(/Araxxi's fang/i);
    expect(full).toMatch(/Araxxi's web/i);
    expect(full).toMatch(/Spider leg top/i);
    expect(full).toMatch(/Noxious scythe/i);
    expect(full).toMatch(/Noxious staff/i);
    expect(full).toMatch(/Noxious longbow/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(6);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.some((i) => /araxxis-fang|araxxis-eye|spider-leg/i.test(i.src))).toBe(
      true,
    );
    expect(
      presented.icons.some((i) => /noxious-scythe|noxious-staff|noxious-longbow/i.test(i.src)),
    ).toBe(true);
  });

  it("Morytania Linza is separate from Barrows rewards", () => {
    const barrows = contentRow("morytania", "Barrows");
    const barrowsFull = contentRewardsFull(barrows.row, barrows.upgrades);
    expect(barrowsFull).toMatch(/Ahrim/i);
    expect(barrowsFull).toMatch(/Dharok/i);
    expect(barrowsFull).not.toMatch(/Linza/i);

    const linza = contentRow("morytania", "Linza the Disgraced");
    const linzaFull = contentRewardsFull(linza.row, linza.upgrades);
    expect(linzaFull).toMatch(/Linza's helm/i);
    expect(linzaFull).toMatch(/Linza's hammer/i);
    expect(linzaFull).toMatch(/Linza's shield/i);
    const linzaP = presentContentRewards(linzaFull);
    expect(linzaP.icons.length).toBeGreaterThanOrEqual(4);
    expect(linzaP.icons.every((i) => publicOk(i.src))).toBe(true);
  });

  it("Morytania blisterwood weapons major has inventory icons for each piece", () => {
    const row = contentRow("morytania", "Blisterwood weapons");
    const full = contentRewardsFull(row.row, row.upgrades);
    expect(full).toMatch(/Blisterwood polearm/i);
    expect(full).toMatch(/Blisterwood sickle/i);
    expect(full).toMatch(/Blisterwood staff/i);
    expect(full).toMatch(/Blisterwood wand/i);
    expect(full).toMatch(/Blisterwood orb/i);
    expect(full).toMatch(/stake-thrower crossbow/i);
    const presented = presentContentRewards(full);
    expect(presented.icons.length).toBeGreaterThanOrEqual(7);
    expect(presented.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(presented.icons.some((i) => /blisterwood-polearm/i.test(i.src))).toBe(true);
    expect(presented.icons.some((i) => /blisterwood-staff/i.test(i.src))).toBe(true);
    expect(presented.icons.some((i) => /blisterwood-wand/i.test(i.src))).toBe(true);
    expect(presented.icons.some((i) => /blisterwood-orb/i.test(i.src))).toBe(true);
  });

  it("Morytania shade cremation keys are majors with inventory icons", () => {
    const mory = regionById("morytania");
    expect(mory.content.some((c) => c.name === "Shade keys")).toBe(true);
    expect(mory.content.some((c) => c.name === "Shiny columbarium key")).toBe(true);
    expect(mory.content.some((c) => c.name === "Columbarium key")).toBe(true);

    // Hub: Prayer/FM + path pointers only; metal key chips live on key majors.
    const cremation = contentRow("morytania", "Shades of Mort'ton cremation");
    const cremationFull = contentRewardsFull(cremation.row, cremation.upgrades);
    expect(cremationFull).toMatch(/Prayer XP/i);
    expect(cremationFull).toMatch(/Firemaking XP/i);
    expect(cremationFull).toMatch(/Shade keys path/i);
    expect(cremationFull).toMatch(/Columbarium keys path/i);
    expect(cremationFull).not.toMatch(/Bronze key/i);
    expect(cremationFull).not.toMatch(/Shiny columbarium key/i);

    const shadeKeys = contentRow("morytania", "Shade keys");
    const shadeFull = contentRewardsFull(shadeKeys.row, shadeKeys.upgrades);
    expect(shadeFull).toMatch(/Bronze key.*Steel key.*Black key.*Silver key.*Gold key/i);
    expect(shadeFull).toMatch(/Shade skull/i);
    expect(shadeFull).toMatch(/Shade master kit/i);
    const shadeP = presentContentRewards(shadeFull);
    // Metal keys have inventory icons; skull/kit may be text-only chips.
    expect(shadeP.icons.length).toBeGreaterThanOrEqual(5);
    expect(shadeP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(shadeP.icons.some((i) => /gold-key/i.test(i.src))).toBe(true);

    const shiny = contentRow("morytania", "Shiny columbarium key");
    const shinyFull = contentRewardsFull(shiny.row, shiny.upgrades);
    expect(shinyFull).toMatch(/Shiny columbarium key/i);
    expect(shinyFull).toMatch(/Dragon spear/i);
    expect(shinyFull).toMatch(/Blood runes/i);
    expect(shinyFull).toMatch(/High herbs/i);
    expect(shinyFull).toMatch(/Half keys/i);
    expect(shinyFull).toMatch(/Trail armour/i);
    const shinyP = presentContentRewards(shinyFull);
    expect(shinyP.icons.length).toBeGreaterThanOrEqual(4);
    expect(shinyP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(shinyP.icons.some((i) => /shiny-columbarium-key/i.test(i.src))).toBe(true);
    expect(shinyP.icons.some((i) => /dragon-spear/i.test(i.src))).toBe(true);

    const plain = contentRow("morytania", "Columbarium key");
    const plainFull = contentRewardsFull(plain.row, plain.upgrades);
    expect(plainFull).toMatch(/Columbarium key/i);
    expect(plainFull).toMatch(/Blood talisman/i);
    expect(plainFull).toMatch(/Dragon spear/i);
    expect(plainFull).toMatch(/Blood runes/i);
    const plainP = presentContentRewards(plainFull);
    expect(plainP.icons.length).toBeGreaterThanOrEqual(4);
    expect(plainP.icons.every((i) => publicOk(i.src))).toBe(true);
    expect(plainP.icons.some((i) => /columbarium-key/i.test(i.src))).toBe(true);
    expect(plainP.icons.some((i) => /blood-talisman/i.test(i.src))).toBe(true);
    expect(plainP.icons.some((i) => /dragon-spear/i.test(i.src))).toBe(true);

    expect(dataEntityIconPath({ name: "Shade keys" })).toMatch(/gold-key\.(webp|png)$/);
    expect(dataEntityIconPath({ name: "Shiny columbarium key" })).toMatch(
      /shiny-columbarium-key\.(webp|png)$/,
    );
    expect(dataEntityIconPath({ name: "Columbarium key" })).toMatch(/columbarium-key\.(webp|png)$/);
  });

  it("Tirannwn majors keep Solak (not collapsed under Lost Grove)", () => {
    const region = regionById("tirannwn");
    const majors = majorContentRows(region.content, region.upgrades);
    expect(majors.some((c) => c.name === "Solak")).toBe(true);
    expect(majors.some((c) => c.name === "The Lost Grove")).toBe(true);
    const misth = regionById("misthalin");
    const misthMajors = majorContentRows(misth.content, misth.upgrades);
    expect(misthMajors.some((c) => c.name === "Sanctum of Rebirth")).toBe(true);
    expect(misthMajors.some((c) => c.name === "Vermyx, Brood Mother")).toBe(false);
  });

  it("Asgarnia majors include Angel of Death after Nex; Kandarin includes Thalmund's Forge after Warforge", () => {
    const asg = regionById("asgarnia");
    const asgMajors = majorContentRows(asg.content, asg.upgrades);
    const asgNames = asgMajors.map((c) => c.name);
    expect(
      asgNames.some((n) => /Angel of Death/i.test(n)),
      "asgarnia majorContentRows lacks Angel of Death",
    ).toBe(true);
    expect(asgNames).toContain("Nex: Angel of Death");
    const nexIdx = asg.content.findIndex((c) => c.name === "Nex");
    const aodIdx = asg.content.findIndex((c) => c.name === "Nex: Angel of Death");
    expect(nexIdx).toBeGreaterThanOrEqual(0);
    expect(aodIdx).toBe(nexIdx + 1);

    const kan = regionById("kandarin");
    const kanMajors = majorContentRows(kan.content, kan.upgrades);
    const kanNames = kanMajors.map((c) => c.name);
    expect(
      kanNames.some((n) => /Thalmund'?s Forge/i.test(n)),
      "kandarin majorContentRows lacks Thalmund's Forge",
    ).toBe(true);
    expect(kanNames).toContain("Thalmund's Forge");
    const warIdx = kan.content.findIndex((c) => /Warforge Dig Site/i.test(c.name));
    const thalIdx = kan.content.findIndex((c) => c.name === "Thalmund's Forge");
    expect(warIdx).toBeGreaterThanOrEqual(0);
    expect(thalIdx).toBe(warIdx + 1);

    expect(
      kanNames.some((n) => /Advanced Barbarian Outpost Agility/i.test(n)),
      "kandarin majorContentRows lacks Advanced Barbarian Outpost Agility",
    ).toBe(true);
    expect(
      kanNames.some((n) => /Book of Char/i.test(n)),
      "kandarin majorContentRows lacks Book of Char / Char firemaking",
    ).toBe(true);

    const { row: advBarb, upgrades: kanUp } = contentRow(
      "kandarin",
      "Advanced Barbarian Outpost Agility",
    );
    const advFull = contentRewardsFull(advBarb, kanUp);
    expect(advFull).toMatch(/Agile top/i);
    expect(advFull).toMatch(/Agile legs/i);
    expect(advBarb.detail ?? "").toMatch(/rebalanc|buffed|2,?000/i);

    const { row: bookChar } = contentRow("kandarin", "Book of Char / Char firemaking");
    const bookFull = contentRewardsFull(bookChar, kanUp);
    expect(bookFull).toMatch(/Book of Char/i);
    expect(bookFull).toMatch(/Char'?s training cave|Pitch can|Double Firemaking/i);

    expect(
      kanNames.some((n) => /Phoenix Lair/i.test(n)),
      "kandarin majorContentRows lacks Phoenix Lair",
    ).toBe(true);
    expect(
      kanNames.some((n) => /^Airuts?$/i.test(n)),
      "kandarin majorContentRows lacks Airuts",
    ).toBe(true);
    expect(
      kanNames.some((n) => /Fishing Frenzy/i.test(n)),
      "kandarin majorContentRows lacks Fishing Frenzy",
    ).toBe(true);
    const { row: frenzy } = contentRow("kandarin", "Fishing Frenzy");
    const frenzyFull = contentRewardsFull(frenzy, kanUp);
    expect(frenzyFull).toMatch(/Fishing Frenzy|285k|Advance Time/i);
    expect(dataEntityIconPath({ name: frenzy.name })).toMatch(/deep-sea-fishing|fishing/i);
    const { row: phoenix } = contentRow("kandarin", "Phoenix Lair");
    expect(contentRewardsFull(phoenix, kanUp)).toMatch(/Phoenix quills|eggling/i);
    const { row: airutKan } = contentRow("kandarin", "Airuts");
    const airutKanFull = contentRewardsFull(airutKan, kanUp);
    expect(airutKanFull).toMatch(/Tuska'?s Wrath/i);
    expect(airutKanFull).toMatch(/Razorback/i);
    expect(airutKanFull).toMatch(/Warpriest of Tuska|Tuska mask/i);

    const desert = regionById("desert");
    const desertMajors = majorContentRows(desert.content, desert.upgrades);
    expect(
      desertMajors.some((c) => /^Airuts?$/i.test(c.name)),
      "desert majorContentRows lacks Airuts",
    ).toBe(true);
    const { row: airutDes, upgrades: desUp } = contentRow("desert", "Airuts");
    const airutDesFull = contentRewardsFull(airutDes, desUp);
    expect(airutDesFull).toMatch(/Tuska'?s Wrath/i);
    expect(airutDesFull).toMatch(/Razorback/i);
  });

  it("Tirannwn Solak and Lost Grove expose cinderbanes; Edimmu has blood shard", () => {
    const { row: solak, upgrades } = contentRow("tirannwn", "Solak");
    expect(contentRewardsFull(solak, upgrades)).toMatch(/Cinderbane/i);
    expect(contentRewardsFull(solak, upgrades)).toMatch(/Blightbound|Erethdor/i);

    const { row: grove } = contentRow("tirannwn", "The Lost Grove");
    expect(contentRewardsFull(grove, upgrades)).toMatch(/Cinderbane/i);
    expect(contentRewardsFull(grove, upgrades)).not.toMatch(/Blightbound/i);

    const { row: edimmu } = contentRow("tirannwn", "Edimmu resource dungeon");
    expect(contentRewardsFull(edimmu, upgrades)).toMatch(/Blood necklace shard/i);
  });

  it("Tirannwn renames clutter hubs and adds hunter/tools majors", () => {
    const region = regionById("tirannwn");
    const names = region.content.map((c) => c.name);
    expect(names).toContain("Harmony moss");
    expect(names).toContain("Seren stones");
    expect(names).toContain("Ithell harps");
    expect(names).toContain("Grenwalls");
    expect(names).toContain("Crystal tools");
    expect(names).toContain("Crystal skillchompas");
    expect(names).toContain("Perfect juju potions");
    expect(names).toContain("Max Guild");
    // Package retired: individual Crystallise / Light Form / etc. stay as upgrades.
    expect(names).not.toContain("Seren spells and prayers");
    expect(names).not.toContain("Seren spells & prayers");
    expect(names).not.toContain("Crystal equipment and Prifddinas skilling content");
    expect(names).not.toContain("Trahaearn Mining and Smithing hub");
    expect(names).not.toContain("Voice of Seren district rotations");
    expect(names).not.toContain("Amlodd Summoning and Divination hub");
    expect(names).not.toContain("Corrupted ore smelting loop");

    const { row: hefin, upgrades } = contentRow("tirannwn", "Hefin Agility Course");
    expect(contentRewardsFull(hefin, upgrades)).toMatch(/Prifddinian worker/i);
  });

  it("Tirannwn keeps Crystallise as an upgrade, not the Seren package content major", () => {
    const region = regionById("tirannwn");
    expect(region.content.some((c) => /Seren spells/i.test(c.name))).toBe(false);
    expect(region.upgrades.some((u) => /Crystallise/i.test(u.name))).toBe(true);
  });
});

describe("contentDetailOrRewards — empty catalog detail fallback", () => {
  it("prefers non-empty catalog detail over rewards", () => {
    const row = {
      name: "Kerapac, the bound",
      detail: "Senntisten EGWD · Magic BiS farm",
    };
    expect(contentDetailOrRewards(row, [])).toBe("Senntisten EGWD · Magic BiS farm");
  });

  it("Giant Mole empty detail falls back to clipped rewards", () => {
    const { row, upgrades } = contentRow("asgarnia", "Giant Mole");
    expect((row.detail ?? "").trim()).toBe("");
    const subtitle = contentDetailOrRewards(row, upgrades);
    expect(subtitle).toMatch(/Dragon 2h sword/i);
    expect(subtitle.length).toBeLessThanOrEqual(96);
    expect(subtitle).not.toBe("");
  });

  it("Kerapac empty detail falls back to progression uniques", () => {
    const { row, upgrades } = contentRow("misthalin", "Kerapac, the bound");
    expect((row.detail ?? "").trim()).toBe("");
    const subtitle = contentDetailOrRewards(row, upgrades);
    expect(subtitle).toMatch(
      /Fractured Staff|Greater Concentrated Blast|Kerapac|Scripture of Jas/i,
    );
    expect(subtitle.length).toBeLessThanOrEqual(96);
    expect(subtitle).not.toMatch(/working league mapping|catalyst test data/i);
  });

  it("returns empty string when detail and rewards are both blank", () => {
    expect(contentDetailOrRewards({ name: "Unknown Placeholder Boss", detail: "" }, [])).toBe("");
  });
});
