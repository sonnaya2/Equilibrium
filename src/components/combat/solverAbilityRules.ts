export type SolverAbilityRule = "normal" | "locked" | "disabled";

export type SolverAbilityRules = {
  lockedAbilityIds: readonly string[];
  disabledAbilityIds: readonly string[];
};

export type SolverAbilityRuleTarget = {
  id: string;
  replacementGroup?: string;
};

export function filterSolverAbilitiesByCategory<T extends { category: string }>(
  abilities: readonly T[],
  permittedCategories: readonly string[],
): T[] {
  const permitted = new Set(permittedCategories);
  return abilities.filter((ability) => permitted.has(ability.category));
}

function without(ids: readonly string[], abilityId: string): string[] {
  return ids.filter((id) => id !== abilityId);
}

export function setSolverAbilityRule(
  rules: SolverAbilityRules,
  abilityId: string,
  rule: SolverAbilityRule,
  abilities: readonly SolverAbilityRuleTarget[] = [],
): SolverAbilityRules {
  const groupById = new Map(abilities.map((ability) => [ability.id, ability.replacementGroup]));
  const targetGroup = groupById.get(abilityId);
  const locked = without(rules.lockedAbilityIds, abilityId);
  const disabled = without(rules.disabledAbilityIds, abilityId);
  if (rule === "locked") {
    const withoutPeerLocks = locked.filter(
      (id) => targetGroup == null || groupById.get(id) !== targetGroup,
    );
    withoutPeerLocks.push(abilityId);
    return {
      lockedAbilityIds: withoutPeerLocks,
      disabledAbilityIds: disabled,
    };
  }
  if (rule === "disabled") disabled.push(abilityId);
  return {
    lockedAbilityIds: locked,
    disabledAbilityIds: disabled,
  };
}

export function pruneSolverAbilityRules(
  rules: SolverAbilityRules,
  availableIds: ReadonlySet<string>,
): SolverAbilityRules {
  return {
    lockedAbilityIds: rules.lockedAbilityIds.filter((id) => availableIds.has(id)),
    disabledAbilityIds: rules.disabledAbilityIds.filter((id) => availableIds.has(id)),
  };
}

export function solverAbilityRuleFor(
  rules: SolverAbilityRules,
  abilityId: string,
): SolverAbilityRule {
  if (rules.lockedAbilityIds.includes(abilityId)) return "locked";
  if (rules.disabledAbilityIds.includes(abilityId)) return "disabled";
  return "normal";
}
