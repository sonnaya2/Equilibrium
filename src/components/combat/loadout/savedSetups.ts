import { DEFAULT_LOADOUT, normalizeLoadout, pruneUnknownEquipment, type Loadout } from "./model";

export const SAVED_SETUPS_STORAGE_KEY = "eq:combat:setups:v1";
export const SAVED_SETUPS_VERSION = 2;
export const SAVED_SETUP_NAME_LIMIT = 48;
export const SAVED_SETUP_IMPORT_LIMIT = 1_000_000;
export const SAVED_SETUP_COUNT_LIMIT = 100;

export interface SavedSetup {
  id: string;
  name: string;
  loadout: Loadout;
}

export interface SavedSetupCollection {
  version: typeof SAVED_SETUPS_VERSION;
  activeSetupId: string;
  setups: SavedSetup[];
}

export type SavedSetupImportResult =
  { ok: true; collection: SavedSetupCollection } | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedLoadout(value: unknown): Loadout {
  const loadout = normalizeLoadout(value);
  const withLevels =
    loadout.style === "melee" ? { ...loadout, level: loadout.strengthLevel } : loadout;
  return pruneUnknownEquipment(withLevels);
}

const DEFAULT_SAVED_SETUPS: readonly SavedSetup[] = [
  {
    id: "default-melee",
    name: "Melee",
    loadout: normalizedLoadout({
      ...DEFAULT_LOADOUT,
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        herbloreLevel: 120,
        styleCurse: "malevolence",
        vulnerability: true,
        overload: "overload",
      },
      perks: {
        ...DEFAULT_LOADOUT.perks,
        precise: 6,
        aftershock: 4,
        eruptive: 2,
        biting: 4,
        relentless: 5,
        crackling: 4,
        impatient: 4,
        ultimatums: 4,
      },
      gizmos: {
        weapon1: ["precise"],
        weapon2: ["aftershock", "eruptive"],
        armour1: ["biting", "relentless", "crackling"],
        armour2: ["impatient", "ultimatums"],
      },
      enchantments: [],
      equipmentSlots: {
        helmet: "item:vestments-of-havoc-hood",
        body: "item:vestments-of-havoc-robe-top",
        legs: "item:vestments-of-havoc-robe-bottom",
        gloves: "item:enhanced-gloves-of-passage",
        boots: "item:vestments-of-havoc-boots",
        cape: "item:igneous-kal-ket",
        amulet: "item:essence-of-finality",
        ring: "item:champions-ring",
        pocket: "item:erethdors-grimoire",
        ammo: "item:pernix-quiver",
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    }),
  },
  {
    id: "default-ranged",
    name: "Ranged",
    loadout: normalizedLoadout({
      ...DEFAULT_LOADOUT,
      style: "ranged",
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        herbloreLevel: 120,
        styleCurse: "desolation",
        vulnerability: true,
        overload: "overload",
      },
      perks: {
        ...DEFAULT_LOADOUT.perks,
        precise: 6,
        aftershock: 4,
        eruptive: 2,
        caroming: 1,
        biting: 4,
        relentless: 5,
        crackling: 4,
        impatient: 4,
        ultimatums: 4,
      },
      gizmos: {
        weapon1: ["precise", "caroming"],
        weapon2: ["aftershock", "eruptive"],
        armour1: ["biting", "relentless", "crackling"],
        armour2: ["impatient", "ultimatums"],
      },
      enchantments: [],
      equipmentSlots: {
        helmet: "item:elite-dracolich-helm",
        body: "item:elite-dracolich-body",
        legs: "item:elite-dracolich-legs",
        gloves: "item:elite-dracolich-gloves",
        boots: "item:elite-dracolich-boots",
        cape: "item:igneous-kal-xil",
        amulet: "item:essence-of-finality",
        ring: "item:stalkers-ring",
        pocket: "item:erethdors-grimoire",
        ammo: "item:bik-arrows",
        twohand: "item:bow-of-the-last-guardian",
      },
      selectedAmmunitionId: "item:bik-arrows",
    }),
  },
  {
    id: "default-magic",
    name: "Magic",
    loadout: normalizedLoadout({
      ...DEFAULT_LOADOUT,
      style: "magic",
      // FSoA is T95; weapon AD term uses min(weaponTier, spellTier).
      spellTier: 95,
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        herbloreLevel: 120,
        styleCurse: "affliction",
        vulnerability: true,
        overload: "overload",
      },
      perks: {
        ...DEFAULT_LOADOUT.perks,
        precise: 6,
        aftershock: 4,
        eruptive: 2,
        biting: 4,
        relentless: 5,
        crackling: 4,
        impatient: 4,
        ultimatums: 4,
        energising: 4,
        invigorating: 3,
      },
      gizmos: {
        weapon1: ["precise", "ultimatums"],
        weapon2: ["aftershock", "eruptive"],
        armour1: ["biting", "relentless", "crackling"],
        armour2: ["impatient", "energising", "invigorating"],
      },
      enchantments: [],
      equipmentSlots: {
        helmet: "item:tumekens-resplendence-helm",
        body: "item:tumekens-resplendence-body",
        legs: "item:tumekens-resplendence-legs",
        gloves: "item:tumekens-resplendence-gloves",
        boots: "item:tumekens-resplendence-boots",
        cape: "item:igneous-kal-mej",
        amulet: "item:essence-of-finality",
        ring: "item:channelers-ring",
        pocket: "item:scripture-of-amascut",
        ammo: "item:pernix-quiver",
        twohand: "item:fractured-staff-of-armadyl",
      },
    }),
  },
  {
    id: "default-necromancy",
    name: "Necromancy",
    loadout: normalizedLoadout({
      ...DEFAULT_LOADOUT,
      style: "necromancy",
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        herbloreLevel: 120,
        styleCurse: "ruination",
        vulnerability: true,
        overload: "overload",
      },
      perks: {
        ...DEFAULT_LOADOUT.perks,
        precise: 6,
        aftershock: 4,
        eruptive: 2,
        equilibrium: 4,
        crackling: 4,
        ultimatums: 4,
        impatient: 4,
        invigorating: 4,
      },
      gizmos: {
        weapon1: ["precise"],
        weapon2: ["aftershock", "eruptive"],
        armour1: ["equilibrium", "crackling", "ultimatums"],
        armour2: ["impatient", "invigorating"],
      },
      enchantments: [],
      equipmentSlots: {
        helmet: "item:first-necromancer-helm",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
        cape: "item:igneous-kal-mor",
        amulet: "item:essence-of-finality",
        ring: "item:occultists-ring",
        pocket: "item:erethdors-grimoire",
        ammo: "item:pernix-quiver",
        mainhand: "item:omni-guard",
        offhand: "item:soulbound-lantern",
      },
    }),
  },
];

function defaultSavedSetups(): SavedSetup[] {
  return DEFAULT_SAVED_SETUPS.map((setup) => ({
    ...setup,
    loadout: normalizedLoadout(setup.loadout),
  }));
}

export function normalizeSavedSetupName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? Array.from(trimmed).slice(0, SAVED_SETUP_NAME_LIMIT).join("") : fallback;
}

function safeSetupId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return safe || fallback;
}

function uniqueSetupId(value: unknown, fallback: string, used: Set<string>): string {
  const base = safeSetupId(value, fallback);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base.slice(0, 64 - String(suffix).length - 1)}-${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function uniqueSetupName(collection: SavedSetupCollection, requested: unknown, fallback: string) {
  const base = normalizeSavedSetupName(requested, fallback);
  const names = new Set(collection.setups.map(({ name }) => name.toLocaleLowerCase()));
  if (!names.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; ; suffix += 1) {
    const ending = ` ${suffix}`;
    const candidate = `${Array.from(base)
      .slice(0, SAVED_SETUP_NAME_LIMIT - ending.length)
      .join("")}${ending}`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

export function createSavedSetupCollection(legacyLoadout?: unknown): SavedSetupCollection {
  const defaults = defaultSavedSetups();
  if (legacyLoadout !== undefined) {
    return {
      version: SAVED_SETUPS_VERSION,
      activeSetupId: "setup-1",
      setups: [
        { id: "setup-1", name: "Saved setup", loadout: normalizedLoadout(legacyLoadout) },
        ...defaults,
      ],
    };
  }
  return {
    version: SAVED_SETUPS_VERSION,
    activeSetupId: defaults[0].id,
    setups: defaults,
  };
}

export function resetDefaultSavedSetups(collection: SavedSetupCollection): SavedSetupCollection {
  const defaults = defaultSavedSetups();
  const defaultIds = new Set(defaults.map(({ id }) => id));
  const custom = collection.setups
    .filter(({ id }) => !defaultIds.has(id))
    .slice(0, SAVED_SETUP_COUNT_LIMIT - defaults.length);
  const setups = [...defaults, ...custom];
  return {
    version: SAVED_SETUPS_VERSION,
    activeSetupId: setups.some(({ id }) => id === collection.activeSetupId)
      ? collection.activeSetupId
      : defaults[0].id,
    setups,
  };
}

export function normalizeSavedSetupCollection(
  value: unknown,
  legacyLoadout?: unknown,
): SavedSetupCollection {
  const source = record(value);
  if (!source || !Array.isArray(source.setups) || source.setups.length === 0) {
    return createSavedSetupCollection(legacyLoadout);
  }

  const used = new Set<string>();
  const rawSetups = source.setups.slice(0, SAVED_SETUP_COUNT_LIMIT);
  const setups = rawSetups.map((candidate, index) => {
    const setup = record(candidate);
    return {
      id: uniqueSetupId(setup?.id, `setup-${index + 1}`, used),
      name: normalizeSavedSetupName(setup?.name, `Setup ${index + 1}`),
      loadout: normalizedLoadout(setup?.loadout),
    };
  });
  const rawActiveId = typeof source.activeSetupId === "string" ? source.activeSetupId : "";
  const activeIndex = rawSetups.findIndex((candidate) => record(candidate)?.id === rawActiveId);
  const normalizedActiveId = safeSetupId(rawActiveId, "");
  const activeSetupId =
    (activeIndex >= 0 ? setups[activeIndex]?.id : undefined) ??
    setups.find(({ id }) => id === normalizedActiveId)?.id ??
    setups[0].id;

  const normalized: SavedSetupCollection = {
    version: SAVED_SETUPS_VERSION,
    activeSetupId,
    setups,
  };
  if (source.version !== 1) return normalized;

  const migrated = DEFAULT_SAVED_SETUPS.reduce(
    (collection, setup) =>
      collection.setups.some(({ id }) => id === setup.id)
        ? collection
        : addSavedSetup(collection, setup),
    normalized,
  );
  return { ...migrated, activeSetupId };
}

export function activeSavedSetup(collection: SavedSetupCollection): SavedSetup {
  return (
    collection.setups.find(({ id }) => id === collection.activeSetupId) ?? collection.setups[0]
  );
}

export function selectSavedSetup(
  collection: SavedSetupCollection,
  setupId: string,
): SavedSetupCollection {
  if (setupId === collection.activeSetupId || !collection.setups.some(({ id }) => id === setupId)) {
    return collection;
  }
  return { ...collection, activeSetupId: setupId };
}

export function updateActiveSavedSetup(
  collection: SavedSetupCollection,
  next: Loadout | ((previous: Loadout) => Loadout),
): SavedSetupCollection {
  const current = activeSavedSetup(collection);
  const resolved = typeof next === "function" ? next(current.loadout) : next;
  const loadout = normalizedLoadout(resolved);
  return {
    ...collection,
    setups: collection.setups.map((setup) =>
      setup.id === current.id ? { ...setup, loadout } : setup,
    ),
  };
}

export function addSavedSetup(
  collection: SavedSetupCollection,
  options: { id?: string; name?: unknown; loadout?: unknown } = {},
): SavedSetupCollection {
  if (collection.setups.length >= SAVED_SETUP_COUNT_LIMIT) return collection;
  const used = new Set(collection.setups.map(({ id }) => id));
  const id = uniqueSetupId(options.id, `setup-${collection.setups.length + 1}`, used);
  const name = uniqueSetupName(collection, options.name, `Setup ${collection.setups.length + 1}`);
  return {
    ...collection,
    activeSetupId: id,
    setups: [...collection.setups, { id, name, loadout: normalizedLoadout(options.loadout) }],
  };
}

export function renameSavedSetup(
  collection: SavedSetupCollection,
  setupId: string,
  requestedName: unknown,
): SavedSetupCollection {
  const current = collection.setups.find(({ id }) => id === setupId);
  if (!current || typeof requestedName !== "string" || !requestedName.trim()) return collection;
  const withoutCurrent = {
    ...collection,
    setups: collection.setups.filter(({ id }) => id !== setupId),
  };
  const name = uniqueSetupName(withoutCurrent, requestedName, current.name);
  if (name === current.name) return collection;
  return {
    ...collection,
    setups: collection.setups.map((setup) => (setup.id === setupId ? { ...setup, name } : setup)),
  };
}

export function duplicateSavedSetup(
  collection: SavedSetupCollection,
  setupId: string,
  duplicateId?: string,
): SavedSetupCollection {
  const source = collection.setups.find(({ id }) => id === setupId);
  if (!source) return collection;
  return addSavedSetup(collection, {
    id: duplicateId,
    name: `${source.name} copy`,
    loadout: source.loadout,
  });
}

export function deleteSavedSetup(
  collection: SavedSetupCollection,
  setupId: string,
): SavedSetupCollection {
  if (collection.setups.length <= 1 || !collection.setups.some(({ id }) => id === setupId)) {
    return collection;
  }
  const setups = collection.setups.filter(({ id }) => id !== setupId);
  return {
    ...collection,
    activeSetupId: collection.activeSetupId === setupId ? setups[0].id : collection.activeSetupId,
    setups,
  };
}

export function exportSavedSetups(collection: SavedSetupCollection): string {
  return JSON.stringify(normalizeSavedSetupCollection(collection), null, 2);
}

export function importSavedSetups(text: string): SavedSetupImportResult {
  if (!text.trim()) return { ok: false, error: "Paste a saved setup JSON export first." };
  if (text.length > SAVED_SETUP_IMPORT_LIMIT) {
    return { ok: false, error: "That setup export is too large to import." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That JSON is malformed. Check the pasted text and try again." };
  }
  const source = record(parsed);
  if (!source) return { ok: false, error: "The setup export must be a JSON object." };
  if (source.version !== 1 && source.version !== SAVED_SETUPS_VERSION) {
    return { ok: false, error: "That setup export uses an unsupported version." };
  }
  if (!Array.isArray(source.setups) || source.setups.length === 0) {
    return { ok: false, error: "That setup export does not contain any setups." };
  }
  if (source.setups.length > SAVED_SETUP_COUNT_LIMIT) {
    return {
      ok: false,
      error: `A setup export can contain at most ${SAVED_SETUP_COUNT_LIMIT} setups.`,
    };
  }
  const invalidIndex = source.setups.findIndex((candidate) => {
    const setup = record(candidate);
    return !setup || !record(setup.loadout);
  });
  if (invalidIndex >= 0) {
    return { ok: false, error: `Setup ${invalidIndex + 1} is missing a valid loadout.` };
  }
  return { ok: true, collection: normalizeSavedSetupCollection(source) };
}
