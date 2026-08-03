"use client";

import {
  equipmentSetById,
  setEffectsSummary,
  type EquipmentSetEffectDef,
  type SetEffectSupport,
} from "@/combat/shared/equipment";
import type { Loadout } from "./useLoadout";

const SET_SUPPORT_LABEL: Record<SetEffectSupport, string> = {
  modeled: "Modeled",
  "not-modeled": "Not modeled",
  "outgoing-only": "Partial",
  none: "No combat effect",
};

function setFactThreshold(fact: string): number | null {
  const match = /^Set\((\d+)\):/i.exec(fact);
  return match ? Number(match[1]) : null;
}

function setEffectText(effect: EquipmentSetEffectDef): string {
  const percent = `${Math.round(effect.value * 1000) / 10}%`;
  const context = effect.requires === "sunshine" ? " while inside Sunshine" : "";
  if (effect.kind === "critChancePerPiece") {
    return `${percent} critical strike chance per piece${context}`;
  }
  if (effect.kind === "damageMultPerPiece") return `${percent} damage per piece${context}`;
  return `${percent} damage${context}`;
}

/** Equipped set progress and thresholds - Gear owns this; it is not a buff toggle. */
export function SetEffectsList({ loadout }: { loadout: Loadout }) {
  const sets = setEffectsSummary({ equipmentSlots: loadout.equipmentSlots });

  if (sets.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-parch-300">Equip set pieces to activate their effects.</p>
    );
  }

  return (
    <ul className="set-effect-list mt-1.5">
      {sets.map((s) => {
        const def = equipmentSetById(s.setId);
        const thresholds = [
          ...(def?.effects.map((effect) => effect.minPieces) ?? []),
          ...(def?.facts?.map(setFactThreshold).filter((value): value is number => value != null) ??
            []),
        ];
        const activeThresholds = thresholds.filter((value) => value <= s.pieces).length;
        const state =
          s.support === "not-modeled"
            ? "Not modeled"
            : activeThresholds > 0 && activeThresholds < thresholds.length
              ? "Partial"
              : activeThresholds > 0
                ? "Active"
                : thresholds.length > 0
                  ? "Partial"
                  : "Equipped";
        return (
          <li key={s.setId} className="set-effect-card">
            <div className="set-effect-card__head">
              <span className="text-parch-50">{s.label}</span>
              <span className="set-effect-state">{state}</span>
              <span className="ml-auto font-mono text-parch-300">
                {s.pieces}/{def?.maxPieces ?? s.pieces}
              </span>
            </div>
            <ul className="set-threshold-list">
              {def?.effects.map((effect) => {
                const met = s.pieces >= effect.minPieces;
                return (
                  <li key={`${effect.kind}-${effect.minPieces}`} className={met ? "is-met" : ""}>
                    <span className="set-threshold-badge">
                      {met ? (effect.requires ? "Context" : "Active") : `Set ${effect.minPieces}`}
                    </span>
                    <span>{setEffectText(effect)}</span>
                  </li>
                );
              })}
              {def?.facts?.map((fact) => {
                const required = setFactThreshold(fact);
                const met = required == null || s.pieces >= required;
                return (
                  <li key={fact} className={met ? "is-met" : ""}>
                    <span className="set-threshold-badge">
                      {required == null ? "Note" : met ? "Active" : `Set ${required}`}
                    </span>
                    <span>{fact.replace(/^Set\(\d+\):\s*/i, "")}</span>
                  </li>
                );
              })}
              {!def?.effects.length && !def?.facts?.length ? (
                <li>
                  <span className="set-threshold-badge">Note</span>
                  <span>This set has no combat bonus yet.</span>
                </li>
              ) : null}
            </ul>
            <div className="set-effect-card__foot">
              {s.support !== "modeled" ? <span>{SET_SUPPORT_LABEL[s.support]}</span> : null}
              {def?.source ? (
                <a href={def.source.url} target="_blank" rel="noreferrer">
                  Source
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
