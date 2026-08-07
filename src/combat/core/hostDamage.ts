export interface HostAttachedTerm {
  readonly id: string;
  readonly amount: number;
}

export interface HostDamageInstance<THost, TTerm extends HostAttachedTerm = HostAttachedTerm> {
  readonly host: THost;
  readonly attached: readonly TTerm[];
}

export interface ResolvedHostAttached<TResolved, TTerm extends HostAttachedTerm> {
  readonly term: TTerm;
  readonly damage: TResolved;
}

export interface ResolvedHostDamage<TResolved, TTerm extends HostAttachedTerm> {
  readonly damage: TResolved;
  readonly hostDamage: TResolved;
  readonly attached: readonly ResolvedHostAttached<TResolved, TTerm>[];
}

export function resolveHostDamageInstance<THost, TResolved, TTerm extends HostAttachedTerm>(
  instance: HostDamageInstance<THost, TTerm>,
  operations: {
    readonly add: (host: THost, amount: number) => THost;
    readonly resolve: (host: THost) => TResolved;
    readonly delta: (after: TResolved, before: TResolved) => TResolved;
  },
): ResolvedHostDamage<TResolved, TTerm> {
  const hostDamage = operations.resolve(instance.host);
  if (instance.attached.length === 0) {
    return { damage: hostDamage, hostDamage, attached: [] };
  }

  let combined = instance.host;
  let previous = hostDamage;
  const attached: ResolvedHostAttached<TResolved, TTerm>[] = [];
  for (const term of instance.attached) {
    if (!Number.isFinite(term.amount) || term.amount < 0 || !Number.isInteger(term.amount)) {
      throw new RangeError(
        `resolveHostDamageInstance: ${term.id} amount must be a non-negative integer`,
      );
    }
    combined = operations.add(combined, term.amount);
    const next = operations.resolve(combined);
    attached.push({ term, damage: operations.delta(next, previous) });
    previous = next;
  }
  return { damage: previous, hostDamage, attached };
}
