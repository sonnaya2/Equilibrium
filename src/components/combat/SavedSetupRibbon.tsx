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
            className="saved-setup-ribbon__icon-btn"
            aria-label="New setup"
            title="New setup"
            onClick={() => {
              actions.create();
              setStatus("New setup created.");
            }}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
              <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z" />
            </svg>
          </button>
          <button
            type="button"
            className="saved-setup-ribbon__icon-btn"
            aria-label="Rename"
            title="Rename"
            onClick={() => openModal({ type: "rename", setupId: active.id })}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
              <path d="M11.74 1.34a1.75 1.75 0 0 1 2.47 2.47l-.44.44-2.47-2.47.44-.44zm-1.15 1.15-7.7 7.7a1 1 0 0 0-.26.47l-.7 2.8a.4.4 0 0 0 .48.48l2.8-.7a1 1 0 0 0 .47-.26l7.7-7.7-2.79-2.79z" />
            </svg>
          </button>
          <button
            type="button"
            className="saved-setup-ribbon__icon-btn"
            aria-label="Duplicate"
            title="Duplicate"
            onClick={() => {
              actions.duplicate(active.id);
              setStatus(`${active.name} duplicated.`);
            }}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
              <path d="M5.5 2.5A1.5 1.5 0 0 1 7 1h6.5A1.5 1.5 0 0 1 15 2.5V10a1.5 1.5 0 0 1-1.5 1.5H13V5a2 2 0 0 0-2-2H5.5v-.5z" />
              <path d="M1 5.5A1.5 1.5 0 0 1 2.5 4H10A1.5 1.5 0 0 1 11.5 5.5v8A1.5 1.5 0 0 1 10 15H2.5A1.5 1.5 0 0 1 1 13.5v-8z" />
            </svg>
          </button>
          <button
            type="button"
            className="saved-setup-ribbon__icon-btn"
            aria-label="Delete"
            title="Delete"
            aria-disabled={collection.setups.length === 1}
            onClick={() => {
              if (collection.setups.length === 1) {
                setStatus("At least one saved setup must remain.");
                return;
              }
              openModal({ type: "delete", setupId: active.id });
            }}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
              <path d="M6 1.75A.75.75 0 0 1 6.75 1h2.5a.75.75 0 0 1 0 1.5h-.5v.25H12a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1 0-1.5h3.25V2.5h-.5A.75.75 0 0 1 6 1.75z" />
              <path d="M4.5 5.5a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 4.5 5.5zm3.25.75a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6zm2.5-.75a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75zM3.5 4.75 4 13.25A1.75 1.75 0 0 0 5.74 15h4.52A1.75 1.75 0 0 0 12 13.25L12.5 4.75h-9z" />
            </svg>
          </button>
          <button
            type="button"
            className="saved-setup-ribbon__icon-btn"
            aria-label="Presets / Templates"
            title="Presets / Templates"
            onClick={() => openModal({ type: "templates" })}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
              <path d="M2.5 2.5h4v4h-4v-4zm7 0h4v4h-4v-4zm-7 7h4v4h-4v-4zm7 0h4v4h-4v-4z" />
            </svg>
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
