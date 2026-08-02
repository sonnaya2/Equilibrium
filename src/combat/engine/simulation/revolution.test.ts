import { describe, expect, it } from "vitest";
import { combatRevolutionBars, abilityById } from "../../data";
import type { RevolutionBarRecord } from "../../data/records";
import { resolveBar, specFromRecord } from "../../data/specs";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { rotationOf } from "./contracts";
import { simulateRevolution } from "./revolution";
import { simulate } from "./simulate";
import { secondsToTicks, TICK_SECONDS } from "../../core/ticks";

function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(label);
  return value;
}

const ENGINE_SPECS = new Map(
  [
    ...MELEE_ABILITIES,
    ...RANGED_ABILITIES,
    ...MAGIC_ABILITIES,
    ...NECROMANCY_ABILITIES,
    volleyOfSouls(3),
  ].map((spec) => [spec.id, spec]),
);

const baseInput = { base: 1000, level: 99, accuracy: 1, crit: { chance: 0 } };

function barById(id: string): RevolutionBarRecord {
  return required(
    combatRevolutionBars.records.find((bar) => bar.id === id),
    `Missing Revolution bar: ${id}`,
  );
}

function abilitySpec(id: string) {
  return required(ENGINE_SPECS.get(id), `Missing engine ability: ${id}`);
}

function abilityRecord(id: string) {
  return required(abilityById(id), `Missing ability record: ${id}`);
}

function revoModelled(bar: RevolutionBarRecord) {
  const window =
    bar.mode === "hybrid"
      ? resolveBar(bar, ENGINE_SPECS).slice(0, bar.revolutionSize)
      : resolveBar(bar, ENGINE_SPECS);
  return window.flatMap((slot) => (slot.spec ? [slot.spec] : []));
}

function slotByName(slots: ReturnType<typeof resolveBar>, name: string) {
  return required(
    slots.find((slot) => slot.name === name),
    `Missing Revolution slot: ${name}`,
  );
}

describe("resolveBar", () => {
  it("prefers engine specs over record adapters for the same ability", () => {
    const meleeBar = barById("melee-dual-wield");
    const slots = resolveBar(meleeBar, ENGINE_SPECS);
    const rend = slotByName(slots, "Rend");
    expect(rend.modelledBy).toBe("engine");
    expect(rend.spec?.id).toBe("rend");
    const flurry = slotByName(slots, "Greater Flurry");
    expect(flurry.modelledBy).toBe("engine");
    expect(flurry.spec?.id).toBe("greater_flurry");
    const meteor = slotByName(slots, "Meteor Strike");
    expect(meteor.modelledBy).toBe("engine");
    expect(meteor.spec?.id).toBe("meteor_strike");
    expect(meteor.spec?.hits[0].band).toEqual({ minPct: 220, maxPct: 250 });
  });

  it("resolves Adaptive Strike by weapon setup and Sacrifice to the bar's style", () => {
    const dw = resolveBar(barById("melee-dual-wield"), ENGINE_SPECS);
    expect(slotByName(dw, "Adaptive Strike").spec?.id).toBe("adaptive_strike_dw");
    const th = resolveBar(barById("melee-two-handed"), ENGINE_SPECS);
    expect(slotByName(th, "Adaptive Strike").spec?.id).toBe("adaptive_strike_2h");

    const necro = resolveBar(barById("necromancy"), ENGINE_SPECS);
    const sacrifice = slotByName(necro, "Sacrifice");
    expect(sacrifice.modelledBy).toBe("record");
    expect(sacrifice.spec?.style).toBe("necromancy");
  });

  it("resolves magic PvME ST damage slots via engine specs", () => {
    const magic = resolveBar(barById("magic"), ENGINE_SPECS);
    for (const [name, id] of [
      ["Tsunami", "tsunami"],
      ["Omnipower", "omnipower"],
      ["Corruption Blast", "corruption_blast"],
      ["Dragon Breath", "dragon_breath"],
    ] as const) {
      const slot = slotByName(magic, name);
      expect(slot.modelledBy, name).toBe("engine");
      expect(slot.spec?.id).toBe(id);
    }
  });
});

describe("specFromRecord", () => {
  it("builds multi-hit specs from explicit record structure only", () => {
    const record = abilityRecord("magic:greater-concentrated-blast");
    const spec = required(specFromRecord(record), `Could not model ${record.id}`);
    expect(spec.hits).toHaveLength(3);
    expect(spec.hits[0].band).toEqual({ minPct: 40, maxPct: 50 });
    expect(spec.adrenaline).toEqual({ gain: 9 });
    expect(spec.cooldownSeconds).toBeCloseTo(5.4, 5);
  });

  it("returns null for bandless records instead of fabricating damage", () => {
    expect(specFromRecord(abilityRecord("ranged:deaths-swiftness"))).toBeNull();
    expect(specFromRecord(abilityRecord("necromancy:living-death"))).toBeNull();
  });
});

describe("simulateRevolution", () => {
  it("rejects off-GCD utility abilities with a useful error", () => {
    const s = simulateRevolution({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      bar: [abilitySpec("runic_charge")],
      style: "magic",
      durationTicks: 30,
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("Runic Charge is off-GCD");
    expect(s.error).toContain("trigger it manually");
    expect(s.casts).toHaveLength(0);
  });

  it("fires the first ready bar ability per slot and holds channels for their full occupancy", () => {
    const modelled = revoModelled(barById("magic"));
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...modelled],
      bar: modelled,
      style: "magic",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].abilityId).toBe("greater_concentrated_blast");
    expect(s.casts[0].tick).toBe(0);
    expect(s.casts.some((cast) => cast.abilityId === "corruption_blast")).toBe(true);
    expect(s.casts.some((cast) => cast.abilityId === "asphyxiate")).toBe(true);
    // Asphyxiate's 7-tick channel: the next cast never starts inside it.
    s.casts.forEach((cast, i) => {
      if (cast.abilityId !== "asphyxiate" || i + 1 >= s.casts.length) return;
      expect(s.casts[i + 1].tick).toBeGreaterThanOrEqual(cast.tick + 7);
    });
  });

  it("skips unaffordable Berserk and spends lower-priority thresholds (no adren banking)", () => {
    const berserk = abilitySpec("berserk");
    const assault = abilitySpec("assault");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [berserk, assault],
      style: "melee",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    const firstSpend = required(
      s.casts.find((cast) => !cast.auto),
      "Expected a non-basic cast",
    );
    expect(firstSpend.abilityId).toBe("assault");
    const assaults = s.casts.filter((cast) => cast.abilityId === "assault").length;
    const berserks = s.casts.filter((cast) => cast.abilityId === "berserk").length;
    expect(assaults).toBeGreaterThan(0);
    expect(berserks).toBeLessThan(assaults);
  });

  it("pools basics until a lone ultimate is affordable, then fires it", () => {
    const sunshine = abilitySpec("greater_sunshine");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [sunshine],
      style: "magic",
      durationTicks: 48,
    });
    expect(s.ok).toBe(true);
    expect(
      s.casts.slice(0, 12).every((cast) => cast.abilityId === "magic_attack" && cast.auto),
    ).toBe(true);
    expect(s.casts[12].abilityId).toBe("greater_sunshine");
    expect(s.casts[12].tick).toBe(36);
    expect(s.casts[12].adrenalineAfter).toBe(0);
  });

  it("honours priority order — the same abilities in a different order cast differently", () => {
    const modelled = revoModelled(barById("magic"));
    const forward = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...modelled],
      bar: modelled,
      style: "magic",
      durationTicks: 24,
    });
    const reversed = [...modelled].reverse();
    const reverse = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...reversed],
      bar: reversed,
      style: "magic",
      durationTicks: 24,
    });
    expect(forward.ok && reverse.ok).toBe(true);
    const fwdIds = forward.casts.filter((c) => !c.auto).map((c) => c.abilityId);
    const revIds = reverse.casts.filter((c) => !c.auto).map((c) => c.abilityId);
    expect(fwdIds[0]).not.toBe(revIds[0]);
  });

  it("excludes burns landing at or after the horizon (half-open [0, horizonTicks))", () => {
    const combust = abilitySpec("combust");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [combust],
      style: "magic",
      durationTicks: 6,
    });
    expect(s.ok).toBe(true);
    // Combust @0 burns at 3,6,9,...: only the tick-3 burn lands inside; the woven
    // basic at 3 also lands. Nothing at tick >= 6 counts.
    expect(s.damageByTick[3]).toBeCloseTo(300 + 1000);
    expect(
      Object.keys(s.damageByTick)
        .map(Number)
        .every((t) => t < 6),
    ).toBe(true);
    expect(s.events.every((e) => e.tick < 6)).toBe(true);
    expect(s.perAbility["combust"]).toBeCloseTo(300);
    expect(s.dps).toBeCloseTo(1300 / (6 * TICK_SECONDS), 5);
  });

  it("fills a full 60s horizon with GCDs, basics, and horizon DPS", () => {
    const modelled = revoModelled(barById("melee-dual-wield"));
    const durationTicks = secondsToTicks(60);
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: modelled,
      style: "melee",
      durationTicks,
    });
    expect(s.ok).toBe(true);
    expect(s.horizonTicks).toBe(durationTicks);
    // Channels (Assault / Greater Flurry) hold their slots for 8 ticks, so the
    // cast count no longer tracks one cast per GCD.
    expect(s.casts.length).toBeGreaterThanOrEqual(25);
    expect(s.casts.some((c) => c.auto && c.abilityId === "attack")).toBe(true);
    expect(s.casts[s.casts.length - 1].tick).toBeLessThan(durationTicks);
    expect(s.dps).toBeCloseTo(s.totalExpected / (durationTicks * TICK_SECONDS), 5);
  });
});

describe("revolution buff uptimes", () => {
  it("applies Greater Sunshine's +50% only inside its 64-tick window", () => {
    const sunshine = abilitySpec("greater_sunshine");
    const s = simulateRevolution({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: [...ENGINE_SPECS.values()],
      bar: [sunshine],
      style: "magic",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    expect(s.casts[12].abilityId).toBe("greater_sunshine");
    const buffed = required(
      s.casts.find((cast) => cast.abilityId === "magic_attack" && cast.tick === 39),
      "Missing buffed magic attack",
    );
    expect(buffed.result.expected).toBeCloseTo(1499.7512437810944, 10);
    const expired = s.casts.filter((cast) => cast.abilityId === "magic_attack" && cast.tick >= 101);
    expect(expired.length).toBeGreaterThan(0);
    expect(expired.every((cast) => Math.abs(cast.result.expected - 1000) < 1e-9)).toBe(true);
  });

  it("applies Greater Death's Swiftness for exactly its 63-tick window", () => {
    const gds = abilitySpec("greater_deaths_swiftness");
    const s = simulateRevolution({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: [...ENGINE_SPECS.values()],
      bar: [gds],
      style: "ranged",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    expect(s.casts[12].abilityId).toBe("greater_deaths_swiftness");
    const buffed = required(
      s.casts.find((cast) => cast.abilityId === "ranged_attack" && cast.tick === 39),
      "Missing buffed ranged attack",
    );
    expect(buffed.result.expected).toBeCloseTo(1499.7512437810944, 10);
    const expired = s.casts.filter(
      (cast) => cast.abilityId === "ranged_attack" && cast.tick >= 102,
    );
    expect(expired.length).toBeGreaterThan(0);
    expect(expired.every((cast) => Math.abs(cast.result.expected - 1000) < 1e-9)).toBe(true);
  });
});

describe("golden 60s revo smoke", () => {
  const CASES: Array<{
    barId: string;
    style: "melee" | "ranged" | "magic" | "necromancy";
    basicId: string;
    weaves: boolean;
  }> = [
    { barId: "melee-dual-wield", style: "melee", basicId: "attack", weaves: true },
    { barId: "ranged", style: "ranged", basicId: "ranged_attack", weaves: true },
    // With channels holding occupancy, the magic bar fills every slot — no idle GCDs.
    { barId: "magic", style: "magic", basicId: "magic_attack", weaves: false },
    { barId: "necromancy", style: "necromancy", basicId: "necromancy_basic", weaves: true },
  ];

  for (const { barId, style, basicId, weaves } of CASES) {
    it(`${barId}: 60s horizon structural smoke`, () => {
      const bar = barById(barId);
      const modelled = revoModelled(bar);
      const durationTicks = secondsToTicks(60);
      expect(durationTicks).toBe(100);

      const s = simulateRevolution({
        ...baseInput,
        abilities: [...ENGINE_SPECS.values(), ...modelled],
        bar: modelled,
        style,
        durationTicks,
      });

      expect(s.ok).toBe(true);
      expect(s.casts.length).toBeGreaterThanOrEqual(25);
      expect(s.horizonTicks).toBe(100);
      expect(s.dps).toBeCloseTo(s.totalExpected / (100 * 0.6), 5);
      expect(s.casts.some((c) => c.auto && c.abilityId === basicId)).toBe(weaves);
    });
  }
});

describe("revolution — channels and horizon", () => {
  it("completes Assault's channel: next cast at castTick+8, full channel damage", () => {
    const assault = abilitySpec("assault");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [assault],
      style: "melee",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0",
      "attack@3",
      "attack@6",
      "assault@9",
      "attack@17",
    ]);
    expect(s.perAbility["assault"]).toBeCloseTo(4 * 1400);
  });

  it("completes Rapid Fire's channel: next cast at castTick+8, full channel damage", () => {
    const rapidFire = abilitySpec("rapid_fire");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [rapidFire],
      style: "ranged",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "ranged_attack@0",
      "ranged_attack@3",
      "ranged_attack@6",
      "rapid_fire@9",
      "ranged_attack@17",
    ]);
    expect(s.perAbility["rapid_fire"]).toBeCloseTo(8 * 800);
  });

  it("completes Asphyxiate's channel: next cast at castTick+7, full channel damage", () => {
    const asphyxiate = abilitySpec("asphyxiate");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [asphyxiate],
      style: "magic",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "magic_attack@0",
      "magic_attack@3",
      "magic_attack@6",
      "asphyxiate@9",
      "magic_attack@16",
      "magic_attack@19",
    ]);
    expect(s.perAbility["asphyxiate"]).toBeCloseTo(4 * 1300);
  });

  it("uses transformed Asphyxiate's eight-tick occupancy in Revolution", () => {
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [abilitySpec("asphyxiate")],
      style: "magic",
      durationTicks: 20,
      tumekensPieces: 4,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((cast) => `${cast.abilityId}@${cast.tick}`)).toEqual([
      "magic_attack@0",
      "magic_attack@3",
      "magic_attack@6",
      "asphyxiate@9",
      "magic_attack@17",
    ]);
    expect(s.perAbility.asphyxiate).toBeCloseTo(8 * 780);
  });

  it("counts events at horizon-1 but not at horizon or horizon+1 (half-open)", () => {
    const flurry = abilitySpec("flurry");
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [flurry],
      style: "melee",
      durationTicks: 13,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0",
      "attack@3",
      "attack@6",
      "flurry@9",
    ]);
    // Flurry @9 hits at 10..17: 10–12 land inside; 13 (the horizon) and later do not.
    expect(s.events.filter((e) => e.abilityId === "flurry").map((e) => e.tick)).toEqual([
      10, 11, 12,
    ]);
    expect(s.events.every((e) => e.tick < 13)).toBe(true);
    expect(s.perAbility["flurry"]).toBeCloseTo(3 * 650);
    expect(s.totalExpected).toBeCloseTo(3 * 1200 + 3 * 650);
    expect(s.dps).toBeCloseTo(s.totalExpected / (13 * TICK_SECONDS), 5);
  });

  it("a conjure summoned mid-horizon contributes only autos landing inside", () => {
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [abilitySpec("blood_siphon"), abilitySpec("conjure_skeleton_warrior")],
      style: "necromancy",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].abilityId).toBe("blood_siphon");
    expect(s.casts[1].abilityId).toBe("conjure_skeleton_warrior");
    // Blood Siphon occupies its full 9-tick channel before the conjure cast.
    expect(s.casts[1].tick).toBe(9);
    // Skeleton autos at 16, 21: only the first lands inside the horizon.
    expect(s.events.filter((e) => e.family === "conjureAuto").map((e) => e.tick)).toEqual([16]);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeCloseTo(250, 5);
    expect(s.damageByTick[20]).toBeUndefined();
  });

  it("matches the manual simulator's event stream for an equivalent rotation", () => {
    const assault = abilitySpec("assault");
    const revo = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [assault],
      style: "melee",
      durationTicks: 20,
    });
    const manual = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack", "attack", "attack", "assault", "attack"),
    });
    expect(revo.ok && manual.ok).toBe(true);
    expect(revo.events).toEqual(manual.events);
    expect(revo.totalExpected).toBeCloseTo(manual.totalExpected, 10);
  });

  it("reports totalExpectedIncludingTails only on request and never as DPS", () => {
    const combust = abilitySpec("combust");
    const input = {
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [combust],
      style: "magic" as const,
      durationTicks: 6,
    };
    const plain = simulateRevolution(input);
    expect(plain.totalExpectedIncludingTails).toBeUndefined();
    const withTails = simulateRevolution(input, { includeTails: true });
    // In-horizon: the tick-3 burn + woven basic. Tails: 9 unlanded burns × 300.
    expect(withTails.totalExpected).toBeCloseTo(1300);
    expect(withTails.totalExpectedIncludingTails).toBeCloseTo(4000);
    expect(withTails.dps).toBeCloseTo(1300 / (6 * TICK_SECONDS), 5);
  });
});
