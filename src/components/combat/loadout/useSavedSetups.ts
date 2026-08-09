"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOADOUT, LOADOUT_STORAGE_KEY, normalizeLoadout, type Loadout } from "./model";
import {
  SAVED_SETUPS_STORAGE_KEY,
  activeSavedSetup,
  addSavedSetup,
  deleteSavedSetup,
  duplicateSavedSetup,
  normalizeSavedSetupCollection,
  renameSavedSetup,
  resetDefaultSavedSetups,
  selectSavedSetup,
  updateActiveSavedSetup,
  type SavedSetupCollection,
} from "./savedSetups";
import type { SetLoadout } from "./useLoadout";

function setupId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `setup-${uuid}`;
  return `setup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredJson(key: string): unknown {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function persistCollection(collection: SavedSetupCollection): void {
  try {
    window.localStorage.setItem(SAVED_SETUPS_STORAGE_KEY, JSON.stringify(collection));
    window.localStorage.setItem(
      LOADOUT_STORAGE_KEY,
      JSON.stringify(activeSavedSetup(collection).loadout),
    );
  } catch {
    // Storage full/blocked - session state still works.
  }
}

export interface SavedSetupActions {
  select: (setupId: string) => void;
  create: () => void;
  createFromTemplate: (name: string, loadout?: unknown) => void;
  rename: (setupId: string, name: string) => void;
  duplicate: (setupId: string) => void;
  delete: (setupId: string) => void;
  resetDefaults: () => void;
  replace: (collection: SavedSetupCollection) => void;
}

export function useSavedSetups(): {
  collection: SavedSetupCollection;
  loadout: Loadout;
  setLoadout: SetLoadout;
  actions: SavedSetupActions;
} {
  const [collection, setCollection] = useState<SavedSetupCollection>(() =>
    normalizeSavedSetupCollection(undefined),
  );
  const hydrated = useRef(false);

  useEffect(() => {
    const legacyLoadout = readStoredJson(LOADOUT_STORAGE_KEY);
    const storedCollection = readStoredJson(SAVED_SETUPS_STORAGE_KEY);
    const legacyForMigration =
      legacyLoadout !== undefined &&
      JSON.stringify(normalizeLoadout(legacyLoadout)) !== JSON.stringify(DEFAULT_LOADOUT)
        ? legacyLoadout
        : undefined;
    const normalized = normalizeSavedSetupCollection(storedCollection, legacyForMigration);
    const next =
      storedCollection !== undefined && legacyLoadout !== undefined
        ? updateActiveSavedSetup(normalized, normalizeLoadout(legacyLoadout))
        : normalized;
    hydrated.current = true;
    persistCollection(next);
    setCollection(next);
  }, []);

  const commit = useCallback((change: (current: SavedSetupCollection) => SavedSetupCollection) => {
    setCollection((current) => {
      const next = change(current);
      if (hydrated.current) persistCollection(next);
      return next;
    });
  }, []);

  const setLoadout = useCallback<SetLoadout>(
    (next) => commit((current) => updateActiveSavedSetup(current, next)),
    [commit],
  );

  const loadout = activeSavedSetup(collection).loadout;

  useEffect(() => {
    const now = Date.now();
    const deadlines = [
      loadout.buffs.powerburstOfVitalityUntil,
      loadout.buffs.powerburstOfVitalityCooldownUntil,
    ].filter((deadline): deadline is number => deadline != null && deadline > now);
    if (deadlines.length === 0) return;
    const until = Math.min(...deadlines);
    const timeout = window.setTimeout(
      () => commit((current) => updateActiveSavedSetup(current, (active) => active)),
      Math.max(0, until - now) + 20,
    );
    return () => window.clearTimeout(timeout);
  }, [
    commit,
    loadout.buffs.powerburstOfVitalityCooldownUntil,
    loadout.buffs.powerburstOfVitalityUntil,
  ]);

  const actions = useMemo<SavedSetupActions>(
    () => ({
      select: (id) => commit((current) => selectSavedSetup(current, id)),
      create: () =>
        commit((current) => addSavedSetup(current, { id: setupId(), loadout: DEFAULT_LOADOUT })),
      createFromTemplate: (name, template = DEFAULT_LOADOUT) =>
        commit((current) => addSavedSetup(current, { id: setupId(), name, loadout: template })),
      rename: (id, name) => commit((current) => renameSavedSetup(current, id, name)),
      duplicate: (id) => commit((current) => duplicateSavedSetup(current, id, setupId())),
      delete: (id) => commit((current) => deleteSavedSetup(current, id)),
      resetDefaults: () => commit((current) => resetDefaultSavedSetups(current)),
      replace: (next) => commit(() => normalizeSavedSetupCollection(next)),
    }),
    [commit],
  );

  return { collection, loadout, setLoadout, actions };
}
