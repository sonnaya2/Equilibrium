/**
 * Combat-layer architecture detectors (pure).
 *
 * Used by check.mjs (gate) and check.self-test.mjs (proves rules fire).
 */
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const fwd = (p) => p.split(sep).join("/");

/** Strip // and /* * / comments so string matches in comments are ignored. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Extract module specifier strings from import/export/require forms.
 * Handles: import x from 'm', import('m'), require('m'), export ... from 'm',
 * import type { X } from 'm'.
 */
export function extractImportSpecs(source) {
  const text = stripComments(source);
  const specs = [];
  const re =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

/**
 * Resolve a module specifier to a repo-relative posix path when it points
 * inside the repo (relative, @/..., or src/...). External packages return null.
 */
export function resolveSpecToRepoPath(filePath, spec, root) {
  const fileDir = dirname(filePath);
  let abs;
  if (spec.startsWith("@/")) {
    abs = resolve(root, "src", spec.slice(2));
  } else if (spec.startsWith("src/") || spec === "src") {
    abs = resolve(root, spec);
  } else if (spec.startsWith(".")) {
    abs = resolve(fileDir, spec);
  } else {
    return null;
  }
  // Extension-less path is fine; only directory membership matters.
  const rel = fwd(relative(root, abs));
  if (rel.startsWith("..") || rel === "") return null;
  return rel;
}

export function isTestFile(repoRelPath) {
  const base = repoRelPath.split("/").pop() ?? "";
  return /\.test\.(ts|tsx)$/.test(base);
}

export function isUnder(repoRelPath, prefix) {
  const p = fwd(repoRelPath);
  const pre = fwd(prefix).replace(/\/$/, "");
  return p === pre || p.startsWith(pre + "/");
}

/** Production UI surfaces: components + Next app routes. */
export function isUiSurface(repoRelPath) {
  const p = fwd(repoRelPath);
  return isUnder(p, "src/components") || isUnder(p, "app");
}

/** Spec points at UI components (@/components, src/components, or relative into it). */
export function isComponentsImport(filePath, spec, root) {
  if (spec === "@/components" || spec.startsWith("@/components/")) return true;
  if (spec === "src/components" || spec.startsWith("src/components/")) return true;
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return isUnder(resolved, "src/components");
}

/** Spec points at combat engine (src/combat/engine). */
export function isEngineImport(filePath, spec, root) {
  if (spec === "@/combat/engine" || spec.startsWith("@/combat/engine/")) return true;
  if (spec === "src/combat/engine" || spec.startsWith("src/combat/engine/")) return true;
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return isUnder(resolved, "src/combat/engine");
}

/**
 * Engine internals banned from UI: cast | resolution | runtime | schedulers.
 * Allowed: engine/simulation and the @/combat barrel that re-exports it.
 */
const BANNED_ENGINE_INTERNAL_DIRS = ["cast", "resolution", "runtime", "schedulers"];

/** True if import resolves into a banned engine internal; simulation returns false. */
export function isBannedEngineInternalImport(filePath, spec, root) {
  for (const dir of BANNED_ENGINE_INTERNAL_DIRS) {
    if (
      spec === `@/combat/engine/${dir}` ||
      spec.startsWith(`@/combat/engine/${dir}/`) ||
      spec === `src/combat/engine/${dir}` ||
      spec.startsWith(`src/combat/engine/${dir}/`)
    ) {
      return true;
    }
  }
  // engine root may re-export simulation; not banned by itself
  if (
    spec === "@/combat/engine" ||
    spec === "src/combat/engine" ||
    spec === "@/combat/engine/simulation" ||
    spec.startsWith("@/combat/engine/simulation/") ||
    spec === "src/combat/engine/simulation" ||
    spec.startsWith("src/combat/engine/simulation/")
  ) {
    return false;
  }

  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  if (!isUnder(resolved, "src/combat/engine")) return false;
  if (isUnder(resolved, "src/combat/engine/simulation")) return false;
  for (const dir of BANNED_ENGINE_INTERNAL_DIRS) {
    if (isUnder(resolved, `src/combat/engine/${dir}`)) return true;
  }
  // Unknown engine subfolder: ban for UI safety; engine root itself is allowed.
  const engineRoot = "src/combat/engine";
  if (resolved === engineRoot) return false;
  return isUnder(resolved, engineRoot);
}

export function isReactImport(spec) {
  return (
    spec === "react" ||
    spec === "react-dom" ||
    spec.startsWith("react/") ||
    spec.startsWith("react-dom/")
  );
}

/**
 * @typedef {{ rule: string, file: string, spec: string, detail: string }} Violation
 */

/**
 * Evaluate all architecture rules for one file's source.
 * @param {object} opts
 * @param {string} opts.root - repo root absolute
 * @param {string} opts.filePath - absolute path to the file
 * @param {string} opts.repoRel - posix path relative to root
 * @param {string} opts.source - file text
 * @param {Set<string>} [opts.allowlist] - repo-rel paths exempt from reporting
 * @returns {Violation[]}
 */
export function checkFile(opts) {
  const { root, filePath, repoRel, source, allowlist = new Set() } = opts;
  const rel = fwd(repoRel);
  if (allowlist.has(rel)) return [];

  const specs = extractImportSpecs(source);
  /** @type {Violation[]} */
  const out = [];
  const production = !isTestFile(rel);
  const underCombat = isUnder(rel, "src/combat");
  const underUi = isUiSurface(rel);

  if (underUi && production) {
    for (const spec of specs) {
      if (isBannedEngineInternalImport(filePath, spec, root)) {
        out.push({
          rule: "ui-no-engine-internals",
          file: rel,
          spec,
          detail:
            "UI must not import engine cast/resolution/runtime/schedulers (use @/combat or engine/simulation)",
        });
      }
    }
  }

  if (!underCombat) return out;

  for (const spec of specs) {
    if (production && isComponentsImport(filePath, spec, root)) {
      out.push({
        rule: "combat-no-components",
        file: rel,
        spec,
        detail: "src/combat must not import from components",
      });
    }

    if (isUnder(rel, "src/combat/shared") && isEngineImport(filePath, spec, root)) {
      out.push({
        rule: "shared-no-engine",
        file: rel,
        spec,
        detail: "src/combat/shared must not import from src/combat/engine",
      });
    }

    // Solver production: no react / components (*.test.ts may use loadout fixtures)
    if (production && isUnder(rel, "src/combat/solver")) {
      if (isReactImport(spec)) {
        out.push({
          rule: "solver-no-react",
          file: rel,
          spec,
          detail: "src/combat/solver must not import react or react-dom",
        });
      }
      if (isComponentsImport(filePath, spec, root)) {
        out.push({
          rule: "solver-no-components",
          file: rel,
          spec,
          detail: "src/combat/solver must not import from components",
        });
      }
    }

    if (
      production &&
      isUnder(rel, "src/combat/engine") &&
      isComponentsImport(filePath, spec, root)
    ) {
      out.push({
        rule: "engine-no-components",
        file: rel,
        spec,
        detail: "src/combat/engine must not import from components",
      });
    }
  }

  return out;
}

export { normalize, join, resolve, relative, fwd };
