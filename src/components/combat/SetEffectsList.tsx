"use client";

import { equipmentById } from "@/combat/data";
import {
  equipmentSetById,
  resolvedEquipmentSlots,
  setEffectsSummary,
  type SetPieceContributionModifier,
  type EquipmentSetEffectDef,
  type LoadoutEquipmentView,
  type SetEffectSupport,
} from "@/combat/shared/equipment";
import { equipmentIconPath } from "@/lib/gameArt";
import { GameIcon } from "@/components/GameIcon";
import type { Loadout } from "./useLoadout";

const SET_SUPPORT_LABEL: Record<SetEffectSupport, string> = {
  modeled: "Active",
  "not-modeled": "Unmodeled",
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

export function setEffectCountLabel(summary: { pieces: number; effectivePieces: number }): string {
  return `${summary.pieces} equipped · ${summary.effectivePieces} effective pieces`;
}

/** Equipped item ids per setId (deduped). Visage still one icon while counting 2 pieces. */
function equippedSetPieceIds(loadout: LoadoutEquipmentView): Map<string, string[]> {
  const bySet = new Map<string, string[]>();
  const seen = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (typeof id !== "string" || seen.has(id)) return;
    seen.add(id);
    const setId = equipmentById(id)?.setId;
    if (!setId) return;
    const list = bySet.get(setId);
    if (list) list.push(id);
    else bySet.set(setId, [id]);
  };
  for (const id of Object.values(resolvedEquipmentSlots(loadout))) add(id);
  for (const id of loadout.equipmentIds ?? []) add(id);
  return bySet;
}

/** Equipped set progress and thresholds - Gear owns this; it is not a buff toggle. */
export function SetEffectsList({
  loadout,
  pieceContribution,
}: {
  loadout: Loadout;
  pieceContribution?: SetPieceContributionModifier;
}) {
  const view: LoadoutEquipmentView = {
    equipmentSlots: loadout.equipmentSlots,
    equipmentIds: loadout.equipmentIds,
    pieceContribution,
  };
  const sets = setEffectsSummary(view);
  const piecesBySet = equippedSetPieceIds(view);

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
        const activeThresholds = thresholds.filter((value) => value <= s.effectivePieces).length;
        const state =
          s.support === "not-modeled"
            ? "Unmodeled"
            : activeThresholds > 0 && activeThresholds < thresholds.length
              ? "Partial"
              : activeThresholds > 0
                ? "Active"
                : thresholds.length > 0
                  ? "Partial"
                  : "Equipped";
        const pieceIds = piecesBySet.get(s.setId) ?? [];
        return (
          <li key={s.setId} className="set-effect-card">
            <div className="set-effect-card__head">
              <span className="text-parch-50">{s.label}</span>
              <span className="set-effect-state">{state}</span>
              <span className="ml-auto font-mono text-parch-300">
                {setEffectCountLabel(s)}
                {s.piecesPerItem !== 1 ? ` · ${s.piecesPerItem} effective each` : null}
              </span>
            </div>
            {pieceIds.length > 0 ? (
              <div className="set-effect-pieces" aria-label="Equipped set pieces">
                {pieceIds.map((itemId) => {
                  const name = equipmentById(itemId)?.name;
                  return (
                    <span key={itemId} className="set-effect-pieces__icon" title={name ?? itemId}>
                      <GameIcon src={equipmentIconPath(itemId)} alt={name ?? ""} size={18} />
                    </span>
                  );
                })}
              </div>
            ) : null}
            <ul className="set-threshold-list">
              {def?.effects.map((effect) => {
                const met = s.effectivePieces >= effect.minPieces;
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
                const met = required == null || s.effectivePieces >= required;
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
