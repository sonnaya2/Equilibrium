"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "../GameIcon";
import {
  POWER_ARCHIVE_PERKS,
  POWER_ARCHIVE_SLOT_CAP,
  archiveEffectiveRank,
  buildMaxDpsPowerArchiveState,
  canAddPowerArchiveSlot,
  emptyPowerArchiveState,
  gizmoAcceptsPerk,
  powerArchivePerk,
  replacePowerArchiveSlot,
  storedMaxForShell,
  withPowerArchiveSlot,
  withoutPowerArchiveSlot,
  type PowerArchiveGizmoSlot,
  type PowerArchivePerkDef,
  type PowerArchivePerkId,
  type PowerArchiveShell,
  type PowerArchiveState,
} from "@/combat/league/powerArchive";
import type { Loadout, SetLoadout } from "./useLoadout";

const BOT_ICON = "/game/blessings/power-archive.webp";

function newSlotId(): string {
  return `pa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptySlot(shell: PowerArchiveShell, ancient: boolean): PowerArchiveGizmoSlot {
  return { id: newSlotId(), shell, ancient, perks: [] };
}

function setArchive(loadout: Loadout, powerArchive: PowerArchiveState): Loadout {
  return { ...loadout, powerArchive };
}

function shellLabel(shell: PowerArchiveShell, ancient: boolean): string {
  return `${ancient ? "Ancient" : "Standard"} ${shell === "weapon" ? "weapon" : "armour"}`;
}

function kindLabel(kind: PowerArchivePerkDef["gizmoKind"]): string {
  if (kind === "weapon") return "Weapon";
  if (kind === "armour") return "Armour";
  return "Weapon / Armour";
}

function RankStepper({
  label,
  rank,
  max,
  effective,
  onChange,
}: {
  label: string;
  rank: number;
  max: number;
  effective: number;
  onChange: (rank: number) => void;
}) {
  return (
    <span className="perk-rank-stepper" title={`Stored ${rank} → Archive ${effective}`}>
      <button
        type="button"
        aria-label={`Decrease ${label} stored rank`}
        disabled={rank <= 1}
        onClick={() => onChange(rank - 1)}
      >
        −
      </button>
      <output aria-label={`${label} stored rank ${rank}, effective ${effective}`}>
        R{rank}→{effective}
      </output>
      <button
        type="button"
        aria-label={`Increase ${label} stored rank`}
        disabled={rank >= max}
        onClick={() => onChange(rank + 1)}
      >
        +
      </button>
    </span>
  );
}

function ArchiveGizmoCard({
  slot,
  index,
  active,
  onActivate,
  onClear,
  onRank,
  onRemovePerk,
}: {
  slot: PowerArchiveGizmoSlot;
  index: number;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onRank: (perkId: PowerArchivePerkId, rank: number) => void;
  onRemovePerk: (perkId: PowerArchivePerkId) => void;
}) {
  const capacity = 2;
  const free = Math.max(0, capacity - slot.perks.length);
  return (
    <section
      className={`gizmo-card${active ? " is-active" : ""}`}
      aria-labelledby={`archive-gizmo-${slot.id}`}
    >
      <div className="gizmo-card__head">
        <button
          type="button"
          aria-pressed={active}
          className="gizmo-card__activate"
          data-testid={`archive-gizmo-activate-${index}`}
          onClick={onActivate}
        >
          <span className="gizmo-card__title-block">
            <span id={`archive-gizmo-${slot.id}`}>Bot gizmo {index + 1}</span>
            <span className="gizmo-card__hint">{shellLabel(slot.shell, slot.ancient)}</span>
          </span>
          <span className="font-mono">
            {slot.perks.length}/{capacity}
          </span>
        </button>
        <button
          type="button"
          className="gizmo-card__clear"
          aria-label={`Remove bot gizmo ${index + 1}`}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div className="gizmo-card__body" aria-label={`Bot gizmo ${index + 1} perks`}>
        {slot.perks.map((entry) => {
          const def = powerArchivePerk(entry.perkId);
          const max = storedMaxForShell(def, slot.ancient) ?? 1;
          const eff = archiveEffectiveRank(entry.perkId, entry.rank, true);
          return (
            <div key={entry.perkId} className="gizmo-perk-block">
              <div className="gizmo-perk">
                <GameIcon src={def.icon} size={26} className="shrink-0" />
                <span className="gizmo-perk__identity">
                  <span className="gizmo-perk__name">{def.label}</span>
                  {def.combatScope === "ui-only" ? (
                    <span className="gizmo-card__hint">UI only</span>
                  ) : null}
                </span>
                {max > 1 ? (
                  <RankStepper
                    label={def.label}
                    rank={entry.rank}
                    max={max}
                    effective={eff}
                    onChange={(rank) => onRank(entry.perkId, rank)}
                  />
                ) : (
                  <span className="gizmo-perk__on">On</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${def.label}`}
                  className="gizmo-perk__remove"
                  onClick={() => onRemovePerk(entry.perkId)}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
        {Array.from({ length: free }, (_, emptyIndex) => (
          <button
            key={`empty-${emptyIndex}`}
            type="button"
            className={`gizmo-slot-empty${active ? " is-active" : ""}`}
            aria-label={`Empty perk slot on bot gizmo ${index + 1}`}
            onClick={onActivate}
          >
            Empty
          </button>
        ))}
      </div>
    </section>
  );
}

export function PowerArchivePanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
}) {
  const archive = loadout.powerArchive;
  const [selectedId, setSelectedId] = useState<string | null>(archive.slots[0]?.id ?? null);
  const [draftShell, setDraftShell] = useState<PowerArchiveShell>("weapon");
  const [draftAncient, setDraftAncient] = useState(true);

  const selected = useMemo(
    () => archive.slots.find((s) => s.id === selectedId) ?? null,
    [archive.slots, selectedId],
  );

  const selectedIndex = selected
    ? archive.slots.findIndex((s) => s.id === selected.id)
    : -1;

  const library = useMemo(() => {
    return [...POWER_ARCHIVE_PERKS].sort((a, b) => {
      if (a.combatScope !== b.combatScope) {
        return a.combatScope === "offensive" ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
  }, []);

  const assignedSlotOf = (perkId: PowerArchivePerkId): number | null => {
    const idx = archive.slots.findIndex((s) => s.perks.some((p) => p.perkId === perkId));
    return idx >= 0 ? idx : null;
  };

  const addSlot = () => {
    if (!canAddPowerArchiveSlot(archive)) return;
    const slot = emptySlot(draftShell, draftAncient);
    const next = withPowerArchiveSlot(archive, slot);
    setLoadout(setArchive(loadout, next));
    setSelectedId(slot.id);
  };

  const removeSlot = (id: string) => {
    const next = withoutPowerArchiveSlot(archive, id);
    setLoadout(setArchive(loadout, next));
    if (selectedId === id) setSelectedId(next.slots[0]?.id ?? null);
  };

  const updateSlot = (slot: PowerArchiveGizmoSlot, patch: Partial<PowerArchiveGizmoSlot>) => {
    const nextSlot: PowerArchiveGizmoSlot = {
      ...slot,
      ...patch,
      id: slot.id,
      perks: patch.perks ?? slot.perks,
    };
    const cleaned: PowerArchiveGizmoSlot = {
      ...nextSlot,
      perks: nextSlot.perks
        .map((entry) => {
          const def = powerArchivePerk(entry.perkId);
          if (!gizmoAcceptsPerk(nextSlot.shell, def, nextSlot.ancient)) return null;
          const max = storedMaxForShell(def, nextSlot.ancient);
          if (max == null) return null;
          const rank = Math.min(Math.max(1, entry.rank), max);
          return { perkId: entry.perkId, rank };
        })
        .filter((e): e is { perkId: PowerArchivePerkId; rank: number } => e != null)
        .slice(0, 2),
    };
    setLoadout(setArchive(loadout, replacePowerArchiveSlot(archive, slot.id, cleaned)));
  };

  const placePerkOnActive = (perkId: PowerArchivePerkId) => {
    const existing = assignedSlotOf(perkId);
    if (existing != null) {
      setSelectedId(archive.slots[existing]!.id);
      return;
    }
    let slot = selected;
    if (!slot || slot.perks.length >= 2) {
      const def = powerArchivePerk(perkId);
      const shell: PowerArchiveShell = def.gizmoKind === "armour" ? "armour" : "weapon";
      if (!canAddPowerArchiveSlot(archive)) return;
      const created = emptySlot(shell, true);
      const withSlot = withPowerArchiveSlot(archive, created);
      const max = storedMaxForShell(def, true) ?? 1;
      const filled: PowerArchiveGizmoSlot = {
        ...created,
        perks: [{ perkId, rank: max }],
      };
      const next = replacePowerArchiveSlot(withSlot, created.id, filled);
      setLoadout(setArchive(loadout, next));
      setSelectedId(created.id);
      return;
    }
    if (!gizmoAcceptsPerk(slot.shell, powerArchivePerk(perkId), slot.ancient)) {
      // Switch shell if needed for compatibility.
      const def = powerArchivePerk(perkId);
      const shell: PowerArchiveShell = def.gizmoKind === "armour" ? "armour" : "weapon";
      if (!canAddPowerArchiveSlot(archive)) return;
      const created = emptySlot(shell, true);
      const max = storedMaxForShell(def, true) ?? 1;
      const next = withPowerArchiveSlot(archive, {
        ...created,
        perks: [{ perkId, rank: max }],
      });
      setLoadout(setArchive(loadout, next));
      setSelectedId(created.id);
      return;
    }
    const def = powerArchivePerk(perkId);
    const max = storedMaxForShell(def, slot.ancient) ?? 1;
    updateSlot(slot, {
      perks: [...slot.perks, { perkId, rank: max }],
    });
  };

  const fillMaxDps = () => {
    const next = buildMaxDpsPowerArchiveState();
    setLoadout(setArchive(loadout, next));
    setSelectedId(next.slots[0]?.id ?? null);
  };

  const clearAll = () => {
    setLoadout(setArchive(loadout, emptyPowerArchiveState()));
    setSelectedId(null);
  };

  const activeCapacity = 2;
  const activeHeld = selected?.perks.length ?? 0;
  const activeFull = activeHeld >= activeCapacity;
  const dpsCount = POWER_ARCHIVE_PERKS.filter((p) => p.combatScope === "offensive").length;

  return (
    <div className="loadout-panel loadout-panel-wide power-archive-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GameIcon src={BOT_ICON} size={32} alt="" />
          <div className="min-w-0">
            <h2 className="combat-section-title text-sm font-medium text-parch-50">
              Automaton Control Bot
            </h2>
            <p className="gizmo-list__note mt-0.5">
              Power Archive · {archive.slots.length}/{POWER_ARCHIVE_SLOT_CAP} gizmos · combat ranks
              doubled
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="combat-button px-3 py-1 text-xs"
            onClick={fillMaxDps}
            title={`Fill the bot with all ${dpsCount} offensive perks at ancient craft max`}
          >
            Add all DPS boosting perks
          </button>
          <button
            type="button"
            disabled={archive.slots.length === 0}
            onClick={clearAll}
            className="combat-button px-3 py-1 text-xs"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="invention-layout mt-3">
        <section aria-labelledby="archive-perk-library-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="archive-perk-library-title" className="buff-group__title">
              Perks
            </h3>
            <span className="text-xs text-gem-300">
              {selected
                ? `Gizmo ${selectedIndex + 1} · ${activeHeld}/${activeCapacity}`
                : "Pick or add a gizmo"}
            </span>
          </div>
          <div className="perk-library mt-1.5" role="group" aria-label="Power Archive perks">
            {library.map((perk) => {
              const assigned = assignedSlotOf(perk.id);
              const compatible = selected
                ? gizmoAcceptsPerk(selected.shell, perk, selected.ancient)
                : true;
              const blocked =
                assigned == null && selected != null && (!compatible || activeFull) &&
                !canAddPowerArchiveSlot(archive);
              const meta =
                assigned != null
                  ? (() => {
                      const slot = archive.slots[assigned]!;
                      const entry = slot.perks.find((p) => p.perkId === perk.id)!;
                      const eff = archiveEffectiveRank(perk.id, entry.rank, true);
                      return `R${entry.rank}→${eff} · Gizmo ${assigned + 1}`;
                    })()
                  : perk.combatScope === "offensive"
                    ? `${kindLabel(perk.gizmoKind)} · DPS`
                    : `${kindLabel(perk.gizmoKind)} · UI only`;
              return (
                <button
                  key={perk.id}
                  type="button"
                  aria-pressed={assigned != null}
                  aria-disabled={blocked}
                  title={`${perk.effectSummary}. ${meta}`}
                  className="perk-library-row"
                  onClick={() => {
                    if (assigned != null) {
                      setSelectedId(archive.slots[assigned]!.id);
                      return;
                    }
                    if (blocked) return;
                    placePerkOnActive(perk.id);
                  }}
                >
                  <GameIcon src={perk.icon} size={28} className="shrink-0" />
                  <span className="perk-library-row__text min-w-0">
                    <span className="perk-library-row__name">{perk.label}</span>
                    <span className="perk-library-row__meta">{meta}</span>
                  </span>
                  <span className="sr-only">{perk.effectSummary}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="invention-gizmos" aria-labelledby="archive-gizmos-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="archive-gizmos-title" className="buff-group__title">
              Bot gizmos
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="power-archive-panel__check text-xs">
                <select
                  value={draftShell}
                  onChange={(e) => setDraftShell(e.target.value as PowerArchiveShell)}
                  className="power-archive-inline-select"
                  aria-label="New gizmo shell"
                >
                  <option value="weapon">Weapon</option>
                  <option value="armour">Armour</option>
                </select>
              </label>
              <label className="power-archive-panel__check text-xs">
                <input
                  type="checkbox"
                  checked={draftAncient}
                  onChange={(e) => setDraftAncient(e.target.checked)}
                />
                Ancient
              </label>
              <button
                type="button"
                className="combat-button px-2 py-1 text-xs"
                disabled={!canAddPowerArchiveSlot(archive)}
                onClick={addSlot}
              >
                Add gizmo
              </button>
            </div>
          </div>
          <p className="gizmo-list__note mt-1">
            Up to {POWER_ARCHIVE_SLOT_CAP} weapon or armour gizmos. Each holds 2 perks. Stored rank
            is craftable; Archive doubles combat ranks (R4→8).
          </p>
          <div className="gizmo-list mt-1.5" role="group" aria-label="Automaton bot gizmos">
            {archive.slots.length === 0 ? (
              <p className="gizmo-list__note">
                Empty bot. Use <strong>Add all DPS boosting perks</strong> or add a gizmo and click
                perks on the left.
              </p>
            ) : (
              archive.slots.map((slot, index) => (
                <ArchiveGizmoCard
                  key={slot.id}
                  slot={slot}
                  index={index}
                  active={slot.id === selectedId}
                  onActivate={() => setSelectedId(slot.id)}
                  onClear={() => removeSlot(slot.id)}
                  onRank={(perkId, rank) => {
                    updateSlot(slot, {
                      perks: slot.perks.map((p) =>
                        p.perkId === perkId ? { ...p, rank } : p,
                      ),
                    });
                  }}
                  onRemovePerk={(perkId) => {
                    updateSlot(slot, {
                      perks: slot.perks.filter((p) => p.perkId !== perkId),
                    });
                  }}
                />
              ))
            )}
          </div>

          <div className="power-archive-scenario mt-3">
            <h3 className="buff-group__title">Scenario</h3>
            <div className="flex flex-wrap items-end gap-3 mt-1.5">
              <label className="power-archive-panel__check">
                <input
                  type="checkbox"
                  checked={loadout.buffs.targetNotFacing}
                  onChange={(e) =>
                    setLoadout({
                      ...loadout,
                      buffs: { ...loadout.buffs, targetNotFacing: e.target.checked },
                    })
                  }
                />
                Flanking: target not facing you
              </label>
              <label className="power-archive-panel__field">
                Ruthless stacks
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={loadout.buffs.ruthlessStacks}
                  onChange={(e) =>
                    setLoadout({
                      ...loadout,
                      buffs: {
                        ...loadout.buffs,
                        ruthlessStacks: Math.max(
                          0,
                          Math.min(5, Math.floor(Number(e.target.value) || 0)),
                        ),
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className="gizmo-list__note mt-1.5">
              Highest rank wins if a perk appears more than once. Ruthless defaults to 0 stacks.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Compact Loadout entry that opens the bot panel when Power Archive is active. */
export function PowerArchiveLoadoutButton({
  active,
  onOpen,
  slotCount,
}: {
  active: boolean;
  onOpen: () => void;
  slotCount: number;
}) {
  if (!active) return null;
  return (
    <button type="button" className="power-archive-entry" onClick={onOpen}>
      <GameIcon src={BOT_ICON} size={32} alt="" />
      <span className="power-archive-entry__text">
        <span className="power-archive-entry__title">Automaton Control Bot</span>
        <span className="power-archive-entry__meta">
          Power Archive · {slotCount}/{POWER_ARCHIVE_SLOT_CAP} gizmos
        </span>
      </span>
    </button>
  );
}
