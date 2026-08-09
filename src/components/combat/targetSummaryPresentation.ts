import type { LoadoutTarget } from "./loadout/model";
import { presetLabel, targetPresetIconPath } from "./targetPresetUi";

export interface TargetSummaryView {
  name: string;
  iconSrc: string | null;
  defenceLevel: number;
  armour: number;
  affinity: number;
  maximumLifePoints: number | null;
  flags: string[];
  modifiedHint: string | null;
}

export function targetSummaryView(
  target: LoadoutTarget | null,
  options?: { modified?: boolean },
): TargetSummaryView | null {
  if (!target) return null;
  const name = target.targetPresetId
    ? (presetLabel(target.targetPresetId) ?? target.targetPresetId)
    : "Custom NPC";
  const iconSrc = target.targetPresetId
    ? targetPresetIconPath(presetLabel(target.targetPresetId) ?? "")
    : null;
  const flags = [
    target.dragon ? "Dragon" : null,
    target.undead ? "Undead" : null,
    target.demon ? "Demon" : null,
    target.onSlayerTask ? "Slayer" : null,
    target.poisonImmune ? "Poison immune" : null,
  ].filter((v): v is string => v != null);
  return {
    name,
    iconSrc,
    defenceLevel: target.defenceLevel,
    armour: target.armour ?? 0,
    affinity: target.affinity,
    maximumLifePoints:
      target.maximumLifePoints != null && target.maximumLifePoints > 0
        ? target.maximumLifePoints
        : null,
    flags,
    modifiedHint: options?.modified ? "Modified" : target.targetPresetId ? "Wiki" : null,
  };
}

export function formatLifePoints(lp: number | null | undefined): string {
  if (lp == null || !Number.isFinite(lp) || lp <= 0) return "—";
  if (lp >= 1_000_000) return `${(lp / 1_000_000).toFixed(1)}m`;
  if (lp >= 10_000) return `${Math.round(lp / 1000)}k`;
  return String(Math.round(lp));
}
