/**
 * Combat inventory public-api surface.
 * Re-exports architecture allowlist/ban list; adds worker keep policy.
 */
export {
  PUBLIC_BARREL_MODULES,
  BARREL_BANNED_STAR_PREFIXES,
  isBannedBarrelStarExport,
} from "../architecture/public-api.mjs";

/** @deprecated Prefer PUBLIC_BARREL_MODULES */
export { PUBLIC_BARREL_MODULES as PUBLIC_API_ALLOWLIST } from "../architecture/public-api.mjs";

/** @deprecated Prefer BARREL_BANNED_STAR_PREFIXES */
export { BARREL_BANNED_STAR_PREFIXES as PUBLIC_API_BAN_LIST } from "../architecture/public-api.mjs";

/** Worker entry files treated as production-reachable even when static importers are sparse. */
export const WORKER_KEEP_PATHS = [
  "src/combat/solver/worker/revolutionSolver.worker.ts",
];

/** Path substrings that mark dynamic worker entry points (manual-review keep). */
export const WORKER_DYNAMIC_PATTERNS = [
  "revolutionSolver.worker",
  "new URL(",
];
