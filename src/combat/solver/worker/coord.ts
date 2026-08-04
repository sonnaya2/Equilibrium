/**
 * Host-coordinated pool state: one global evaluation budget, shared visited
 * bar keys, shared incumbent. Message-batch based (no SharedArrayBuffer).
 *
 * Budget design: globalBudget = perAgentBudget * agentCount where
 * perAgentBudget = TIER_BUDGETS[tier]. Preserves Phase-0 total evaluation
 * capacity (N independent full tier budgets) while eliminating duplicate work
 * via shared visited and stopping stragglers once the global pool is spent.
 */

/** Max bar keys shipped in one coord / progress batch (clone cost). */
export const COORD_KEY_BATCH_MAX = 64;

export type CoordIncumbent = {
  bar: readonly string[];
  /** Exploratory best score (search-horizon units). */
  score: number;
  fullScore?: number;
};

export type HostCoordBatch = {
  seq: number;
  globalBudget: number;
  globalEvaluations: number;
  /** Soft-stop search (canEval false); finalize may still run until hard cancel. */
  stop: boolean;
  incumbent?: CoordIncumbent;
  /** Keys host newly wants this worker to treat as visited. */
  visitedKeys?: readonly string[];
};

export type WorkerCoordReport = {
  evaluations: number;
  uniqueCandidates: number;
  bestScore: number;
  bestFullScore?: number;
  topBarPreview?: readonly string[];
  /** New local keys since last drain (capped). */
  seenKeys?: readonly string[];
};

/** Host-side coordination for one pool run. */
export class PoolCoordHost {
  readonly agentCount: number;
  readonly perAgentBudget: number;
  readonly globalBudget: number;

  private readonly visited = new Set<string>();
  private readonly pushedToAgent: Set<string>[];
  private readonly agentEvals: number[];
  private seq = 0;
  private incumbent: CoordIncumbent | null = null;
  private stop = false;
  /** True once a worker sent real seenKeys batches (not preview-only noteBar). */
  private keysAuthoritative = false;
  stragglersCancelled = 0;

  constructor(agentCount: number, perAgentBudget: number) {
    this.agentCount = Math.max(1, agentCount);
    this.perAgentBudget = Math.max(0, perAgentBudget);
    this.globalBudget = this.perAgentBudget * this.agentCount;
    this.pushedToAgent = Array.from({ length: this.agentCount }, () => new Set());
    this.agentEvals = Array.from({ length: this.agentCount }, () => 0);
  }

  get uniqueCandidates(): number {
    return this.visited.size;
  }

  /** Host set size is honest only after workers report seenKeys (not preview bars alone). */
  get hasAuthoritativeUnique(): boolean {
    return this.keysAuthoritative;
  }

  get globalEvaluations(): number {
    let sum = 0;
    for (const n of this.agentEvals) sum += n;
    return sum;
  }

  get budgetExhausted(): boolean {
    return this.globalEvaluations >= this.globalBudget;
  }

  get shouldStop(): boolean {
    return this.stop || this.budgetExhausted;
  }

  getIncumbent(): CoordIncumbent | null {
    return this.incumbent;
  }

  agentEvaluations(): number[] {
    return [...this.agentEvals];
  }

  /**
   * Fold worker-reported bar keys. Marks the host unique set authoritative.
   * Use for progress.seenKeys / coord_report.seenKeys only.
   */
  noteKeys(keys: readonly string[] | undefined): number {
    if (!keys?.length) return 0;
    this.keysAuthoritative = true;
    let added = 0;
    for (const k of keys) {
      if (!k || this.visited.has(k)) continue;
      this.visited.add(k);
      added += 1;
    }
    return added;
  }

  /**
   * Fold a preview bar identity without claiming authoritative unique.
   * Used when workers have not yet streamed seenKeys.
   */
  noteBar(bar: readonly string[] | undefined): number {
    if (!bar?.length) return 0;
    const key = bar.join("\0");
    if (!key || this.visited.has(key)) return 0;
    this.visited.add(key);
    return 1;
  }

  noteAgentEvaluations(agentIndex: number, evaluations: number): void {
    if (agentIndex < 0 || agentIndex >= this.agentCount) return;
    const n = Math.max(0, Math.floor(evaluations) || 0);
    if (n > this.agentEvals[agentIndex]!) this.agentEvals[agentIndex] = n;
  }

  noteIncumbent(
    score: number,
    bar: readonly string[] | undefined,
    fullScore?: number,
  ): boolean {
    if (!Number.isFinite(score) || !bar?.length) return false;
    const prev = this.incumbent;
    if (prev && score <= prev.score) {
      if (
        fullScore != null &&
        Number.isFinite(fullScore) &&
        (prev.fullScore == null || fullScore > prev.fullScore)
      ) {
        this.incumbent = { ...prev, fullScore };
        return true;
      }
      return false;
    }
    this.incumbent = {
      bar: [...bar],
      score,
      ...(fullScore != null && Number.isFinite(fullScore) ? { fullScore } : {}),
    };
    return true;
  }

  requestStop(): void {
    this.stop = true;
  }

  batchFor(agentIndex: number): HostCoordBatch {
    this.seq += 1;
    const pushed = this.pushedToAgent[agentIndex] ?? new Set<string>();
    const fresh: string[] = [];
    for (const k of this.visited) {
      if (pushed.has(k)) continue;
      fresh.push(k);
      pushed.add(k);
      if (fresh.length >= COORD_KEY_BATCH_MAX) break;
    }
    const inc = this.incumbent;
    return {
      seq: this.seq,
      globalBudget: this.globalBudget,
      globalEvaluations: this.globalEvaluations,
      stop: this.shouldStop,
      ...(inc
        ? {
            incumbent: {
              bar: [...inc.bar],
              score: inc.score,
              ...(inc.fullScore != null ? { fullScore: inc.fullScore } : {}),
            },
          }
        : {}),
      ...(fresh.length ? { visitedKeys: fresh } : {}),
    };
  }

  batchIsUseful(batch: HostCoordBatch): boolean {
    if (batch.stop) return true;
    if (batch.visitedKeys?.length) return true;
    if (batch.incumbent) return true;
    return false;
  }
}

/** Worker-side coord mirror (message-batch only; no SharedArrayBuffer). */
export class WorkerCoordState {
  private readonly peerVisited = new Set<string>();
  private readonly localEvaluated = new Set<string>();
  private readonly pendingReport = new Set<string>();
  private softStop = false;
  private incumbent: CoordIncumbent | null = null;
  private lastSeq = 0;
  globalBudget = 0;
  globalEvaluations = 0;

  get stopped(): boolean {
    return this.softStop;
  }

  getIncumbent(): CoordIncumbent | null {
    return this.incumbent;
  }

  shouldSkip(fingerprint: string): boolean {
    return this.peerVisited.has(fingerprint) && !this.localEvaluated.has(fingerprint);
  }

  noteLocalSeen(fingerprint: string): void {
    if (!fingerprint) return;
    this.localEvaluated.add(fingerprint);
    this.pendingReport.add(fingerprint);
  }

  drainSeenKeys(max = COORD_KEY_BATCH_MAX): string[] {
    if (this.pendingReport.size === 0) return [];
    const out: string[] = [];
    for (const k of this.pendingReport) {
      out.push(k);
      this.pendingReport.delete(k);
      if (out.length >= max) break;
    }
    return out;
  }

  applyHostBatch(batch: HostCoordBatch): void {
    if (batch.seq < this.lastSeq) return;
    this.lastSeq = batch.seq;
    this.globalBudget = batch.globalBudget;
    this.globalEvaluations = batch.globalEvaluations;
    if (batch.stop) this.softStop = true;
    if (batch.visitedKeys?.length) {
      for (const k of batch.visitedKeys) {
        if (!k) continue;
        this.peerVisited.add(k);
        this.pendingReport.delete(k);
      }
    }
    if (batch.incumbent && Number.isFinite(batch.incumbent.score)) {
      const prev = this.incumbent;
      if (!prev || batch.incumbent.score > prev.score) {
        this.incumbent = {
          bar: [...batch.incumbent.bar],
          score: batch.incumbent.score,
          ...(batch.incumbent.fullScore != null
            ? { fullScore: batch.incumbent.fullScore }
            : {}),
        };
      }
    }
  }
}
