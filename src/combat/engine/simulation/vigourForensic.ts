import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type {
  AdrenalineRules,
  CastRecord,
  RotationSummary,
  SimulateInput,
  SimulateOptions,
} from "./contracts";
import { simulateRevolution, type RevolutionInput } from "./revolution";
import { simulate } from "./simulate";

/**
 * Deterministic A/B cast traces: Ring of Vigour off vs on (adrenaline.ringOfVigour
 * only; equipment ids held constant). Derives rows from CastRecord / RotationSummary.
 * https://runescape.wiki/w/Ring_of_vigour
 */

export interface GcdTraceRow {
  index: number;
  tick: number;
  abilityId: string;
  adrenalineBefore: number;
  actualSpend: number;
  adrenalineAfter: number;
  historyWeight: number;
  /** Running sum of cast.result.expected along the representative cast list. */
  cumulativeExpectedDamage: number;
  auto: boolean;
  listedCost: number;
  effectiveCost: number;
  ringOfVigourRefund: number;
  conservationOfEnergyRefund: number;
}

export interface VigourArmTrace {
  ringOfVigour: boolean;
  summary: RotationSummary;
  rows: GcdTraceRow[];
  sequence: readonly string[];
  totalExpected: number;
  dps: number;
}

export type SequenceDivergenceDiagnostic = {
  kind: "strict-priority-sequence-differs";
  index: number;
  tickOff: number;
  tickOn: number;
  abilityOff: string;
  abilityOn: string;
  /** Ability id that first differs (on-side when present, else off). */
  namedAbility: string;
  adrenBeforeOff: number;
  adrenBeforeOn: number;
  message: string;
};

export type AdrenalineDivergenceDiagnostic = {
  kind: "adrenaline-ledger-differs";
  index: number;
  abilityId: string;
  tickOff: number;
  tickOn: number;
  field: "adrenalineBefore" | "actualSpend" | "adrenalineAfter";
  off: number;
  on: number;
  message: string;
};

export type LengthDivergenceDiagnostic = {
  kind: "cast-count-differs";
  index: number;
  lengthOff: number;
  lengthOn: number;
  message: string;
};

export type VigourForensicDiagnostic =
  SequenceDivergenceDiagnostic | AdrenalineDivergenceDiagnostic | LengthDivergenceDiagnostic;

export interface VigourForensicReport {
  mode: "revolution" | "manual";
  off: VigourArmTrace;
  on: VigourArmTrace;
  /** First cast index where ability, adren ledger, or list length differs. */
  firstDivergenceIndex: number | null;
  firstDivergenceTick: { off: number | null; on: number | null } | null;
  sequenceEqual: boolean;
  /** First mismatch of any kind (ability, adren, length). */
  diagnostic: VigourForensicDiagnostic | null;
  /**
   * When ability order differs (even if adren already diverged earlier), names
   * the first differing selection. Null when sequences match.
   */
  sequenceDiagnostic: SequenceDivergenceDiagnostic | LengthDivergenceDiagnostic | null;
  /** on.totalExpected - off.totalExpected */
  damageDelta: number;
  dpsDelta: number;
}

export type VigourForensicRevolutionInput = Omit<RevolutionInput, "adrenaline"> & {
  adrenaline?: AdrenalineRules;
};

export type VigourForensicManualInput = Omit<SimulateInput, "adrenaline"> & {
  adrenaline?: AdrenalineRules;
};

function adrenWithoutVigourFlag(rules: AdrenalineRules | undefined): AdrenalineRules {
  const next: AdrenalineRules = { ...(rules ?? {}) };
  next.ringOfVigour = false;
  return next;
}

function adrenWithVigourFlag(rules: AdrenalineRules | undefined): AdrenalineRules {
  const next: AdrenalineRules = { ...(rules ?? {}) };
  next.ringOfVigour = true;
  return next;
}

function pathWeight(summary: RotationSummary): number {
  const w = summary.history?.historyWeight;
  return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 1;
}

/** Build per-GCD rows from a finished summary (representative cast list). */
export function buildCastTrace(summary: RotationSummary): GcdTraceRow[] {
  const weight = pathWeight(summary);
  let cumulative = 0;
  return summary.casts.map((cast, index) => {
    cumulative += cast.result?.expected ?? 0;
    return rowFromCast(cast, index, weight, cumulative);
  });
}

function rowFromCast(
  cast: CastRecord,
  index: number,
  historyWeight: number,
  cumulativeExpectedDamage: number,
): GcdTraceRow {
  const tx = cast.adrenalineTransaction;
  return {
    index,
    tick: cast.tick,
    abilityId: cast.abilityId,
    adrenalineBefore: cast.adrenalineBefore,
    actualSpend: cast.actualSpend,
    adrenalineAfter: cast.adrenalineAfter,
    historyWeight,
    cumulativeExpectedDamage,
    auto: cast.auto === true,
    listedCost: cast.listedCost,
    effectiveCost: cast.effectiveCost,
    ringOfVigourRefund: tx?.ringOfVigourRefund ?? 0,
    conservationOfEnergyRefund: tx?.conservationOfEnergyRefund ?? 0,
  };
}

function armFromSummary(summary: RotationSummary, ringOfVigour: boolean): VigourArmTrace {
  const rows = buildCastTrace(summary);
  return {
    ringOfVigour,
    summary,
    rows,
    sequence: rows.map((r) => r.abilityId),
    totalExpected: summary.totalExpected,
    dps: summary.dps,
  };
}

function sequenceMessage(
  index: number,
  off: GcdTraceRow,
  on: GcdTraceRow,
): SequenceDivergenceDiagnostic {
  const namedAbility = on.abilityId !== off.abilityId ? on.abilityId : off.abilityId;
  return {
    kind: "strict-priority-sequence-differs",
    index,
    tickOff: off.tick,
    tickOn: on.tick,
    abilityOff: off.abilityId,
    abilityOn: on.abilityId,
    namedAbility,
    adrenBeforeOff: off.adrenalineBefore,
    adrenBeforeOn: on.adrenalineBefore,
    message:
      `At cast index ${index}, strict priority selected "${on.abilityId}" with Vigour ` +
      `(tick ${on.tick}, adren before ${on.adrenalineBefore}) vs "${off.abilityId}" without ` +
      `(tick ${off.tick}, adren before ${off.adrenalineBefore}). Named ability: ${namedAbility}.`,
  };
}

function adrenFieldDiff(
  index: number,
  off: GcdTraceRow,
  on: GcdTraceRow,
): AdrenalineDivergenceDiagnostic | null {
  const fields = ["adrenalineBefore", "actualSpend", "adrenalineAfter"] as const;
  for (const field of fields) {
    if (off[field] !== on[field]) {
      return {
        kind: "adrenaline-ledger-differs",
        index,
        abilityId: off.abilityId,
        tickOff: off.tick,
        tickOn: on.tick,
        field,
        off: off[field],
        on: on[field],
        message:
          `At cast index ${index} (${off.abilityId}), ${field} differs: ` +
          `Vigour off=${off[field]}, on=${on[field]} ` +
          `(ticks ${off.tick}/${on.tick}).`,
      };
    }
  }
  return null;
}

function findSequenceDiagnostic(
  off: VigourArmTrace,
  on: VigourArmTrace,
): SequenceDivergenceDiagnostic | LengthDivergenceDiagnostic | null {
  const n = Math.max(off.rows.length, on.rows.length);
  for (let i = 0; i < n; i++) {
    const a = off.rows[i];
    const b = on.rows[i];
    if (!a || !b) {
      return {
        kind: "cast-count-differs",
        index: i,
        lengthOff: off.rows.length,
        lengthOn: on.rows.length,
        message: `Cast lists diverge at index ${i}: length off=${off.rows.length}, on=${on.rows.length}.`,
      };
    }
    if (a.abilityId !== b.abilityId) return sequenceMessage(i, a, b);
  }
  return null;
}

/** Compare two arm traces; structured facts only (no damage-value moralizing). */
export function diagnoseVigourDivergence(
  off: VigourArmTrace,
  on: VigourArmTrace,
): Pick<
  VigourForensicReport,
  | "firstDivergenceIndex"
  | "firstDivergenceTick"
  | "sequenceEqual"
  | "diagnostic"
  | "sequenceDiagnostic"
  | "damageDelta"
  | "dpsDelta"
> {
  const n = Math.max(off.rows.length, on.rows.length);
  let firstDivergenceIndex: number | null = null;
  let firstDivergenceTick: VigourForensicReport["firstDivergenceTick"] = null;
  let diagnostic: VigourForensicDiagnostic | null = null;

  for (let i = 0; i < n; i++) {
    const a = off.rows[i];
    const b = on.rows[i];
    if (!a || !b) {
      firstDivergenceIndex = i;
      firstDivergenceTick = { off: a?.tick ?? null, on: b?.tick ?? null };
      diagnostic = {
        kind: "cast-count-differs",
        index: i,
        lengthOff: off.rows.length,
        lengthOn: on.rows.length,
        message: `Cast lists diverge at index ${i}: length off=${off.rows.length}, on=${on.rows.length}.`,
      };
      break;
    }
    if (a.abilityId !== b.abilityId) {
      firstDivergenceIndex = i;
      firstDivergenceTick = { off: a.tick, on: b.tick };
      diagnostic = sequenceMessage(i, a, b);
      break;
    }
    const adrenDiag = adrenFieldDiff(i, a, b);
    if (adrenDiag) {
      firstDivergenceIndex = i;
      firstDivergenceTick = { off: a.tick, on: b.tick };
      diagnostic = adrenDiag;
      break;
    }
  }

  const sequenceDiagnostic = findSequenceDiagnostic(off, on);
  const sequenceEqual = sequenceDiagnostic === null;

  return {
    firstDivergenceIndex,
    firstDivergenceTick,
    sequenceEqual,
    diagnostic,
    sequenceDiagnostic,
    damageDelta: on.totalExpected - off.totalExpected,
    dpsDelta: on.dps - off.dps,
  };
}

function compareArms(
  mode: "revolution" | "manual",
  offSummary: RotationSummary,
  onSummary: RotationSummary,
): VigourForensicReport {
  const off = armFromSummary(offSummary, false);
  const on = armFromSummary(onSummary, true);
  return {
    mode,
    off,
    on,
    ...diagnoseVigourDivergence(off, on),
  };
}

/**
 * A/B Revolution: same bar/loadout/horizon; only adrenaline.ringOfVigour flips.
 * Does not add item:ring-of-vigour to equipmentIds (permanent flag path).
 */
export function compareVigourRevolution(
  input: VigourForensicRevolutionInput,
  options?: SimulateOptions,
): VigourForensicReport {
  const baseAdren = input.adrenaline;
  const off = simulateRevolution(
    { ...input, adrenaline: adrenWithoutVigourFlag(baseAdren) },
    options,
  );
  const on = simulateRevolution({ ...input, adrenaline: adrenWithVigourFlag(baseAdren) }, options);
  return compareArms("revolution", off, on);
}

/**
 * A/B manual rotation: same queued actions; only adrenaline.ringOfVigour flips.
 */
export function compareVigourManual(
  input: VigourForensicManualInput,
  options?: SimulateOptions,
): VigourForensicReport {
  const baseAdren = input.adrenaline;
  const off = simulate({ ...input, adrenaline: adrenWithoutVigourFlag(baseAdren) }, options);
  const on = simulate({ ...input, adrenaline: adrenWithVigourFlag(baseAdren) }, options);
  return compareArms("manual", off, on);
}

/** Compact one-line timeline for assertions / logs. */
export function formatTraceTimeline(rows: readonly GcdTraceRow[], limit = 24): string {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `${r.abilityId}@${r.tick}:a${r.adrenalineBefore}->${r.adrenalineAfter}` +
        (r.actualSpend > 0 ? `:s${r.actualSpend}` : ""),
    )
    .join(" | ");
}

/** Resolve bar ability specs by id from a catalogue (test helper surface). */
export function specsById(
  catalogue: readonly AbilitySpec[],
  ids: readonly string[],
): AbilitySpec[] {
  const map = new Map(catalogue.map((a) => [a.id, a]));
  return ids.map((id) => {
    const spec = map.get(id);
    if (!spec) throw new Error(`missing ability: ${id}`);
    return spec;
  });
}
