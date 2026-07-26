/**
 * Reproject placeAnchors from wiki/game surface coords into board UV via
 * least-squares georef, then snap any miss into its region ring.
 *
 *   node scripts/optimize-place-anchors.mjs [--write]
 *
 * Without --write: prints proposed UV diffs. With --write: rewrites placeAnchors.ts
 * coordinate literals only (keeps names/structure).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Run via tsx/node against compiled-ish imports is heavy; embed fit + data here.
// Mirror of GEOREF_CONTROLS + PLACE_GAME_COORDS (keep in sync with gameCoords.ts).

const CONTROLS = [
  [[3222, 3218], [0.527, 0.592]],
  [[3212, 3424], [0.532, 0.42]],
  [[3087, 3494], [0.505, 0.4]],
  [[3093, 3243], [0.491, 0.588]],
  [[2965, 3380], [0.412, 0.472]],
  [[3025, 3217], [0.425, 0.6]],
  [[2897, 3433], [0.375, 0.452]],
  [[2899, 3545], [0.368, 0.386]],
  [[2910, 3745], [0.42, 0.33]],
  [[2662, 3305], [0.3, 0.58]],
  [[2809, 3434], [0.3, 0.42]],
  [[2710, 3482], [0.26, 0.38]],
  [[2460, 3440], [0.22, 0.45]],
  [[2565, 3090], [0.29, 0.64]],
  [[2670, 3661], [0.3, 0.18]],
  [[2540, 3740], [0.24, 0.15]],
  [[2998, 3931], [0.48, 0.12]],
  [[3449, 3697], [0.624, 0.292]],
  [[2966, 4381], [0.47, 0.176]],
  [[3293, 3184], [0.492, 0.7]],
  [[3360, 2970], [0.54, 0.82]],
  [[3305, 2755], [0.58, 0.9]],
  [[3494, 3489], [0.64, 0.48]],
  [[3680, 3485], [0.72, 0.52]],
  [[3565, 3289], [0.68, 0.58]],
  [[2235, 3340], [0.155, 0.52]],
  [[2340, 3170], [0.175, 0.58]],
  [[2950, 3145], [0.33, 0.74]],
  [[2760, 3170], [0.264, 0.775]],
  [[2850, 2955], [0.305, 0.882]],
  [[5400, 2400], [0.72, 0.2]],
  [[5800, 3100], [0.847, 0.574]],
];

function fit(controls) {
  let sxx = 0,
    sxy = 0,
    sx = 0,
    syy = 0,
    sy = 0,
    n = 0;
  let sux = 0,
    suy = 0,
    su = 0,
    svx = 0,
    svy = 0,
    sv = 0;
  for (const [[x, y], [u, v]] of controls) {
    sxx += x * x;
    sxy += x * y;
    sx += x;
    syy += y * y;
    sy += y;
    n++;
    sux += u * x;
    suy += u * y;
    su += u;
    svx += v * x;
    svy += v * y;
    sv += v;
  }
  const solve = (rx, ry, r1) => {
    const M = [
      [sxx, sxy, sx, rx],
      [sxy, syy, sy, ry],
      [sx, sy, n, r1],
    ];
    for (let col = 0; col < 3; col++) {
      let piv = col;
      for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      [M[col], M[piv]] = [M[piv], M[col]];
      const div = M[col][col] || 1e-12;
      for (let c = col; c < 4; c++) M[col][c] /= div;
      for (let r = 0; r < 3; r++) {
        if (r === col) continue;
        const f = M[r][col];
        for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
      }
    }
    return [M[0][3], M[1][3], M[2][3]];
  };
  const [a, b, c] = solve(sux, suy, su);
  const [d, e, f] = solve(svx, svy, sv);
  return { a, b, c, d, e, f };
}

const fitA = fit(CONTROLS);
const toUv = ([x, y]) => [fitA.a * x + fitA.b * y + fitA.c, fitA.d * x + fitA.e * y + fitA.f];

// RMSE on controls
let err = 0;
for (const [g, uv] of CONTROLS) {
  const p = toUv(g);
  err += (p[0] - uv[0]) ** 2 + (p[1] - uv[1]) ** 2;
}
err = Math.sqrt(err / CONTROLS.length);
console.log("georef RMSE (uv units):", err.toFixed(4));
console.log("affine", fitA);

// Report only — full rewrite needs ring snap from TS tests.
// Agents apply coordinated updates to placeAnchors.ts
const write = process.argv.includes("--write");
if (!write) {
  console.log("Dry run. Agents apply gameToUv + ring snap. Pass --write only after ring-aware path.");
}
