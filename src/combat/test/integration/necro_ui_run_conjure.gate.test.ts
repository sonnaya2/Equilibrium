/**
 * Gate: UI Run path must summon conjures with death/omni-guard + soulbound lantern.
 * Mirrors RevolutionPanel: loadoutStats -> model -> pack -> revo++ bar -> runUiRevolution.
 */
import { describe, expect, it } from "vitest";
import { SPIRIT_AUTO_ABILITY_ID } from "../../styles/necromancy/conjures";
import { packSimBaseFromModel } from "../../solver/packRequest";
import { runUiRevolution } from "../../solver/worker/uiRunHost";
import {
  DEFAULT_LOADOUT,
  equipInSlot,
  type Loadout,
} from "@/components/combat/loadout/model";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import {
  pickBarForLoadout,
  revoManagedModelled,
  SUPPORTED_BARS,
} from "@/components/combat/revoBarResolve";

const NOW = 1_700_000_000_000;

const CONJURE_IDS = [
  "conjure_undead_army",
  "conjure_skeleton_warrior",
  "conjure_vengeful_ghost",
  "conjure_putrid_zombie",
  "conjure_phantom_guardian",
] as const;

const COMMAND_IDS = [
  "command_skeleton_warrior",
  "command_vengeful_ghost",
  "command_putrid_zombie",
  "command_phantom_guardian",
] as const;

function spiritDamage(perAbility: Readonly<Record<string, number>>): number {
  return (
    (perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0) +
    (perAbility[SPIRIT_AUTO_ABILITY_ID.vengeful_ghost] ?? 0) +
    (perAbility[SPIRIT_AUTO_ABILITY_ID.putrid_zombie] ?? 0) +
    (perAbility[SPIRIT_AUTO_ABILITY_ID.phantom_guardian] ?? 0) +
    (perAbility.spirit_putrid_zombie_poison ?? 0)
  );
}

function assertCommandMorphIfPresent(summary: {
  casts: readonly { abilityId: string }[];
  events: readonly { family: string }[];
}): void {
  // In-game conjure icon swaps to command when spirit is up; bar still stores conjure ids.
  // Soft assert only when revo already casts command_* (sibling may land morph).
  const commandCasts = summary.casts.filter((c) => c.abilityId.startsWith("command_"));
  if (commandCasts.length === 0) return;
  expect(summary.events.some((e) => e.family === "command")).toBe(true);
  expect(
    commandCasts.every((c) => (COMMAND_IDS as readonly string[]).includes(c.abilityId)),
  ).toBe(true);
}

async function uiRunConjurePath(loadout: Loadout) {
  const stats = loadoutStats(loadout, { now: NOW });
  const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
  const packed = packSimBaseFromModel(model);

  expect(stats.weaponConfiguration).toBe("necromancy");
  expect(model.weaponConfiguration).toBe("necromancy");
  expect(packed.weaponConfiguration).toBe("necromancy");

  const necroBars = SUPPORTED_BARS.filter(
    (b) => b.style === "necromancy" && b.mode === "revo++",
  );
  expect(necroBars.length).toBeGreaterThan(0);

  const bar =
    pickBarForLoadout("necromancy", stats.weaponConfiguration) ??
    pickBarForLoadout("necromancy") ??
    necroBars[0]!;
  expect(bar.style).toBe("necromancy");
  expect(bar.mode).toBe("revo++");

  const modelled = revoManagedModelled(bar, stats.weaponConfiguration, {
    passiveIds: stats.equipmentEffects.passiveIds,
    equipmentIds: stats.equipmentIds,
  });
  const modelledIds = modelled.map((a) => a.id);
  const conjureOnBar = modelledIds.filter((id) =>
    (CONJURE_IDS as readonly string[]).includes(id),
  );
  expect(conjureOnBar.length, `modelled: ${modelledIds.join(",")}`).toBeGreaterThan(0);

  const { summary } = await runUiRevolution(
    {
      loadout: packed,
      barIds: modelledIds.filter(Boolean),
      style: "necromancy",
      durationTicks: 100,
    },
    { forceMainThread: true },
  );

  expect(summary.ok).toBe(true);
  expect(summary.error).toBeUndefined();

  const conjureCasts = summary.casts.filter((c) =>
    (CONJURE_IDS as readonly string[]).includes(c.abilityId),
  );
  expect(conjureCasts.length, "UI Run must cast at least one conjure").toBeGreaterThan(0);

  const autos = summary.events.filter((e) => e.family === "conjureAuto");
  expect(autos.length, "spirit autos must land").toBeGreaterThan(0);

  const fromSpirits = spiritDamage(summary.perAbility);
  expect(fromSpirits).toBeGreaterThan(0);
  expect(summary.totalExpected).toBeGreaterThan(0);

  assertCommandMorphIfPresent(summary);
  return { stats, model, packed, summary, modelledIds, conjureOnBar };
}

describe("UI Run necro conjure gate", () => {
  it("omni-guard + soulbound lantern: pack WC necromancy, revo++ conjures, run summons + spirit damage", async () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:omni-guard");
    loadout = equipInSlot(loadout, "offhand", "item:soulbound-lantern");
    // Store may still say dualwield; resolved sim shape must be necromancy.
    expect(loadout.style).toBe("necromancy");
    expect(loadout.weaponConfiguration).toBe("dualwield");

    const { conjureOnBar, summary } = await uiRunConjurePath(loadout);
    expect(conjureOnBar).toEqual(expect.arrayContaining(["conjure_undead_army"]));
    expect(summary.casts.some((c) => c.abilityId === "conjure_undead_army")).toBe(true);
  });

  it("deathguard-t90 + soulbound lantern also summons via UI Run", async () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:deathguard-t90");
    loadout = equipInSlot(loadout, "offhand", "item:soulbound-lantern");
    expect(loadout.style).toBe("necromancy");

    await uiRunConjurePath(loadout);
  });
});
