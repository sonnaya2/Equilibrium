import { describe, expect, it } from "vitest";
import { combatRevolutionBars, abilityById } from "../data";
import type { RevolutionBarRecord } from "../data/records";
import { resolveBar, specFromRecord } from "../data/specs";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { simulateRevolution } from "./revolution";
import { secondsToTicks, TICK_SECONDS } from "./timeline";

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

type BarExtras = {
  target?: "single" | "multi";
  mode?: "revo++" | "hybrid";
};
type RevolutionBarWithMeta = RevolutionBarRecord & BarExtras;

function barById(id: string): RevolutionBarWithMeta | undefined {
  return combatRevolutionBars.records.find((bar) => bar.id === id) as RevolutionBarWithMeta | undefined;
}

/** Revo-managed slots only — hybrid bars pad beyond revolutionSize for manual tail. */
function revoModelled(bar: RevolutionBarWithMeta) {
  const window =
    bar.mode === "hybrid"
      ? resolveBar(bar, ENGINE_SPECS).slice(0, bar.revolutionSize)
      : resolveBar(bar, ENGINE_SPECS);
  return window.filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
}

const BASIC_BY_STYLE = {
  melee: "attack",
  ranged: "ranged_attack",
  magic: "magic_attack",
  necromancy: "necromancy_basic",
} as const;

describe("resolveBar", () => {
  it("prefers engine specs over record adapters for the same ability", () => {
    const meleeBar = combatRevolutionBars.records.find((bar) => bar.id === "melee-dual-wield")!;
    const slots = resolveBar(meleeBar, ENGINE_SPECS);
    const rend = slots.find((slot) => slot.name === "Rend")!;
    expect(rend.modelledBy).toBe("engine");
    expect(rend.spec?.id).toBe("rend");
    const flurry = slots.find((slot) => slot.name === "Greater Flurry")!;
    expect(flurry.modelledBy).toBe("engine");
    expect(flurry.spec?.id).toBe("greater_flurry");
    const meteor = slots.find((slot) => slot.name === "Meteor Strike")!;
    expect(meteor.modelledBy).toBe("engine");
    expect(meteor.spec?.id).toBe("meteor_strike");
    expect(meteor.spec?.hits[0].band).toEqual({ minPct: 220, maxPct: 250 });
  });

  it("resolves Adaptive Strike by weapon setup and Sacrifice to the bar's style", () => {
    const dw = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "melee-dual-wield")!, ENGINE_SPECS);
    expect(dw.find((slot) => slot.name === "Adaptive Strike")!.spec?.id).toBe("adaptive_strike_dw");
    const th = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "melee-two-handed")!, ENGINE_SPECS);
    expect(th.find((slot) => slot.name === "Adaptive Strike")!.spec?.id).toBe("adaptive_strike_2h");

    // PvME ranged ST has no Sacrifice; necro ST does (shared record → bar style).
    const necro = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "necromancy")!, ENGINE_SPECS);
    const sacrifice = necro.find((slot) => slot.name === "Sacrifice")!;
    expect(sacrifice.modelledBy).toBe("record");
    expect(sacrifice.spec?.style).toBe("necromancy");
  });

  it("resolves magic PvME ST damage slots via engine specs", () => {
    const magic = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "magic")!, ENGINE_SPECS);
    for (const [name, id] of [
      ["Tsunami", "tsunami"],
      ["Omnipower", "omnipower"],
      ["Corruption Blast", "corruption_blast"],
      ["Dragon Breath", "dragon_breath"],
    ] as const) {
      const slot = magic.find((s) => s.name === name)!;
      expect(slot.modelledBy, name).toBe("engine");
      expect(slot.spec?.id).toBe(id);
    }
  });
});

describe("specFromRecord", () => {
  it("builds multi-hit specs from explicit record structure only", () => {
    const record = abilityById("magic:greater-concentrated-blast")!;
    const spec = specFromRecord(record)!;
    expect(spec.hits).toHaveLength(3);
    expect(spec.hits[0].band).toEqual({ minPct: 40, maxPct: 50 });
    expect(spec.adrenaline).toEqual({ gain: 9 });
    expect(spec.cooldownSeconds).toBeCloseTo(5.4, 5);
  });

  it("returns null for bandless records instead of fabricating damage", () => {
    // Buff-only ultimates carry no damagePercent — adapter must not invent hits.
    expect(specFromRecord(abilityById("ranged:deaths-swiftness")!)).toBeNull();
    expect(specFromRecord(abilityById("necromancy:living-death")!)).toBeNull();
  });
});

describe("simulateRevolution", () => {
  it("fires the first ready bar ability per slot and weaves basics through shortfalls", () => {
    const bar = combatRevolutionBars.records.find((candidate) => candidate.id === "magic")!;
    const modelled = resolveBar(bar, ENGINE_SPECS).filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...modelled],
      bar: modelled,
      style: "magic",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    // PvME: Greater Sunshine leads but is unaffordable at 0 adren — revo skips
    // Asphyxiate (threshold cost) to Greater Concentrated Blast (gain basic).
    expect(s.casts[0].abilityId).toBe("greater_concentrated_blast");
    expect(s.casts[0].tick).toBe(0);
    // Basics fill slots where nothing on the bar is ready.
    expect(s.casts.some((cast) => cast.abilityId === "magic_attack" && cast.auto)).toBe(true);
    // Cost abilities drain the pool whenever they are ready and affordable.
    expect(s.casts.some((cast) => cast.abilityId === "corruption_blast")).toBe(true);
    expect(s.casts.some((cast) => cast.abilityId === "asphyxiate")).toBe(true);
  });

  it("skips unaffordable Berserk and spends lower-priority thresholds (no adren banking)", () => {
    // Wiki Revolution: first *available* ability — insufficient adren is not
    // available. There is no special "save for Berserk" rule; Revo++ bars that
    // put Berserk first still fire cheaper enhanced/thresholds behind it, so
    // the ultimate often fires rarely (correct behaviour, not a sim bug).
    const berserk = ENGINE_SPECS.get("berserk")!;
    const assault = ENGINE_SPECS.get("assault")!; // 25% cost, short CD
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [berserk, assault],
      style: "melee",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    // First non-basic spend is Assault once ~25% adren is banked by basics —
    // Berserk (100%) is skipped while unaffordable.
    const firstSpend = s.casts.find((cast) => !cast.auto)!;
    expect(firstSpend.abilityId).toBe("assault");
    const assaults = s.casts.filter((cast) => cast.abilityId === "assault").length;
    const berserks = s.casts.filter((cast) => cast.abilityId === "berserk").length;
    expect(assaults).toBeGreaterThan(0);
    // Lower slots drain the pool; Berserk casts fewer times than Assault.
    expect(berserks).toBeLessThan(assaults);
  });

  it("pools basics until a lone ultimate is affordable, then fires it", () => {
    const sunshine = ENGINE_SPECS.get("greater_sunshine")!;
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [sunshine],
      style: "magic",
      durationTicks: 48,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.slice(0, 12).every((cast) => cast.abilityId === "magic_attack" && cast.auto)).toBe(true);
    expect(s.casts[12].abilityId).toBe("greater_sunshine");
    expect(s.casts[12].tick).toBe(36);
    // The 12th basic caps adrenaline at 100, so the 100% cost leaves nothing.
    expect(s.casts[12].adrenalineAfter).toBe(0);
  });

  it("honours priority order — the same abilities in a different order cast differently", () => {
    const bar = combatRevolutionBars.records.find((candidate) => candidate.id === "magic")!;
    const modelled = resolveBar(bar, ENGINE_SPECS).filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
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
    // Same kit, different priority order → different first non-auto cast id or tick stream.
    const fwdIds = forward.casts.filter((c) => !c.auto).map((c) => c.abilityId);
    const revIds = reverse.casts.filter((c) => !c.auto).map((c) => c.abilityId);
    expect(fwdIds[0]).not.toBe(revIds[0]);
  });

  it("lands Combust burn hits on their sourced ticks past the horizon", () => {
    const combust = ENGINE_SPECS.get("combust")!;
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [combust],
      style: "magic",
      durationTicks: 6,
    });
    expect(s.ok).toBe(true);
    const burnTicks = Object.keys(s.damageByTick).map(Number).filter((tick) => tick > 0);
    expect(Math.max(...burnTicks)).toBeGreaterThan(6);
  });

  it("fills a full 60s horizon with GCDs, basics, and horizon DPS", () => {
    const bar = combatRevolutionBars.records.find((candidate) => candidate.id === "melee-dual-wield")!;
    const modelled = resolveBar(bar, ENGINE_SPECS)
      .filter((slot) => slot.spec !== null)
      .map((slot) => slot.spec!);
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
    // ~34 GCDs in 60s at 3 ticks each (0..99).
    expect(s.casts.length).toBeGreaterThanOrEqual(30);
    expect(s.casts.some((c) => c.auto && c.abilityId === "attack")).toBe(true);
    // Last cast starts before the horizon ends.
    expect(s.casts[s.casts.length - 1].tick).toBeLessThan(durationTicks);
    // DPS is total / 60s, not total / last-GCD-edge.
    expect(s.dps).toBeCloseTo(s.totalExpected / (durationTicks * TICK_SECONDS), 5);
  });
});

describe("revolution buff uptimes", () => {
  it("applies Greater Sunshine's +50% only inside its 64-tick window", () => {
    const sunshine = ENGINE_SPECS.get("greater_sunshine")!;
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
    expect(s.casts[12].abilityId).toBe("greater_sunshine"); // funded at tick 36
    const buffed = s.casts.find((cast) => cast.abilityId === "magic_attack" && cast.tick === 39)!;
    expect(buffed.result.expected).toBeCloseTo(1500);
    const expired = s.casts.filter((cast) => cast.abilityId === "magic_attack" && cast.tick >= 101);
    expect(expired.length).toBeGreaterThan(0);
    expect(expired.every((cast) => Math.abs(cast.result.expected - 1000) < 1e-9)).toBe(true);
  });

  it("applies Greater Death's Swiftness for exactly its 63-tick window", () => {
    const gds = ENGINE_SPECS.get("greater_deaths_swiftness")!;
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
    expect(s.casts[12].abilityId).toBe("greater_deaths_swiftness"); // tick 36
    const buffed = s.casts.find((cast) => cast.abilityId === "ranged_attack" && cast.tick === 39)!;
    expect(buffed.result.expected).toBeCloseTo(1500);
    // Buff runs 37..99 (cast+1 through cast+62); basics at 102+ are unbuffed.
    const expired = s.casts.filter((cast) => cast.abilityId === "ranged_attack" && cast.tick >= 102);
    expect(expired.length).toBeGreaterThan(0);
    expect(expired.every((cast) => Math.abs(cast.result.expected - 1000) < 1e-9)).toBe(true);
  });
});

/** Structural 60s revo smoke — loadout-independent; do not pin damage numbers. */
describe("golden 60s revo smoke", () => {
  const CASES: Array<{
    barId: string;
    style: "melee" | "ranged" | "magic" | "necromancy";
    basicId: string;
  }> = [
    { barId: "melee-dual-wield", style: "melee", basicId: "attack" },
    { barId: "ranged", style: "ranged", basicId: "ranged_attack" },
    { barId: "magic", style: "magic", basicId: "magic_attack" },
    { barId: "necromancy", style: "necromancy", basicId: "necromancy_basic" },
  ];

  for (const { barId, style, basicId } of CASES) {
    it(`${barId}: 60s horizon structural smoke`, () => {
      const bar = barById(barId)!;
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
      // Style autoAttack / necro basic weaves when bar has nothing ready.
      expect(s.casts.some((c) => c.auto && c.abilityId === basicId)).toBe(true);
    });
  }

  it("multi-target bar: 60s structural smoke when a supported multi bar exists", () => {
    const multi = (combatRevolutionBars.records as RevolutionBarWithMeta[]).find(
      (bar) => bar.target === "multi" && bar.supported,
    );
    if (!multi) return; // multi corpus not landed yet

    const modelled = revoModelled(multi);
    // Need a real revo window — skip if almost nothing is modelled yet.
    if (modelled.length < 3) return;

    const style = multi.style as keyof typeof BASIC_BY_STYLE;
    const basicId = BASIC_BY_STYLE[style];
    if (!basicId) return;

    const durationTicks = secondsToTicks(60);
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
    expect(s.casts.some((c) => c.auto && c.abilityId === basicId)).toBe(true);
  });

  it("hybrid bar: sim uses revo window slice only (structural)", () => {
    const hybrid = (combatRevolutionBars.records as RevolutionBarWithMeta[]).find(
      (bar) => bar.mode === "hybrid" && bar.supported,
    );
    if (!hybrid) return;

    const full = resolveBar(hybrid, ENGINE_SPECS);
    expect(full.length).toBeGreaterThan(hybrid.revolutionSize);
    const revoWindow = full.slice(0, hybrid.revolutionSize);
    expect(revoWindow).toHaveLength(hybrid.revolutionSize);

    const modelled = revoModelled(hybrid);
    if (modelled.length < 3) return;

    const style = hybrid.style as keyof typeof BASIC_BY_STYLE;
    if (!BASIC_BY_STYLE[style]) return;

    const durationTicks = secondsToTicks(60);
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...modelled],
      bar: modelled,
      style,
      durationTicks,
    });
    // Structural only — hybrid windows often put Attack on the bar, so auto weave is not guaranteed.
    expect(s.ok).toBe(true);
    expect(s.casts.length).toBeGreaterThanOrEqual(25);
    expect(s.horizonTicks).toBe(durationTicks);
    expect(s.dps).toBeCloseTo(s.totalExpected / (durationTicks * TICK_SECONDS), 5);
  });
});
