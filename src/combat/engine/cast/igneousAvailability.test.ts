import { describe, expect, it } from "vitest";
import { baseInput, magicInput, necroInput, rangedInput } from "../../test/fixtures/inputs";
import { firstLegalTick } from "../runtime/state";
import { simulateRevolution } from "../simulation/revolution";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { createCastContext, simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";

function ability(list: readonly { id: string }[], id: string) {
  const found = list.find((a) => a.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found as (typeof MELEE_ABILITIES)[number];
}

describe("igneous cast legality and shared cooldown", () => {
  const pairs = [
    {
      label: "overpower",
      input: baseInput,
      abilities: MELEE_ABILITIES,
      baseId: "overpower",
      igneousId: "overpower_igneous",
      cape: "item:igneous-kal-ket",
      unlockMessage: "Requires Igneous Kal-Ket or Igneous Kal-Zuk",
      style: "melee" as const,
    },
    {
      label: "deadshot",
      input: rangedInput,
      abilities: RANGED_ABILITIES,
      baseId: "deadshot",
      igneousId: "deadshot_igneous",
      cape: "item:igneous-kal-xil",
      unlockMessage: "Requires Igneous Kal-Xil or Igneous Kal-Zuk",
      style: "ranged" as const,
    },
    {
      label: "omnipower",
      input: magicInput,
      abilities: MAGIC_ABILITIES,
      baseId: "omnipower",
      igneousId: "omnipower_igneous",
      cape: "item:igneous-kal-mej",
      unlockMessage: "Requires Igneous Kal-Mej or Igneous Kal-Zuk",
      style: "magic" as const,
    },
    {
      label: "death_skulls",
      input: necroInput,
      abilities: NECROMANCY_ABILITIES,
      baseId: "death_skulls",
      igneousId: "death_skulls_igneous",
      cape: "item:igneous-kal-mor",
      unlockMessage: "Requires Igneous Kal-Mor or Igneous Kal-Zuk",
      style: "necromancy" as const,
    },
  ];

  for (const p of pairs) {
    it(`${p.label}: rejects locked upgrade without mutating state`, () => {
      const igneous = ability(p.abilities, p.igneousId);
      const without = createCastContext({
        ...p.input,
        abilities: p.abilities,
        startingAdrenaline: 100,
      });
      const before = structuredClone(without.getState());
      expect(without.performCast(igneous, 0, false)).toMatchObject({
        ok: false,
        error: p.unlockMessage,
      });
      expect(without.getState()).toEqual(before);
    });

    it(`${p.label}: style cape unlocks cast and shares cooldown with base`, () => {
      const base = ability(p.abilities, p.baseId);
      const igneous = ability(p.abilities, p.igneousId);
      const effects = activeEquipmentEffects({ equipmentSlots: { cape: p.cape } });
      const withCape = createCastContext({
        ...p.input,
        abilities: p.abilities,
        startingAdrenaline: 100,
        equipmentIds: [p.cape],
        equipmentEffects: effects,
      });
      expect(withCape.performCast(igneous, 0, false).ok).toBe(true);
      const cdTicks = p.label === "death_skulls" ? 100 : 50;
      expect(firstLegalTick(withCape.getState(), base.id, base.replacementGroup)).toBe(cdTicks);
    });

    it(`${p.label}: Kal-Zuk unlocks the upgrade`, () => {
      const igneous = ability(p.abilities, p.igneousId);
      const effects = activeEquipmentEffects({
        equipmentSlots: { cape: "item:igneous-kal-zuk" },
      });
      const withZuk = createCastContext({
        ...p.input,
        abilities: p.abilities,
        startingAdrenaline: 100,
        equipmentIds: ["item:igneous-kal-zuk"],
        equipmentEffects: effects,
      });
      expect(withZuk.performCast(igneous, 0, false).ok).toBe(true);
    });

    it(`${p.label}: revolution skips locked upgrade`, () => {
      const igneous = ability(p.abilities, p.igneousId);
      const revo = simulateRevolution({
        ...p.input,
        abilities: p.abilities,
        startingAdrenaline: 100,
        bar: [igneous],
        style: p.style,
        durationTicks: 7,
      });
      expect(revo.ok).toBe(true);
      expect(revo.casts.every((cast) => cast.abilityId !== p.igneousId)).toBe(true);
    });
  }

  it("removing cape between runs does not leak prior capability", () => {
    const igneous = ability(MELEE_ABILITIES, "overpower_igneous");
    const withCape = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: ["item:igneous-kal-ket"],
      equipmentEffects: activeEquipmentEffects({
        equipmentSlots: { cape: "item:igneous-kal-ket" },
      }),
    });
    expect(withCape.performCast(igneous, 0, false).ok).toBe(true);

    const without = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
    });
    expect(without.performCast(igneous, 0, false).ok).toBe(false);
  });
});

describe("death_skulls_igneous bounce schedule", () => {
  it("schedules initial + 3 derived hits at two-tick intervals", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-mor" },
    });
    const s = simulate({
      ...necroInput,
      abilities: NECROMANCY_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: ["item:igneous-kal-mor"],
      equipmentEffects: effects,
      rotation: rotationOf("death_skulls_igneous"),
    });
    expect(s.ok).toBe(true);
    const events = s.events.filter((e) => e.abilityId === "death_skulls_igneous");
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.tick)).toEqual([0, 2, 4, 6]);
    const initial = events[0]!;
    for (const bounce of events.slice(1)) {
      expect(bounce.derivedFrom).toBe(initial.seq);
      expect(bounce.damage.expected).toBe(initial.damage.expected);
    }
  });
});
