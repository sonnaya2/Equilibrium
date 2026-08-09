"use client";

import { entryByEngineId } from "@/combat/abilities/registry";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { regionCrestPath, upgradeIconPath } from "@/lib/gameArt";
import { regionDisplayName } from "@/tasks/regionMap";
import { GameIcon } from "../GameIcon";

export function abilityUnlockMarkerData(ability: Pick<AbilitySpec, "id" | "name">) {
  const unlock = entryByEngineId(ability.id)?.unlock;
  const regions = unlock?.regions ?? [];
  const codex = unlock?.type === "codex" ? upgradeIconPath(ability.name) : null;

  return {
    regions,
    codex,
    label: [
      ...regions.map((region) => regionDisplayName(region)),
      ...(codex ? ["Ability codex"] : []),
    ].join(" · "),
  };
}

export function AbilityUnlockMarkers({
  ability,
  size = 15,
}: {
  ability: Pick<AbilitySpec, "id" | "name">;
  size?: number;
}) {
  const markers = abilityUnlockMarkerData(ability);
  if (markers.regions.length === 0 && !markers.codex) return null;

  return (
    <span
      className="ml-auto inline-flex shrink-0 items-center gap-1"
      aria-label={`Unlock: ${markers.label}`}
      title={`Unlock: ${markers.label}`}
    >
      {markers.regions.map((region) => (
        <GameIcon key={region} src={regionCrestPath(region)} size={size} />
      ))}
      {markers.codex ? <GameIcon src={markers.codex} size={size} /> : null}
    </span>
  );
}
