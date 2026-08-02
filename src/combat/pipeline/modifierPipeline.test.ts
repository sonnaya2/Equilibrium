import { describe, expect, it } from "vitest";
import type { CombatModifier, ModifierStage } from "../types";
import { runPipeline } from "./modifierPipeline";

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
});
