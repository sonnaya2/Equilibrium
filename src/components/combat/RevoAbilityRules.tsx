"use client";

import { memo, useMemo, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import {
  solverAbilityRuleFor,
  type SolverAbilityRule,
  type SolverAbilityRules,
} from "./solverAbilityRules";

export const RevoAbilityRules = memo(function RevoAbilityRules({
  abilities,
  rules,
  controlsDisabled,
  onRuleChange,
  onClear,
}: {
  abilities: readonly AbilitySpec[];
  rules: SolverAbilityRules;
  controlsDisabled: boolean;
  onRuleChange: (abilityId: string, rule: SolverAbilityRule) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleAbilities = useMemo(
    () =>
      normalizedQuery.length === 0
        ? abilities
        : abilities.filter((ability) => ability.name.toLocaleLowerCase().includes(normalizedQuery)),
    [abilities, normalizedQuery],
  );
  const ruleCount = rules.lockedAbilityIds.length + rules.disabledAbilityIds.length;

  return (
    <details className="revo-ability-rules" data-testid="revo-ability-rules">
      <summary>
        <span>Ability rules</span>
        {ruleCount > 0 ? (
          <span className="revo-ability-rules__count">
            {rules.lockedAbilityIds.length} locked · {rules.disabledAbilityIds.length} disabled
          </span>
        ) : (
          <span className="revo-ability-rules__count">All available</span>
        )}
      </summary>
      <div className="revo-ability-rules__panel">
        <div className="revo-ability-rules__toolbar">
          <label>
            <span className="sr-only">Search optimizer abilities</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find ability"
              disabled={controlsDisabled}
              data-testid="revo-ability-rules-search"
            />
          </label>
          <button
            type="button"
            className="revo-ability-rules__clear"
            onClick={onClear}
            disabled={controlsDisabled || ruleCount === 0}
          >
            Clear rules
          </button>
        </div>
        <p className="revo-ability-rules__help">
          Locked abilities must appear in every searched bar. Disabled abilities are excluded from
          searched bars.
        </p>
        <ul className="revo-ability-rules__list">
          {visibleAbilities.map((ability) => {
            const rule = solverAbilityRuleFor(rules, ability.id);
            return (
              <li key={ability.id} data-rule={rule}>
                <GameIcon
                  src={abilityIconPath(ability.id, ability.style)}
                  size={24}
                  className="revo-ability-rules__icon"
                />
                <span className="revo-ability-rules__name">{ability.name}</span>
                <span className="revo-ability-rules__category">{ability.category}</span>
                <div className="revo-ability-rules__actions" role="group" aria-label={ability.name}>
                  <button
                    type="button"
                    aria-pressed={rule === "locked"}
                    aria-label={`Lock ${ability.name}`}
                    disabled={controlsDisabled}
                    onClick={() =>
                      onRuleChange(ability.id, rule === "locked" ? "normal" : "locked")
                    }
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    aria-pressed={rule === "disabled"}
                    aria-label={`Disable ${ability.name}`}
                    disabled={controlsDisabled}
                    onClick={() =>
                      onRuleChange(ability.id, rule === "disabled" ? "normal" : "disabled")
                    }
                  >
                    Off
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {visibleAbilities.length === 0 ? (
          <p className="revo-ability-rules__empty">No matching abilities.</p>
        ) : null}
      </div>
    </details>
  );
});
