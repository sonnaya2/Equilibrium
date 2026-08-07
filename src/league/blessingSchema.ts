/**
 * Runtime shape checks for the generated blessings document and persisted
 * blessing selections. No React, no combat - pure structural validation so the
 * domain module can fail closed at load rather than trust shard JSON.
 */

export type BlessingsDocument = {
  paths: readonly string[];
  godTiers: readonly number[];
  resetCount: number;
  records: readonly BlessingTierRecord[];
  lastSynced?: string | null;
  verified?: boolean;
};

export type BlessingTierRecord = {
  progressionSlot: number;
  tier: number | null;
  revealed: boolean;
  godTier: number | null;
  paths: readonly string[];
  passives: readonly BlessingTierPassive[];
  choices: readonly BlessingChoiceRecord[];
  source: SourceRefShape;
  verified?: boolean;
};

export type BlessingTierPassive =
  | {
      id: string;
      name: string;
      description: string;
      kind: "combat";
      effect: { type: "maximum-adrenaline"; bonusPercent: number };
    }
  | {
      id: string;
      name: string;
      description: string;
      kind: "entitlement";
      effect: {
        type: "league-entitlement";
        entitlement: "wars-wares";
        availability: "league-blessing";
      };
    }
  | {
      id: string;
      name: string;
      description: string;
      kind: "progression";
      effect: { type: "rotation-selection"; encounters: readonly string[] };
    }
  | {
      id: string;
      name: string;
      description: string;
      kind: "utility";
      effect:
        | { type: "charge-preservation"; itemGroups: readonly string[] }
        | { type: "degradation-immunity" };
    };

export type BlessingChoiceRecord = {
  id: string;
  name: string;
  path: string;
  effects: readonly string[];
  verified?: boolean;
  support: {
    status: string;
    mechanicsUnverified: boolean;
    excluded: readonly string[];
    assumptions: readonly string[];
  };
  combat: Record<string, unknown>;
};

export type SourceRefShape = {
  source: string;
  url: string;
  title?: string;
  verifiedAt?: string;
  publishedAt?: string;
};

export type NormalizedBlessingSelection = {
  progressionSlot: number;
  tier: number;
  blessingId: string;
  path?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`blessings document invalid: ${message}`);
}

function assertSource(value: unknown, scope: string): SourceRefShape {
  if (!isRecord(value)) fail(`${scope}.source missing`);
  const source = value.source;
  const url = value.url;
  if (typeof source !== "string" || source.length === 0) fail(`${scope}.source.source`);
  if (typeof url !== "string" || url.length === 0) fail(`${scope}.source.url`);
  return {
    source,
    url,
    title: typeof value.title === "string" ? value.title : undefined,
    verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : undefined,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : undefined,
  };
}

function assertSupport(value: unknown, scope: string): BlessingChoiceRecord["support"] {
  if (!isRecord(value)) fail(`${scope}.support missing`);
  const status = value.status;
  if (typeof status !== "string" || status.length === 0) fail(`${scope}.support.status`);
  const excluded = Array.isArray(value.excluded)
    ? value.excluded.filter((item): item is string => typeof item === "string")
    : fail(`${scope}.support.excluded`);
  const assumptions = Array.isArray(value.assumptions)
    ? value.assumptions.filter((item): item is string => typeof item === "string")
    : fail(`${scope}.support.assumptions`);
  return {
    status,
    mechanicsUnverified: value.mechanicsUnverified === true,
    excluded,
    assumptions,
  };
}

function assertChoice(value: unknown, scope: string): BlessingChoiceRecord {
  if (!isRecord(value)) fail(`${scope} not an object`);
  const id = value.id;
  const name = value.name;
  const path = value.path;
  if (typeof id !== "string" || id.length === 0) fail(`${scope}.id`);
  if (typeof name !== "string" || name.length === 0) fail(`${scope}.name`);
  if (typeof path !== "string" || path.length === 0) fail(`${scope}.path`);
  const effects = Array.isArray(value.effects)
    ? value.effects.filter((item): item is string => typeof item === "string")
    : fail(`${scope}.effects`);
  const combat = isRecord(value.combat) ? value.combat : fail(`${scope}.combat`);
  return {
    id,
    name,
    path,
    effects,
    verified: value.verified === true,
    support: assertSupport(value.support, scope),
    combat,
  };
}

function assertPassive(value: unknown, scope: string): BlessingTierPassive {
  if (!isRecord(value)) fail(`${scope} not an object`);
  const id = value.id;
  const name = value.name;
  const description = value.description;
  const kind = value.kind;
  const effect = value.effect;
  if (typeof id !== "string" || id.length === 0) fail(`${scope}.id`);
  if (typeof name !== "string" || name.length === 0) fail(`${scope}.name`);
  if (typeof description !== "string" || description.length === 0) fail(`${scope}.description`);
  if (typeof kind !== "string" || !isRecord(effect) || typeof effect.type !== "string") {
    fail(`${scope}.effect`);
  }
  if (kind === "combat" && effect.type === "maximum-adrenaline") {
    if (typeof effect.bonusPercent !== "number" || !Number.isFinite(effect.bonusPercent)) {
      fail(`${scope}.effect.bonusPercent`);
    }
    return { id, name, description, kind, effect } as BlessingTierPassive;
  }
  if (kind === "entitlement" && effect.type === "league-entitlement") {
    if (effect.entitlement !== "wars-wares" || effect.availability !== "league-blessing") {
      fail(`${scope}.effect`);
    }
    return { id, name, description, kind, effect } as BlessingTierPassive;
  }
  if (kind === "progression" && effect.type === "rotation-selection") {
    if (
      !Array.isArray(effect.encounters) ||
      effect.encounters.length === 0 ||
      effect.encounters.some((encounter) => typeof encounter !== "string" || encounter.length === 0)
    ) {
      fail(`${scope}.effect.encounters`);
    }
    return { id, name, description, kind, effect } as BlessingTierPassive;
  }
  if (kind === "utility" && effect.type === "degradation-immunity") {
    return { id, name, description, kind, effect } as BlessingTierPassive;
  }
  if (kind === "utility" && effect.type === "charge-preservation") {
    if (
      !Array.isArray(effect.itemGroups) ||
      effect.itemGroups.length === 0 ||
      effect.itemGroups.some((group) => typeof group !== "string" || group.length === 0)
    ) {
      fail(`${scope}.effect.itemGroups`);
    }
    return { id, name, description, kind, effect } as BlessingTierPassive;
  }
  fail(`${scope}.kind and effect.type`);
}

function assertRecord(value: unknown, index: number): BlessingTierRecord {
  const scope = `records[${index}]`;
  if (!isRecord(value)) fail(`${scope} not an object`);
  const progressionSlot = value.progressionSlot;
  const tier = value.tier;
  const godTier = value.godTier;
  if (
    typeof progressionSlot !== "number" ||
    !Number.isInteger(progressionSlot) ||
    progressionSlot < 1
  ) {
    fail(`${scope}.progressionSlot`);
  }
  if (tier !== null && (typeof tier !== "number" || !Number.isFinite(tier))) {
    fail(`${scope}.tier`);
  }
  if (typeof value.revealed !== "boolean") fail(`${scope}.revealed`);
  if (
    godTier !== null &&
    (typeof godTier !== "number" || !Number.isInteger(godTier) || godTier < 1)
  ) {
    fail(`${scope}.godTier`);
  }
  if ((tier === null) === (godTier === null)) fail(`${scope} must have tier or godTier, not both`);
  const paths = Array.isArray(value.paths)
    ? value.paths.filter((item): item is string => typeof item === "string")
    : fail(`${scope}.paths`);
  const passivesRaw = Array.isArray(value.passives) ? value.passives : fail(`${scope}.passives`);
  const passives = passivesRaw.map((passive, i) =>
    assertPassive(passive, `${scope}.passives[${i}]`),
  );
  const choicesRaw = Array.isArray(value.choices) ? value.choices : fail(`${scope}.choices`);
  const choices = choicesRaw.map((choice, i) => assertChoice(choice, `${scope}.choices[${i}]`));
  return {
    progressionSlot,
    tier,
    revealed: value.revealed,
    godTier,
    paths,
    passives,
    choices,
    source: assertSource(value.source, scope),
    verified: value.verified === true,
  };
}

/** Throws when the generated shard is not a usable blessings document. */
export function assertBlessingsDocument(value: unknown): asserts value is BlessingsDocument {
  if (!isRecord(value)) fail("root not an object");
  if (!Array.isArray(value.paths) || value.paths.some((p) => typeof p !== "string")) {
    fail("paths");
  }
  if (!Array.isArray(value.godTiers) || value.godTiers.some((t) => typeof t !== "number")) {
    fail("godTiers");
  }
  if (typeof value.resetCount !== "number" || !Number.isFinite(value.resetCount)) {
    fail("resetCount");
  }
  if (!Array.isArray(value.records)) fail("records");
  const records = value.records.map((record, i) => assertRecord(record, i));
  const progressionSlots = new Set<number>();
  const pathTiers = new Set<number>();
  const godTiers = new Set<number>();
  for (const record of records) {
    if (progressionSlots.has(record.progressionSlot))
      fail(`duplicate progressionSlot ${record.progressionSlot}`);
    progressionSlots.add(record.progressionSlot);
    if (record.tier !== null) {
      if (pathTiers.has(record.tier)) fail(`duplicate path tier ${record.tier}`);
      pathTiers.add(record.tier);
    }
    if (record.godTier !== null) {
      if (godTiers.has(record.godTier)) fail(`duplicate god tier ${record.godTier}`);
      godTiers.add(record.godTier);
    }
  }
}

/** Stable ids in document order (tier, then choice order). */
export function collectBlessingIds(doc: BlessingsDocument): string[] {
  return doc.records.flatMap((record) => record.choices.map((choice) => choice.id));
}

/**
 * Normalize persisted blessing selections.
 * Accepts legacy path arrays or stable rows from either persistence schema.
 */
export function normalizeBlessingSelections(
  raw: unknown,
  resolve: {
    pathTiers: readonly number[];
    choiceAt: (
      tier: number,
      path: string,
    ) => { id: string; path: string; progressionSlot: number; tier: number } | undefined;
    choiceById: (
      id: string,
    ) => { id: string; path: string; progressionSlot: number; tier: number } | undefined;
    isPath: (value: unknown) => value is string;
  },
): { selections: NormalizedBlessingSelection[]; paths: string[] } {
  const selections: NormalizedBlessingSelection[] = [];
  const usedIds = new Set<string>();
  const usedProgressionSlots = new Set<number>();
  const push = (rawTier: number, blessingId: string): void => {
    if (usedIds.has(blessingId)) return;
    const choice = resolve.choiceById(blessingId);
    if (
      !choice ||
      (choice.progressionSlot !== rawTier && choice.tier !== rawTier) ||
      usedProgressionSlots.has(choice.progressionSlot)
    ) {
      return;
    }
    usedProgressionSlots.add(choice.progressionSlot);
    usedIds.add(blessingId);
    selections.push({
      progressionSlot: choice.progressionSlot,
      tier: choice.tier,
      blessingId,
      path: choice.path,
    });
  };
  if (Array.isArray(raw)) {
    const looksLikeSelections =
      raw.length > 0 &&
      typeof raw[0] === "object" &&
      raw[0] !== null &&
      ("blessingId" in (raw[0] as object) || "id" in (raw[0] as object));
    if (looksLikeSelections) {
      for (const entry of raw) {
        if (entry == null || typeof entry !== "object") continue;
        const row = entry as {
          tier?: unknown;
          progressionSlot?: unknown;
          blessingId?: unknown;
          id?: unknown;
        };
        const rawIdentity =
          typeof row.progressionSlot === "number" && Number.isFinite(row.progressionSlot)
            ? row.progressionSlot
            : typeof row.tier === "number" && Number.isFinite(row.tier)
              ? row.tier
              : null;
        if (rawIdentity === null) continue;
        const id =
          typeof row.blessingId === "string"
            ? row.blessingId
            : typeof row.id === "string"
              ? row.id
              : null;
        if (!id) continue;
        push(Math.trunc(rawIdentity), id);
      }
    } else {
      const paths = raw.filter(resolve.isPath).slice(0, resolve.pathTiers.length);
      paths.forEach((path, index) => {
        const tier = resolve.pathTiers[index];
        if (tier === undefined) return;
        const choice = resolve.choiceAt(tier, path);
        if (!choice) return;
        push(tier, choice.id);
      });
    }
  }
  const byTier = new Map(selections.map((sel) => [sel.tier, sel]));
  const ordered: NormalizedBlessingSelection[] = [];
  const paths: string[] = [];
  for (const tier of resolve.pathTiers) {
    const sel = byTier.get(tier);
    if (!sel) break;
    const choice = resolve.choiceById(sel.blessingId);
    if (!choice || choice.tier !== tier) break;
    ordered.push(sel);
    paths.push(choice.path);
  }
  return { selections: ordered, paths };
}

/** Non-throwing validation for tests and tooling. Empty array = valid. */
export function validateBlessingsDocument(doc: unknown): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  try {
    assertBlessingsDocument(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    issues.push({ path: "", message });
  }
  if (doc && typeof doc === "object" && Array.isArray((doc as { records?: unknown }).records)) {
    const seen = new Set<string>();
    for (const record of (
      doc as { records: { choices?: { id?: string; combat?: Record<string, unknown> }[] }[] }
    ).records) {
      for (const choice of record.choices ?? []) {
        if (choice.id) {
          if (seen.has(choice.id))
            issues.push({ path: choice.id, message: `duplicate id ${choice.id}` });
          seen.add(choice.id);
        }
        const combat = choice.combat ?? {};
        for (const [k, v] of Object.entries(combat)) {
          if (typeof v === "number" && !Number.isFinite(v)) {
            issues.push({ path: k, message: "must be a finite number" });
          }
          if (k === "light" && v && typeof v === "object") {
            const band = (v as { abilityDamageBand?: unknown }).abilityDamageBand;
            if (Array.isArray(band) && band.length === 2 && Number(band[0]) > Number(band[1])) {
              issues.push({ path: "light.abilityDamageBand", message: "invalid damage band" });
            }
          }
        }
      }
    }
  }
  // If assert passed and no structural issues, clear false positives from catch-only path
  if (issues.length === 1 && issues[0].path === "" && !/invalid/i.test(issues[0].message)) {
    return [];
  }
  // When assert succeeds, only return deep-scan issues
  try {
    assertBlessingsDocument(doc);
    return issues.filter((i) => i.path !== "" || /duplicate|finite|band/i.test(i.message));
  } catch {
    return issues;
  }
}
