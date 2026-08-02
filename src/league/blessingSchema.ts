/**
 * Runtime shape checks for the generated blessings document and persisted
 * blessing selections. No React, no combat — pure structural validation so the
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
  tier: number;
  revealed: boolean;
  godTier: boolean;
  paths: readonly string[];
  choices: readonly BlessingChoiceRecord[];
  source: SourceRefShape;
  verified?: boolean;
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

function assertRecord(value: unknown, index: number): BlessingTierRecord {
  const scope = `records[${index}]`;
  if (!isRecord(value)) fail(`${scope} not an object`);
  const tier = value.tier;
  if (typeof tier !== "number" || !Number.isFinite(tier)) fail(`${scope}.tier`);
  if (typeof value.revealed !== "boolean") fail(`${scope}.revealed`);
  if (typeof value.godTier !== "boolean") fail(`${scope}.godTier`);
  const paths = Array.isArray(value.paths)
    ? value.paths.filter((item): item is string => typeof item === "string")
    : fail(`${scope}.paths`);
  const choicesRaw = Array.isArray(value.choices) ? value.choices : fail(`${scope}.choices`);
  const choices = choicesRaw.map((choice, i) => assertChoice(choice, `${scope}.choices[${i}]`));
  return {
    tier,
    revealed: value.revealed,
    godTier: value.godTier,
    paths,
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
  // Walk every record so a corrupt choice fails at module load, not mid-pick.
  for (let i = 0; i < value.records.length; i++) assertRecord(value.records[i], i);
}

/** Stable ids in document order (tier, then choice order). */
export function collectBlessingIds(doc: BlessingsDocument): string[] {
  return doc.records.flatMap((record) => record.choices.map((choice) => choice.id));
}

/**
 * Normalize persisted blessing selections.
 * Accepts legacy path arrays or stable { tier, blessingId } / { tier, id } rows.
 */
export function normalizeBlessingSelections(
  raw: unknown,
  resolve: {
    pathTiers: readonly number[];
    choiceAt: (tier: number, path: string) => { id: string; path: string } | undefined;
    choiceById: (id: string) => { id: string; path: string; tier: number } | undefined;
    isPath: (value: unknown) => value is string;
  },
): { selections: NormalizedBlessingSelection[]; paths: string[] } {
  const selections: NormalizedBlessingSelection[] = [];
  const usedIds = new Set<string>();
  const usedTiers = new Set<number>();
  const push = (tier: number, blessingId: string): void => {
    if (usedTiers.has(tier) || usedIds.has(blessingId)) return;
    const choice = resolve.choiceById(blessingId);
    if (!choice || choice.tier !== tier) return;
    usedTiers.add(tier);
    usedIds.add(blessingId);
    selections.push({ tier, blessingId, path: choice.path });
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
        const row = entry as { tier?: unknown; blessingId?: unknown; id?: unknown };
        if (typeof row.tier !== "number" || !Number.isFinite(row.tier)) continue;
        const id =
          typeof row.blessingId === "string"
            ? row.blessingId
            : typeof row.id === "string"
              ? row.id
              : null;
        if (!id) continue;
        push(Math.trunc(row.tier), id);
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
