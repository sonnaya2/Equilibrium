import { describe, expect, it } from "vitest";
import { combatRevolutionBars, abilityById } from "../../data";
import type { RevolutionBarRecord } from "../../data/records";
import { resolveBar, specFromRecord } from "../../data/specs";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { SHARED_CONSTITUTION_ABILITIES } from "../../styles/shared/constitutionAbilities";
import { rotationOf } from "./contracts";
import {
  compareRevolutionWithVigour,
  diagnoseStrictPriorityResourceDivergence,
  STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION,
  simulateRevolution,
} from "./revolution";
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
    ...SHARED_CONSTITUTION_ABILITIES,
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

/** Catalogue + bar specs; bar stamps win (shared Constitution style remap). */
function abilitiesForRevo(modelled: ReturnType<typeof revoModelled>) {
  const byId = new Map(ENGINE_SPECS);
  for (const spec of modelled) byId.set(spec.id, spec);
  return [...byId.values()];
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
    expect(sacrifice.modelledBy).toBe("engine");
    expect(sacrifice.spec?.id).toBe("sacrifice");
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
  it("rejects multi-hit records (no band-N fabrication)", () => {
    const record = abilityRecord("magic:greater-concentrated-blast");
    expect(specFromRecord(record)).toBeNull();
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
      abilities: abilitiesForRevo(modelled),
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
      abilities: abilitiesForRevo(modelled),
      bar: modelled,
      style: "magic",
      durationTicks: 24,
    });
    const reversed = [...modelled].reverse();
    const reverse = simulateRevolution({
      ...baseInput,
      abilities: abilitiesForRevo(reversed),
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
    // With channels holding occupancy, the magic bar fills every slot - no idle GCDs.
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
        abilities: abilitiesForRevo(modelled),
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
    // Flurry @9 hits at 10..17: 10-12 land inside; 13 (the horizon) and later do not.
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

/**
 * Post-summon spirit management under Revolution (beyond pool eligibility).
 * Summon schedules tracks; advanceTo / channel occupancy / terminal drain land
 * autos; commands gate on active conjure; re-summon after expiry re-keys tracks.
 */
describe("revolution — conjure post-summon management", () => {
  const necroRevo = {
    ...baseInput,
    abilities: [...ENGINE_SPECS.values()],
    style: "necromancy" as const,
    weaponConfiguration: "necromancy" as const,
  };

  it("summons then auto-attacks on skeleton cadence (7 then every 5)", () => {
    const s = simulateRevolution({
      ...necroRevo,
      bar: [abilitySpec("conjure_skeleton_warrior")],
      durationTicks: 40,
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("conjure_skeleton_warrior");
    const autos = s.events.filter((e) => e.family === "conjureAuto").map((e) => e.tick);
    // First auto cast+7; interval 5 through exclusive end of horizon.
    expect(autos).toEqual([7, 12, 17, 22, 27, 32, 37]);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.analysis.bySource.some((r) => r.kind === "conjure-or-familiar" && r.damage > 0)).toBe(
      true,
    );
  });

  it("command skeleton waits for active conjure and the 6-tick initial lockout", () => {
    // Short horizon: one command only (wiki 15s CD ≈ 25 ticks).
    // Wiki PvME necro revo++ bar has no command_* slots (conjure sequence replaces
    // the conjure icon in-game). Custom bars that place command_* on managed slots
    // fire when the spirit is active and the initial lockout has elapsed.
    const s = simulateRevolution({
      ...necroRevo,
      bar: [abilitySpec("command_skeleton_warrior"), abilitySpec("conjure_skeleton_warrior")],
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`).slice(0, 4)).toEqual([
      "conjure_skeleton_warrior@0",
      "necromancy_basic@3",
      "command_skeleton_warrior@6",
      "necromancy_basic@9",
    ]);
    expect(s.casts.filter((c) => c.abilityId === "command_skeleton_warrior")).toHaveLength(1);
    // Command hits land at activation+2..+11; initial lockout blocked earlier ticks.
    const cmdHits = s.events.filter((e) => e.abilityId === "command_skeleton_warrior");
    expect(cmdHits.map((e) => e.tick)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("command putrid zombie waits for active conjure + 6-tick lockout, then explodes (ST)", () => {
    // Wiki: command first legal @6; explosion at cast+4; dismisses zombie.
    // ST model: one 360-440% hit on the primary target (area unmodelled).
    const s = simulateRevolution({
      ...necroRevo,
      bar: [abilitySpec("command_putrid_zombie"), abilitySpec("conjure_putrid_zombie")],
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`).slice(0, 4)).toEqual([
      "conjure_putrid_zombie@0",
      "necromancy_basic@3",
      "command_putrid_zombie@6",
      "necromancy_basic@9",
    ]);
    expect(s.casts.filter((c) => c.abilityId === "command_putrid_zombie")).toHaveLength(1);
    const explode = s.events.filter((e) => e.abilityId === "command_putrid_zombie");
    expect(explode).toHaveLength(1);
    expect(explode[0]!.tick).toBe(10);
    expect(explode[0]!.family).toBe("command");
    expect(explode[0]!.damage.expected).toBeGreaterThan(0);
    expect(s.perAbility["command_putrid_zombie"]).toBeGreaterThan(0);
    // After command, revo cannot cast command again (zombie dismissed; no spirit).
    expect(s.casts.filter((c) => c.abilityId === "command_putrid_zombie")).toHaveLength(1);
  });

  it("undead army schedules three spirit auto tracks and zombie poison", () => {
    const s = simulateRevolution({
      ...necroRevo,
      bar: [abilitySpec("conjure_undead_army")],
      durationTicks: 40,
    });
    expect(s.ok).toBe(true);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_vengeful_ghost"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_putrid_zombie"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_putrid_zombie_poison"]).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.family === "conjureAuto").length).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.family === "poison").length).toBeGreaterThan(0);
  });

  it("re-summons after Spirit Pact expiry and restarts auto cadence", () => {
    // SP3 exclusive until = cast + 105; second summon at 105 with first auto at 112.
    const s = simulateRevolution({
      ...necroRevo,
      bar: [abilitySpec("conjure_skeleton_warrior")],
      durationTicks: 130,
    });
    expect(s.ok).toBe(true);
    const skelCasts = s.casts.filter((c) => c.abilityId === "conjure_skeleton_warrior");
    expect(skelCasts.map((c) => c.tick)).toEqual([0, 105]);
    const autos = s.events.filter((e) => e.family === "conjureAuto").map((e) => e.tick);
    expect(autos).toContain(102);
    expect(autos).toContain(112);
    expect(autos.filter((t) => t >= 112)).toEqual([112, 117, 122, 127]);
  });

  it("70s+ revo with Undead Army early on bar casts army again after SP3 expiry", () => {
    // 70s = 117 ticks; exclusive SP3 end at cast+105 so second army is in-horizon.
    // 60s (100 ticks) ends before expiry - only one army cast (product "no re-summon" report).
    const short = simulateRevolution({
      ...necroRevo,
      bar: [
        abilitySpec("conjure_undead_army"),
        abilitySpec("touch_of_death"),
        abilitySpec("soul_sap"),
      ],
      durationTicks: 100,
    });
    expect(short.ok).toBe(true);
    expect(short.casts.filter((c) => c.abilityId === "conjure_undead_army")).toHaveLength(1);

    const s = simulateRevolution({
      ...necroRevo,
      bar: [
        abilitySpec("conjure_undead_army"),
        abilitySpec("touch_of_death"),
        abilitySpec("soul_sap"),
      ],
      durationTicks: 117,
    });
    expect(s.ok).toBe(true);
    const armyCasts = s.casts.filter((c) => c.abilityId === "conjure_undead_army");
    expect(armyCasts.map((c) => c.tick)).toEqual([0, 105]);
    // Timeline/events: both summons present; second life restarts spirit autos.
    expect(armyCasts).toHaveLength(2);
    const autos = s.events.filter((e) => e.family === "conjureAuto");
    expect(autos.some((e) => e.tick < 105)).toBe(true);
    expect(autos.some((e) => e.tick > 105)).toBe(true);
    expect(s.perAbility["spirit_skeleton_warrior"] ?? 0).toBeGreaterThan(0);
    expect(s.perAbility["spirit_vengeful_ghost"] ?? 0).toBeGreaterThan(0);
    expect(s.perAbility["spirit_putrid_zombie"] ?? 0).toBeGreaterThan(0);
  });

  it("score-only totals include spirit auto EV (presentation ledgers empty)", () => {
    const input = {
      ...necroRevo,
      bar: [abilitySpec("conjure_skeleton_warrior")],
      durationTicks: 40,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const score = simulateRevolution(input, { detailLevel: "score-only" });
    expect(full.ok && score.ok).toBe(true);
    expect(score.totalExpected).toBeCloseTo(full.totalExpected, 10);
    expect(full.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    // Score-only omits perAbility / event history by design; damage still lands.
    expect(score.perAbility["spirit_skeleton_warrior"]).toBeUndefined();
    expect(score.events).toEqual([]);
  });
});

describe("strict-priority resource divergence (Vigour)", () => {
  const revoBase = {
    ...baseInput,
    abilities: [...ENGINE_SPECS.values()],
    style: "magic" as const,
    durationTicks: 120,
  };

  it("badly ordered threshold under ult diverges and names the spender (not a passive penalty)", () => {
    // Ult first then 25% threshold: Vigour refund advances when wild_magic is affordable.
    // Strict priority spends the extra adren on wild_magic - diagnostic names that spender.
    const bar = [abilitySpec("sunshine"), abilitySpec("wild_magic")];
    const { off, on, divergence } = compareRevolutionWithVigour({
      ...revoBase,
      bar,
      startingAdrenaline: 100,
    });
    expect(off.ok && on.ok).toBe(true);
    expect(divergence, "expected selection divergence under Vigour").not.toBeNull();
    expect(divergence!.kind).toBe("strict-priority-resource-divergence");
    expect(divergence!.explanation).toBe(STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION);
    expect(divergence!.explanation).toMatch(/not a passive damage penalty/i);
    // Off still weaving a basic; On already spends wild_magic with the extra adren.
    expect(divergence!.abilityOff).toBe("magic_attack");
    expect(divergence!.abilityOn).toBe("wild_magic");
    expect(divergence!.adrenBeforeOn).toBeGreaterThan(divergence!.adrenBeforeOff);
    expect(divergence!.tick).toBeGreaterThan(0);
  });

  it("no-RNG controlled bar without an extra spender cannot lose unconditional damage from Vigour", () => {
    // Permanent flag (ringOfVigour), same gear, single ult - no secondary threshold to re-spend residual.
    const bar = [abilitySpec("sunshine")];
    const { off, on, divergence } = compareRevolutionWithVigour({
      ...revoBase,
      bar,
      startingAdrenaline: 100,
      // Explicit permanent-path flag already OR-resolved into adrenaline.ringOfVigour.
      adrenaline: { ringOfVigour: true },
    });
    expect(off.ok && on.ok).toBe(true);
    expect(divergence).toBeNull();
    // Unconditional E[D]: Vigour must not reduce damage when nothing else spends the residual.
    expect(on.totalExpected).toBeGreaterThanOrEqual(off.totalExpected - 1e-6);
    // Sequences match ability-for-ability at each cast tick.
    expect(off.casts.map((c) => `${c.tick}:${c.abilityId}`)).toEqual(
      on.casts.map((c) => `${c.tick}:${c.abilityId}`),
    );
  });

  it("diagnoseStrictPriorityResourceDivergence is pure over cast logs", () => {
    const offCasts = [
      { tick: 0, abilityId: "sunshine", adrenalineBefore: 100, adrenalineAfter: 0 },
      { tick: 9, abilityId: "magic_attack", adrenalineBefore: 18, adrenalineAfter: 27 },
    ];
    const onCasts = [
      { tick: 0, abilityId: "sunshine", adrenalineBefore: 100, adrenalineAfter: 10 },
      { tick: 9, abilityId: "wild_magic", adrenalineBefore: 28, adrenalineAfter: 3 },
    ];
    const d = diagnoseStrictPriorityResourceDivergence(
      { casts: offCasts as never },
      { casts: onCasts as never },
    );
    expect(d).toMatchObject({
      kind: "strict-priority-resource-divergence",
      tick: 9,
      abilityOff: "magic_attack",
      abilityOn: "wild_magic",
      adrenBeforeOff: 18,
      adrenBeforeOn: 28,
    });
  });
});
