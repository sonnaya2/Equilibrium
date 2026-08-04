import {
  OBJECTIVE_VERSION,
  SOLVER_SCHEMA_VERSION,
  type Bar,
  type ScoreEvalMode,
} from "./contracts";
import { noteFingerprintJoin } from "./profiling";

/**
 * Canonical ordered bar identity (NUL separators). Pure; no profiling.
 * Single join helper for search visited sets, tryEval cache keys, beam, neighbors.
 */
export function barKey(bar: readonly string[]): string {
  return bar.join("\0");
}

/** Ordered bar identity - slot order matters. Counts fingerprint joins when profiling. */
export function fingerprintBar(bar: Bar): string {
  noteFingerprintJoin();
  return barKey(bar);
}

/** Deterministic JSON with sorted object keys at every level. */
export function stableStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new TypeError(`stableStringify: non-finite number ${String(value)}`);
    }
    return JSON.stringify(value);
  }
  if (t === "boolean" || t === "string") return JSON.stringify(value);
  if (t === "undefined") return "null";
  if (t === "bigint") return JSON.stringify(String(value));
  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(",")}}`;
  }
  throw new TypeError(`stableStringify: unsupported type ${t}`);
}

export interface EvaluationKeyParts {
  bar: Bar;
  /**
   * Precomputed {@link barKey} for `bar`. When set, skips a second join
   * (and the profiling counter that {@link fingerprintBar} would bump).
   */
  barKey?: string;
  /** Opaque evaluation context (loadout, target, league, horizon, profile…). */
  context?: unknown;
  profileId?: string;
  customWeights?: unknown;
  horizonTicks?: number;
  /** search vs full - required for mode-separated caches. */
  mode?: ScoreEvalMode;
  objectiveVersion?: number;
}

/** Cache key for a bar evaluation - includes schema, objective version, and mode. */
export function fingerprintEvaluationKey(parts: EvaluationKeyParts): string {
  const barFp = parts.barKey ?? fingerprintBar(parts.bar);
  return [
    `v${SOLVER_SCHEMA_VERSION}`,
    `ov${parts.objectiveVersion ?? OBJECTIVE_VERSION}`,
    `mode=${parts.mode ?? "search"}`,
    barFp,
    parts.profileId ?? "",
    parts.horizonTicks === undefined ? "" : String(parts.horizonTicks),
    stableStringify(parts.customWeights ?? null),
    stableStringify(parts.context ?? null),
  ].join("\0");
}
