import { describe, expect, it } from "vitest";
import {
  activeEquipmentEffects,
  applyEquipmentAccuracy,
  applyEquipmentDamagePotential,
  effectiveSetPieces,
  equipmentSetById,
  equippedPassiveSummaries,
  equippedSetCounts,
  firstNecromancerConjureDamageMult,
  firstNecromancerConjureDurationMult,
  loadoutFirstNecromancerConjureDamageMult,
  loadoutFirstNecromancerConjureDurationMult,
  loadoutSetCritChance,
  resolveLoadoutSetCritChance,
  setCritChanceFromDef,
  setDamageModifiers,
  setEffectsSummary,
  type EquipmentSetDef,
} from "./equipment";

describe("shared/equipment set effects", () => {
  it("makes the pre-activated static-loadout model explicit", () => {
    const effects = activeEquipmentEffects({
      style: "melee",
      equipmentIds: [
        "item:vestments-of-havoc-hood",
        "item:vestments-of-havoc-robe-top",
        "item:vestments-of-havoc-robe-bottom",
        "item:vestments-of-havoc-boots",
      ],
    });
    expect(effects.activation).toBe("pre-activated-static-loadout");
    expect(effects.vestments).toMatchObject({
      pieces: 4,
      heraldOfChaos: true,
      berserkExtension: true,
      increasedAdrenalineCap: true,
    });
  });

  it("set crit: catalogue defs, loadout wiring, sunshine gate, empty gear", () => {
    const tec = equipmentSetById("tectonic")!;
    const elite = equipmentSetById("elite-tectonic")!;
    const tum = equipmentSetById("tumekens-resplendence")!;
    expect(setCritChanceFromDef(tec, 3)).toBeCloseTo(0.03, 10);
    expect(setCritChanceFromDef(elite, 3)).toBeCloseTo(0.06, 10);
    expect(setCritChanceFromDef(tec, 0)).toBe(0);
    expect(setCritChanceFromDef(tum, 3, { insideSunshine: true })).toBeCloseTo(0.045, 10);
    expect(setCritChanceFromDef(tum, 3, { insideSunshine: false })).toBe(0);
    expect(setCritChanceFromDef(tum, 2, { insideSunshine: true })).toBe(0);

    const tectonic = {
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
    };
    expect(equippedSetCounts(tectonic).get("tectonic")).toBe(3);
    expect(loadoutSetCritChance(tectonic)).toBeCloseTo(0.03, 10);
    expect(setEffectsSummary(tectonic)).toEqual([
      {
        setId: "tectonic",
        pieces: 3,
        effectivePieces: 3,
        additionalPiecesPerItem: 0,
        label: "Tectonic (Fracture Point)",
        support: "modeled",
      },
    ]);

    const eliteLoadout = {
      equipmentSlots: {
        helmet: "item:elite-tectonic-mask",
        body: "item:elite-tectonic-robe-top",
        legs: "item:elite-tectonic-robe-bottom",
      },
    };
    expect(equippedSetCounts(eliteLoadout).get("elite-tectonic")).toBe(3);
    expect(loadoutSetCritChance(eliteLoadout)).toBeCloseTo(0.06, 10);

    const tumLoadout = {
      equipmentSlots: {
        helmet: "item:tumekens-resplendence-helm",
        body: "item:tumekens-resplendence-body",
        legs: "item:tumekens-resplendence-legs",
      },
      insideSunshine: true,
    };
    expect(equippedSetCounts(tumLoadout).get("tumekens-resplendence")).toBe(3);
    expect(loadoutSetCritChance(tumLoadout)).toBeCloseTo(0.045, 10);
    expect(loadoutSetCritChance({ ...tumLoadout, insideSunshine: false })).toBe(0);

    expect(loadoutSetCritChance({ equipmentSlots: {} })).toBe(0);
    expect(loadoutSetCritChance({})).toBe(0);
    expect(setEffectsSummary({ equipmentSlots: {} })).toEqual([]);
  });

  it("resolves an unknown catalogue set through the injectable generic loadout path", () => {
    const synthetic: EquipmentSetDef = {
      id: "synthetic-unknown-set",
      label: "Synthetic unknown set",
      maxPieces: 6,
      effects: [{ minPieces: 2, kind: "critChancePerPiece", value: 0.02 }],
      source: equipmentSetById("tectonic")!.source,
    };
    const resolved = resolveLoadoutSetCritChance(
      { pieceContribution: { additionalPiecesPerItem: 1 } },
      {
        definitions: [synthetic],
        countsResolver: () => ({
          setCounts: new Map([[synthetic.id, 3]]),
          itemCounts: new Map([[synthetic.id, 3]]),
        }),
      },
    );
    expect(resolved).toEqual({ unconditional: 0.12, conditional: {} });
    expect(
      loadoutSetCritChance(
        { pieceContribution: { additionalPiecesPerItem: 1 } },
        {
          definitions: [synthetic],
          countsResolver: () => ({
            setCounts: new Map([[synthetic.id, 3]]),
            itemCounts: new Map([[synthetic.id, 3]]),
          }),
        },
      ),
    ).toBeCloseTo(0.12, 10);
  });

  it("models Warpriest of Tuska thresholds and Chaotic Insight above maxPieces", () => {
    const pieces = [
      "item:warpriest-of-tuska-helm",
      "item:warpriest-of-tuska-cuirass",
      "item:warpriest-of-tuska-robe-legs",
      "item:warpriest-of-tuska-gauntlets",
      "item:warpriest-of-tuska-boots",
      "item:warpriest-of-tuska-cape",
    ] as const;
    const chanceAt = (count: number, pieceContribution?: { additionalPiecesPerItem: number }) =>
      activeEquipmentEffects({
        style: "melee",
        equipmentIds: pieces.slice(0, count),
        pieceContribution,
      }).setCritChance.unconditional;
    expect(chanceAt(2)).toBe(0);
    expect(chanceAt(3)).toBeCloseTo(0.03, 10);
    expect(chanceAt(4)).toBeCloseTo(0.04, 10);
    expect(chanceAt(5)).toBeCloseTo(0.05, 10);
    expect(chanceAt(6)).toBeCloseTo(0.06, 10);

    const chaotic = activeEquipmentEffects({
      style: "melee",
      equipmentIds: pieces.slice(0, 3),
      pieceContribution: { additionalPiecesPerItem: 2 },
    });
    expect(chaotic.setCritChance).toEqual({ unconditional: 0.09, conditional: {} });
    expect(
      setEffectsSummary({
        equipmentIds: pieces.slice(0, 3),
        pieceContribution: { additionalPiecesPerItem: 2 },
      }),
    ).toEqual([
      expect.objectContaining({
        setId: "warpriest-of-tuska",
        pieces: 3,
        effectivePieces: 9,
        support: "modeled",
      }),
    ]);
  });

  it("derives sourced passive rows from equipped items and account enchantments", () => {
    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: {
        helmet: "item:jaws-of-the-abyss",
        gloves: "item:enhanced-gloves-of-passage",
      },
      enchantments: ["agony"],
    });
    expect(rows.map((row) => row.itemName)).toEqual([
      "Jaws of the Abyss",
      "Enhanced gloves of passage",
    ]);
    expect(rows[0]).toMatchObject({ support: "modeled", passiveId: "jaws-of-the-abyss" });
    expect(rows[0]!.effects).toHaveLength(2);
    expect(rows[0]!.source.url).toMatch(/^https:\/\/runescape\.wiki\//);
    expect(rows[1]).toMatchObject({ label: "Enduring Ruin + Agony", support: "modeled" });
    expect(equippedPassiveSummaries({ equipmentSlots: {} })).toEqual([]);
  });

  it("collapses Kal-Zuk multi-igneous passives into one Gear row", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: { cape: "item:igneous-kal-zuk" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemId: "item:igneous-kal-zuk",
      label: "Igneous ultimate upgrades",
      support: "modeled",
    });
    expect(rows[0]!.effects).toEqual([
      "Unlocks upgraded Overpower, Deadshot, Omnipower, and Death Skulls.",
    ]);
  });

  it("does not paint empty Set effects cards for grouping tags like igneous or leng", () => {
    expect(setEffectsSummary({ equipmentSlots: { cape: "item:igneous-kal-zuk" } })).toEqual([]);
    expect(
      setEffectsSummary({
        equipmentSlots: {
          mainhand: "item:dark-shard-of-leng",
          offhand: "item:dark-sliver-of-leng",
        },
      }),
    ).toEqual([]);
  });

  it("keeps stat-only Nex armour out of the set-effects list", () => {
    expect(
      setEffectsSummary({
        equipmentSlots: {
          helmet: "item:torva-full-helm",
          body: "item:virtus-robe-top",
          legs: "item:pernix-chaps",
        },
      }),
    ).toEqual([]);
  });

  it("style Igneous capes still show a single style-specific passive row", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: { cape: "item:igneous-kal-ket" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "igneous-overpower",
      label: "Igneous Overpower",
    });
  });

  it("applies defender-class +3% to accuracy, not final Damage Potential", () => {
    const defender = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { offhand: "item:kalphite-defender" },
    });
    const shield = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { offhand: "item:malevolent-kiteshield" },
    });
    expect(defender.defenderEquipped).toBe(true);
    expect(shield.defenderEquipped).toBe(false);
    expect(applyEquipmentAccuracy(1000, defender)).toBe(1030);
    expect(applyEquipmentAccuracy(1000, shield)).toBe(1000);
    expect(applyEquipmentDamagePotential(0.5, defender)).toBe(0.5);
    expect(applyEquipmentDamagePotential(0.5, shield)).toBe(0.5);
  });

  it.each([
    ["item:kalphite-defender", "melee"],
    ["item:kalphite-repriser", "ranged"],
    ["item:kalphite-rebounder", "magic"],
  ] as const)("shows the defender accuracy passive for %s", (itemId, style) => {
    expect(
      equippedPassiveSummaries({ style, equipmentSlots: { offhand: itemId } })[0],
    ).toMatchObject({
      passiveId: "defender-accuracy",
      label: "Defender accuracy",
      effects: ["Defenders, reprisers, and rebounders have +3% accuracy."],
      support: "modeled",
    });
  });

  it("collapses dual Leng weapons into one Gear row", () => {
    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "leng-endless-frost",
      itemName: "Dark Shard & Sliver of Leng",
      label: "Leng weapons",
      support: "modeled",
    });
    expect(rows[0]!.effects.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps single Leng passives as individual rows", () => {
    const shard = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: { mainhand: "item:dark-shard-of-leng" },
    });
    expect(shard).toHaveLength(1);
    expect(shard[0]).toMatchObject({
      passiveId: "leng-endless-frost",
      label: "Endless Frost",
      support: "modeled",
    });
  });

  it("surfaces Asylum Surgeon and Deathtouch as not-modeled", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: {
        ring: "item:asylum-surgeons-ring",
        gloves: "item:deathtouch-bracelet",
      },
    });
    expect(rows.find((r) => r.passiveId === "asylum-surgeon")).toMatchObject({
      support: "not-modeled",
      label: "Asylum surgeon's ring",
    });
    expect(rows.find((r) => r.passiveId === "deathtouch-reflect")).toMatchObject({
      support: "not-modeled",
      label: "Deathtouch reflect",
    });
  });

  it("marks Abyssal Parasite as partially-modeled", () => {
    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: { mainhand: "item:abyssal-scourge" },
    });
    expect(rows.some((r) => r.passiveId === "abyssal-parasite")).toBe(true);
    expect(rows.find((r) => r.passiveId === "abyssal-parasite")).toMatchObject({
      label: "Abyssal Parasite",
      support: "partially-modeled",
    });
  });

  it("shows Ring of Vigour from catalogue passiveId (no item-id special case)", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: { ring: "item:ring-of-vigour" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "ring-of-vigour",
      itemId: "item:ring-of-vigour",
      label: "Ring of Vigour",
      support: "modeled",
    });
    expect(rows[0]!.effects.length).toBeGreaterThanOrEqual(2);
  });

  it("First Necromancer: conjure mults, visage double-count, no player AD set effects", () => {
    expect(firstNecromancerConjureDamageMult(0)).toBe(1);
    expect(firstNecromancerConjureDamageMult(1)).toBe(1);
    expect(firstNecromancerConjureDamageMult(2)).toBeCloseTo(1.14, 10);
    expect(firstNecromancerConjureDamageMult(3)).toBeCloseTo(1.21, 10);
    expect(firstNecromancerConjureDamageMult(5)).toBeCloseTo(1.35, 10);
    expect(firstNecromancerConjureDamageMult(9)).toBeCloseTo(1.35, 10);
    expect(firstNecromancerConjureDurationMult(3)).toBe(1);
    expect(firstNecromancerConjureDurationMult(4)).toBeCloseTo(1.2, 10);
    expect(firstNecromancerConjureDurationMult(5)).toBeCloseTo(1.25, 10);

    const visageLoadout = {
      equipmentSlots: {
        helmet: "item:visage-of-the-first-necromancer",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
      },
    };
    expect(equippedSetCounts(visageLoadout).get("first-necromancer")).toBe(6);
    expect(setEffectsSummary(visageLoadout)[0]).toMatchObject({ pieces: 5, effectivePieces: 6 });
    expect(loadoutFirstNecromancerConjureDamageMult(visageLoadout)).toBeCloseTo(1.35, 10);

    const maskLoadout = {
      equipmentSlots: { helmet: "item:misalionars-death-mask" },
    };
    expect(equippedSetCounts(maskLoadout).get("first-necromancer")).toBe(1);
    expect(setEffectsSummary(maskLoadout)[0]).toMatchObject({ pieces: 1, effectivePieces: 1 });
    expect(loadoutFirstNecromancerConjureDamageMult(maskLoadout)).toBe(1);
    expect(loadoutFirstNecromancerConjureDurationMult(maskLoadout)).toBe(1);

    const chaotic = { additionalPiecesPerItem: 2 } as const;
    const normalChaotic = {
      equipmentSlots: { body: "item:first-necromancer-body" },
      pieceContribution: chaotic,
    };
    const visageChaotic = {
      equipmentSlots: { helmet: "item:visage-of-the-first-necromancer" },
      pieceContribution: chaotic,
    };
    expect(setEffectsSummary(normalChaotic)[0]).toMatchObject({
      pieces: 1,
      effectivePieces: 3,
      support: "outgoing-only",
    });
    expect(setEffectsSummary(visageChaotic)[0]).toMatchObject({
      pieces: 1,
      effectivePieces: 4,
    });
    expect(loadoutFirstNecromancerConjureDamageMult(normalChaotic)).toBeCloseTo(1.21, 10);
    expect(loadoutFirstNecromancerConjureDamageMult(visageChaotic)).toBeCloseTo(1.28, 10);
    expect(loadoutFirstNecromancerConjureDurationMult(visageChaotic)).toBeCloseTo(1.2, 10);

    const helmLoadout = {
      equipmentSlots: {
        helmet: "item:first-necromancer-helm",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
      },
    };
    expect(equippedSetCounts(helmLoadout).get("first-necromancer")).toBe(5);
    expect(loadoutFirstNecromancerConjureDamageMult(helmLoadout)).toBeCloseTo(1.35, 10);
    expect(setDamageModifiers(equippedSetCounts(helmLoadout))).toEqual([]);
    expect(equipmentSetById("first-necromancer")?.effects).toEqual([]);
  });

  it("uses one centralized effective count for thresholds and per-piece scaling", () => {
    const source = equipmentSetById("tectonic")!.source;
    const thresholdDef: EquipmentSetDef = {
      id: "test-set",
      label: "Test set",
      maxPieces: 3,
      effects: [{ minPieces: 2, kind: "critChancePerPiece", value: 0.01 }],
      source,
    };
    expect(effectiveSetPieces(3, { additionalPiecesPerItem: 2 })).toBe(9);
    expect(
      setCritChanceFromDef(thresholdDef, 1, { pieceContribution: { additionalPiecesPerItem: 2 } }),
    ).toBeCloseTo(0.03, 10);

    const perPieceDef: EquipmentSetDef = {
      ...thresholdDef,
      effects: [{ minPieces: 1, kind: "damageMultPerPiece", value: 0.02 }],
    };
    const modifiers = setDamageModifiers(
      new Map([[perPieceDef.id, 3]]),
      { pieceContribution: { additionalPiecesPerItem: 2 } },
      [perPieceDef],
    );
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0]!.apply({ damage: 1000 }, { style: "melee" }).damage).toBe(1180);
  });

  it("preserves inactive behavior and physical membership counts", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tumekens-resplendence-body",
      },
      pieceContribution: { additionalPiecesPerItem: 2 },
    };
    const counts = equippedSetCounts(loadout);
    expect(counts.get("tectonic")).toBe(1);
    expect(counts.get("tumekens-resplendence")).toBe(1);
    expect(setEffectsSummary(loadout)).toEqual([
      expect.objectContaining({ setId: "tectonic", pieces: 1, effectivePieces: 3 }),
      expect.objectContaining({
        setId: "tumekens-resplendence",
        pieces: 1,
        effectivePieces: 3,
      }),
    ]);
    expect(loadoutSetCritChance(loadout)).toBeCloseTo(0.03, 10);
    expect(loadoutSetCritChance({ equipmentSlots: { helmet: "item:tectonic-helm" } })).toBeCloseTo(
      0.01,
      10,
    );

    expect(
      loadoutSetCritChance({
        equipmentSlots: {
          helmet: "item:tumekens-resplendence-helm",
          body: "item:tumekens-resplendence-body",
          legs: "item:tumekens-resplendence-legs",
        },
        insideSunshine: true,
        pieceContribution: { additionalPiecesPerItem: 2 },
      }),
    ).toBeCloseTo(0.135, 10);

    const vestments = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { helmet: "item:vestments-of-havoc-hood" },
      pieceContribution: { additionalPiecesPerItem: 2 },
    });
    expect(vestments.vestments).toMatchObject({
      pieces: 3,
      heraldOfChaos: true,
      berserkExtension: true,
      increasedAdrenalineCap: false,
    });
  });

  it("retains explicit First Necromancer caps after effective-piece scaling", () => {
    const loadout = {
      equipmentSlots: {
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
      },
      pieceContribution: { additionalPiecesPerItem: 2 },
    };
    expect(equippedSetCounts(loadout).get("first-necromancer")).toBe(2);
    expect(loadoutFirstNecromancerConjureDamageMult(loadout)).toBeCloseTo(1.35, 10);
    expect(loadoutFirstNecromancerConjureDurationMult(loadout)).toBeCloseTo(1.25, 10);
  });

  it("catalogue sets carry provenance; facts-only / non-player-AD sets stay empty effects", () => {
    for (const id of [
      "tectonic",
      "tumekens-resplendence",
      "first-necromancer",
      "vestments-of-havoc",
      "deathdealer-90",
      "trimmed-masterwork",
      "virtus",
      "anima-core-zaros",
      "anima-core-seren",
      "anima-core-zamorak",
      "anima-core-sliske",
    ]) {
      const def = equipmentSetById(id);
      expect(def, id).toBeDefined();
      expect(def!.source.verifiedAt, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const fn = equipmentSetById("first-necromancer")!;
    expect(fn.facts?.length).toBeGreaterThan(0);
    expect(fn.effects).toEqual([]);

    const vest = equipmentSetById("vestments-of-havoc")!;
    expect(vest.facts?.some((f) => /adrenaline/i.test(f))).toBe(true);
    expect(vest.effects).toEqual([]);

    const dd = equipmentSetById("deathdealer-90")!;
    expect(dd.facts?.some((f) => /Death Mark/i.test(f))).toBe(true);

    for (const id of [
      "trimmed-masterwork",
      "virtus",
      "anima-core-zaros",
      "anima-core-seren",
      "anima-core-zamorak",
      "anima-core-sliske",
    ]) {
      expect(equipmentSetById(id)!.effects, id).toEqual([]);
    }
  });
});
