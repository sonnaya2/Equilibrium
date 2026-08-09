"use client";

import { useRef, useState } from "react";
import { styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { activeSavedSetup, type SavedSetup } from "./loadout/savedSetups";
import type { SavedSetupActions } from "./loadout/useSavedSetups";
import { SavedSetupDialog, type SavedSetupModal } from "./SavedSetupDialog";

const STYLE_LABELS = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
} as const;

const WEAPON_CONFIGURATION_LABELS = {
  twohand: "2H",
  dualwield: "DW",
  mainhand: "MH",
  shield: "Shield",
  defender: "Defender",
} as const;

function setupSubtitle(setup: SavedSetup): string {
  const { loadout } = setup;
  return `${STYLE_LABELS[loadout.style]} · ${WEAPON_CONFIGURATION_LABELS[loadout.weaponConfiguration]}`;
}

export function SavedSetupRibbon({
  collection,
  actions,
}: {
  collection: Parameters<typeof activeSavedSetup>[0];
  actions: SavedSetupActions;
}) {
  const [modal, setModal] = useState<SavedSetupModal>(null);
  const [status, setStatus] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const active = activeSavedSetup(collection);

  const openModal = (next: Exclude<SavedSetupModal, null>) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setModal(next);
  };
  const dismissModal = () => {
    setModal(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };
  const select = (setup: SavedSetup) => {
    actions.select(setup.id);
    setStatus(`${setup.name} selected.`);
  };

  return (
    <>
      <section className="saved-setup-ribbon" role="toolbar" aria-label="Manage saved setups">
        <div className="saved-setup-ribbon__label">
          <span>Saved setups</span>
          <strong>{collection.setups.length}</strong>
        </div>
        <div className="saved-setup-ribbon__tabs" role="toolbar" aria-label="Select saved setup">
          {collection.setups.map((setup) => (
            <button
              key={setup.id}
              type="button"
              className={setup.id === active.id ? "is-active" : undefined}
              aria-label={setup.name}
              aria-describedby={`saved-setup-subtitle-${setup.id}`}
              aria-pressed={setup.id === active.id}
              onClick={() => select(setup)}
            >
              <GameIcon src={styleIconPath(setup.loadout.style)} size={26} />
              <span className="saved-setup-tab__copy">
                <strong>{setup.name}</strong>
                <small id={`saved-setup-subtitle-${setup.id}`}>{setupSubtitle(setup)}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="saved-setup-ribbon__actions" role="group" aria-label="Setup actions">
          <button
            type="button"
            onClick={() => {
              actions.create();
              setStatus("New setup created.");
            }}
          >
            + New setup
          </button>
          <button type="button" onClick={() => openModal({ type: "rename", setupId: active.id })}>
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              actions.duplicate(active.id);
              setStatus(`${active.name} duplicated.`);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            aria-disabled={collection.setups.length === 1}
            onClick={() => {
              if (collection.setups.length === 1) {
                setStatus("At least one saved setup must remain.");
                return;
              }
              openModal({ type: "delete", setupId: active.id });
            }}
          >
            Delete
          </button>
          <button type="button" onClick={() => openModal({ type: "templates" })}>
            Presets / Templates
          </button>
        </div>
        <p className="saved-setup-ribbon__status" aria-live="polite" aria-atomic="true">
          {status}
        </p>
      </section>

      <SavedSetupDialog
        modal={modal}
        collection={collection}
        onDismiss={dismissModal}
        onRename={(setupId, name) => {
          actions.rename(setupId, name);
          setStatus("Setup renamed.");
        }}
        onDelete={(setupId) => {
          actions.delete(setupId);
          setStatus("Setup deleted.");
        }}
        onUseTemplate={(name, loadout) => {
          actions.createFromTemplate(name, loadout);
          setStatus(`${name} added.`);
        }}
        onResetDefaults={() => {
          actions.resetDefaults();
          setStatus("Built-in presets restored.");
        }}
        onImport={(next) => {
          actions.replace(next);
          setStatus(
            `${next.setups.length} ${next.setups.length === 1 ? "setup" : "setups"} imported.`,
          );
        }}
      />
    </>
  );
}
