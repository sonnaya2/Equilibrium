import { describe, expect, it } from "vitest";
import type { CombatModifier, ModifierStage } from "../types";
import {
  compileActiveModifiers,
  orderModifiers,
  runOrderedPipeline,
  runPipeline,
} from "./modifierPipeline";

const mod = (id: string, stage: ModifierStage, priority: number): CombatModifier => ({
  id,
  stage,
  priority,
  applies: () => true,
  apply: (s) => ({ ...s, damage: s.damage }),
  source: { source: "derived", url: "test", verifiedAt: "2026-07-24" },
});

describe("modifierPipeline", () => {
  it("orders by stage, then priority, deterministically", () => {
    const log: string[] = [];
    const spy = (m: CombatModifier): CombatModifier => ({
      ...m,
      apply: (s, context) => {
        log.push(m.id);
        return m.apply(s, context);
      },
    });
    runPipeline(
      { damage: 100 },
      [
        spy(mod("late", "onHit", 0)),
        spy(mod("base-p20", "base", 20)),
        spy(mod("base-p10", "base", 10)),
      ],
      { style: "melee" },
    );
    expect(log).toEqual(["base-p10", "base-p20", "late"]);
  });

  it("filters modifiers that do not apply to the context", () => {
    const skip: CombatModifier = {
      ...mod("skip", "base", 0),
      applies: () => false,
      apply: (s) => ({ ...s, damage: s.damage * 2 }),
    };
    expect(runPipeline({ damage: 100 }, [skip], { style: "melee" }).damage).toBe(100);
  });

  it("compileActiveModifiers matches order+filter of runPipeline", () => {
    const logOrdered: string[] = [];
    const logPipeline: string[] = [];
    const spy =
      (log: string[]) =>
      (m: CombatModifier): CombatModifier => ({
        ...m,
        apply: (s, context) => {
          log.push(m.id);
          return m.apply(s, context);
        },
      });
    const raw = [
      mod("late", "onHit", 0),
      mod("base-p20", "base", 20),
      { ...mod("skip", "ability", 0), applies: () => false },
      mod("base-p10", "base", 10),
    ];
    const ctx = { style: "melee" as const };
    const active = compileActiveModifiers(raw.map(spy(logOrdered)), ctx);
    runOrderedPipeline({ damage: 100 }, active, ctx, true);
    runPipeline({ damage: 100 }, raw.map(spy(logPipeline)), ctx);
    expect(logOrdered).toEqual(["base-p10", "base-p20", "late"]);
    expect(logPipeline).toEqual(logOrdered);
    expect(active.map((m) => m.id)).toEqual(["base-p10", "base-p20", "late"]);
  });

  it("orderModifiers is stable for equal stage+priority", () => {
    const a = mod("a", "onHit", 0);
    const b = mod("b", "onHit", 0);
    const c = mod("c", "onHit", 0);
    expect(orderModifiers([c, a, b]).map((m) => m.id)).toEqual(["c", "a", "b"]);
    expect(orderModifiers([c, a, b]).map((m) => m.id)).toEqual(
      orderModifiers([c, a, b]).map((m) => m.id),
    );
  });
});
