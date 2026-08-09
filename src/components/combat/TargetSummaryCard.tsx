"use client";

import { GameIcon } from "../GameIcon";
import {
  formatLifePoints,
  targetSummaryView,
} from "./targetSummaryPresentation";
import { isTargetModifiedFromPreset } from "./targetPresetUi";
import type { Loadout } from "./useLoadout";

/** Full boss / NPC face: plate, flags, and defence stats. */
export function TargetSummaryCard({
  target,
  style,
  damagePotential,
  className,
}: {
  target: Loadout["target"];
  style: Loadout["style"];
  damagePotential: number;
  className?: string;
}) {
  const view = targetSummaryView(target, {
    modified: target != null && isTargetModifiedFromPreset(target, style),
  });
  const root = className
    ? `setup-target-summary ${className}`
    : "setup-target-summary";

  if (!view) {
    return (
      <div className={`${root} setup-target-summary--empty`}>
        <p>No NPC target. Damage Potential uses the manual accuracy slider.</p>
      </div>
    );
  }

  const size = target?.size;
  const weakness =
    target?.hasApplicableWeakness && target.weaknessAffinity != null
      ? target.weaknessAffinity
      : null;

  return (
    <div className={root}>
      <div className="setup-target-identity">
        <span className="setup-target-identity__icon" aria-hidden>
          <GameIcon src={view.iconSrc} size={48} />
        </span>
        <div className="setup-target-identity__copy">
          <strong>{view.name}</strong>
          <span>
            {view.modifiedHint ?? "Custom"}
            {view.flags.length ? ` · ${view.flags.join(" · ")}` : ""}
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Defence</dt>
          <dd>{view.defenceLevel}</dd>
        </div>
        <div>
          <dt>Armour</dt>
          <dd>{view.armour}</dd>
        </div>
        <div>
          <dt>Affinity</dt>
          <dd>{view.affinity}</dd>
        </div>
        {weakness != null ? (
          <div>
            <dt>Weakness Aff</dt>
            <dd>{weakness}</dd>
          </div>
        ) : null}
        <div>
          <dt>Damage Potential</dt>
          <dd>{Math.round(damagePotential * 100)}%</dd>
        </div>
        <div>
          <dt>Life points</dt>
          <dd>{formatLifePoints(view.maximumLifePoints)}</dd>
        </div>
        {size != null && size > 0 ? (
          <div>
            <dt>Size</dt>
            <dd>{size}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
