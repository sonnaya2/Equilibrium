"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOADOUT } from "./useLoadout";
import {
  SAVED_SETUP_NAME_LIMIT,
  exportSavedSetups,
  importSavedSetups,
  type SavedSetupCollection,
} from "./loadout/savedSetups";

export type SavedSetupModal =
  | { type: "rename"; setupId: string }
  | { type: "delete"; setupId: string }
  | { type: "templates" }
  | null;

export function SavedSetupDialog({
  modal,
  collection,
  onDismiss,
  onRename,
  onDelete,
  onUseTemplate,
  onResetDefaults,
  onImport,
}: {
  modal: SavedSetupModal;
  collection: SavedSetupCollection;
  onDismiss: () => void;
  onRename: (setupId: string, name: string) => void;
  onDelete: (setupId: string) => void;
  onUseTemplate: (name: string, loadout: unknown) => void;
  onResetDefaults: () => void;
  onImport: (collection: SavedSetupCollection) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [importDraft, setImportDraft] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  useEffect(() => {
    setNotice("");
    setImportDraft("");
  }, [modal]);

  useEffect(() => {
    if (modal?.type === "rename") {
      setRenameDraft(collection.setups.find(({ id }) => id === modal.setupId)?.name ?? "");
    }
  }, [collection.setups, modal]);

  const close = () => dialogRef.current?.close();
  const selected =
    modal && "setupId" in modal
      ? collection.setups.find(({ id }) => id === modal.setupId)
      : undefined;
  const title =
    modal?.type === "rename"
      ? "Rename setup"
      : modal?.type === "delete"
        ? "Delete setup"
        : "Presets and templates";

  return (
    <dialog
      ref={dialogRef}
      className="saved-setup-dialog"
      aria-labelledby="saved-setup-dialog-title"
      onClose={onDismiss}
      onCancel={() => setNotice("")}
    >
      <header className="saved-setup-dialog__header">
        <h2 id="saved-setup-dialog-title">{title}</h2>
        <button type="button" aria-label="Close setup window" onClick={close}>
          ×
        </button>
      </header>

      {modal?.type === "rename" && selected ? (
        <form
          className="saved-setup-dialog__body"
          onSubmit={(event) => {
            event.preventDefault();
            if (!renameDraft.trim()) {
              setNotice("Enter a setup name.");
              return;
            }
            onRename(selected.id, renameDraft);
            close();
          }}
        >
          <label className="saved-setup-dialog__field">
            <span>Name</span>
            <input
              autoFocus
              value={renameDraft}
              maxLength={SAVED_SETUP_NAME_LIMIT}
              onChange={(event) => {
                setRenameDraft(event.currentTarget.value);
                setNotice("");
              }}
            />
          </label>
          <div className="saved-setup-dialog__count">
            {Array.from(renameDraft).length}/{SAVED_SETUP_NAME_LIMIT}
          </div>
          {notice ? (
            <p className="saved-setup-dialog__notice is-error" role="alert">
              {notice}
            </p>
          ) : null}
          <footer className="saved-setup-dialog__actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="is-primary">
              Save name
            </button>
          </footer>
        </form>
      ) : null}

      {modal?.type === "delete" && selected ? (
        <div className="saved-setup-dialog__body">
          <p>
            Delete <strong>{selected.name}</strong>? This removes its saved loadout from this
            browser.
          </p>
          <footer className="saved-setup-dialog__actions">
            <button type="button" autoFocus onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                onDelete(selected.id);
                close();
              }}
            >
              Delete setup
            </button>
          </footer>
        </div>
      ) : null}

      {modal?.type === "templates" ? (
        <div className="saved-setup-dialog__body saved-setup-dialog__body--templates">
          <section className="saved-setup-template" aria-labelledby="production-template-title">
            <div>
              <h3 id="production-template-title">Default loadout</h3>
              <p>A clean setup using the current combat defaults.</p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => {
                onUseTemplate("Default loadout", DEFAULT_LOADOUT);
                close();
              }}
            >
              Use template
            </button>
          </section>

          <section className="saved-setup-template" aria-labelledby="reset-presets-title">
            <div>
              <h3 id="reset-presets-title">Built-in BIS presets</h3>
              <p>Restore Melee, Ranged, Magic, and Necromancy without changing custom setups.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onResetDefaults();
                setNotice("Four built-in presets restored.");
              }}
            >
              Reset presets
            </button>
          </section>

          <section className="saved-setup-transfer" aria-labelledby="setup-export-title">
            <h3 id="setup-export-title">Export</h3>
            <p>Copy this JSON to move your saved setups to another browser.</p>
            <textarea
              readOnly
              rows={5}
              aria-label="Saved setup export JSON"
              value={exportSavedSetups(collection)}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportSavedSetups(collection));
                  setNotice("Setup JSON copied.");
                } catch {
                  setNotice("Clipboard access is unavailable. Select and copy the JSON above.");
                }
              }}
            >
              Copy JSON
            </button>
          </section>

          <section className="saved-setup-transfer" aria-labelledby="setup-import-title">
            <h3 id="setup-import-title">Import</h3>
            <p>Importing replaces the saved setup list in this browser.</p>
            <textarea
              rows={5}
              aria-label="Setup JSON to import"
              value={importDraft}
              onChange={(event) => {
                setImportDraft(event.currentTarget.value);
                setNotice("");
              }}
              placeholder="Paste setup JSON"
            />
            <button
              type="button"
              onClick={() => {
                const result = importSavedSetups(importDraft);
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                onImport(result.collection);
                setImportDraft("");
                setNotice(
                  `${result.collection.setups.length} ${result.collection.setups.length === 1 ? "setup" : "setups"} imported.`,
                );
              }}
            >
              Import JSON
            </button>
          </section>

          {notice ? (
            <p
              className={`saved-setup-dialog__notice${notice.includes("imported") || notice.includes("copied") || notice.includes("restored") ? "" : " is-error"}`}
              role="status"
            >
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
