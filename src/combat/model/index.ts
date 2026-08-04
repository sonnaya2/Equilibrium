export type {
  HostCombatResolveInput,
  ResolvedCombatModel,
  ResolvedCritInput,
  ResolvedModifierSources,
  ResolvedTargetScenario,
  ResolvedWeaponConfiguration,
} from "./contracts";

export type {
  ResolvedBerserkersFuryDiagnostics,
  ResolvedCombatDiagnostics,
} from "./diagnostics";
export {
  emptyBerserkersFuryDiagnostics,
  emptyCombatDiagnostics,
} from "./diagnostics";

export {
  emptyModifierSources,
  resolveModifierSourcesFromHost,
  resolveSetCounts,
  type ModifierSourcesHostInput,
} from "./modifierSources";

export {
  buildGlobalModifiersFromSources,
  modifiersForResolvedModel,
  modifiersFromSources,
} from "./modifiers";

export {
  buildResolvedCombatModel,
  isResolvedCombatModel,
} from "./resolve";

export {
  projectSerializableSimBase,
  reviveLeague,
  serializeLeague,
} from "./simulationInput";

export {
  buildManualStatSimulationInputBase,
  buildSimulationInputBase,
  resolveRevolutionBar,
  resolveRotationSpecs,
  toHybridManualCombatModel,
  toManualSimulateInput,
  toRevolutionInput,
  type ManualStatLine,
  type ManualStatScaffold,
  type SimulationInputBase,
} from "./simulationBase";

export {
  analyzeSingleCast,
  classifyStatefulLimitations,
  hostInputFromResolvedModel,
  overlayAnalysisStatLine,
  type AnalysisParity,
  type AnalysisStatLine,
  type SingleCastAnalysis,
  type SingleCastAnalysisOptions,
  type StatefulLimitation,
  type StatefulLimitationId,
} from "./singleCastAnalysis";
