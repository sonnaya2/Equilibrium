import { describe, expect, it } from "vitest";
import { isCombatUpgradeCategory } from "./combatClassification";

describe("isCombatUpgradeCategory", () => {
  it("accepts deliberate combat categories", () => {
    expect(isCombatUpgradeCategory("combat Archaeology relic")).toBe(true);
    expect(isCombatUpgradeCategory("BiS armour permanent upgrade / T92 masterwork")).toBe(true);
    expect(isCombatUpgradeCategory("best-in-slot dual-wield melee weapons")).toBe(true);
    expect(isCombatUpgradeCategory("Magic dual-wield best-in-slot weapons")).toBe(true);
    expect(isCombatUpgradeCategory("regional boss BiS drop source")).toBe(true);
    expect(isCombatUpgradeCategory("PvM hub combat infrastructure")).toBe(true);
    expect(isCombatUpgradeCategory("Daemonheim ring")).toBe(true);
    expect(isCombatUpgradeCategory("upgraded Fremennik ring (channel/crit support)")).toBe(true);
    expect(isCombatUpgradeCategory("tier-90 dual-wield ranged weapons")).toBe(true);
    expect(isCombatUpgradeCategory("GWD2 residual dual-wield melee weapons")).toBe(true);
  });

  it("rejects skilling-only rows that used to match bare ring/cape/relic words", () => {
    expect(isCombatUpgradeCategory("Firemaking XP ring")).toBe(false);
    expect(isCombatUpgradeCategory("invisible Divination level ring")).toBe(false);
    expect(isCombatUpgradeCategory("Lumbridge achievement skilling utility ring")).toBe(false);
    expect(isCombatUpgradeCategory("permanent endgame skilling cape")).toBe(false);
    expect(isCombatUpgradeCategory("Herblore production amulet")).toBe(false);
    expect(isCombatUpgradeCategory("Archaeology monolith relic power")).toBe(false);
    expect(isCombatUpgradeCategory("Hunter charm gathering")).toBe(false);
    expect(isCombatUpgradeCategory("Divination gathering colony")).toBe(false);
    expect(isCombatUpgradeCategory("Dungeoneering resource dungeon (trees + promethium)")).toBe(
      false,
    );
    expect(isCombatUpgradeCategory("Karamja TzHaar teleport ring and skilling travel tool")).toBe(
      false,
    );
  });

  it("does not classify on bare wearable words alone", () => {
    expect(isCombatUpgradeCategory("ring")).toBe(false);
    expect(isCombatUpgradeCategory("cape")).toBe(false);
    expect(isCombatUpgradeCategory("amulet")).toBe(false);
    expect(isCombatUpgradeCategory("relic")).toBe(false);
    expect(isCombatUpgradeCategory("boss")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isCombatUpgradeCategory("")).toBe(false);
    expect(isCombatUpgradeCategory("   ")).toBe(false);
  });
});
