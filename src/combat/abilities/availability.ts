/** Re-export pure unlock resolution (lives in data/ to avoid cycles with styles). */
export {
  isObtainableInRegions,
  resolveAvailability,
  resolveRegionMode,
  type AbilityAvailability,
  type RegionRequirementMode,
} from "../data/availability";
