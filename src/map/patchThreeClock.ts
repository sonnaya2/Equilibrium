/**
 * R3F v9 constructs `new THREE.Clock()` for every Canvas store. three r183+
 * deprecates Clock for Timer and warns on every construct. R3F v10 removes
 * Clock (pmndrs/react-three-fiber#3741) but is still canary — until we take it,
 * swallow only that deprecation line so the map console stays clean.
 *
 * three seals its ESM namespace (Clock is non-configurable), so we cannot
 * replace THREE.Clock with a Timer-backed stand-in at runtime. three's own
 * setConsoleFunction is the supported intercept for this class of noise.
 *
 * Import for side effect before any <Canvas> mounts.
 */

import { getConsoleFunction, setConsoleFunction } from "three";

let patched = false;

const CLOCK_DEPRECATION = /Clock: This module has been deprecated/;

export function patchThreeClock(): void {
  if (patched) return;
  patched = true;

  const prev = getConsoleFunction();
  setConsoleFunction((type, message, ...params) => {
    if (
      type === "warn" &&
      typeof message === "string" &&
      CLOCK_DEPRECATION.test(message)
    ) {
      return;
    }
    if (prev) {
      prev(type, message, ...params);
      return;
    }
    // Mirror three's default path for stack-trace objects and plain messages.
    const stackTrace = params[0] as { isStackTrace?: boolean; getError?: (m: string) => unknown } | undefined;
    if (stackTrace?.isStackTrace && typeof stackTrace.getError === "function") {
      const out = stackTrace.getError(message as string);
      if (type === "error") console.error(out);
      else if (type === "warn") console.warn(out);
      else console.log(out);
      return;
    }
    if (type === "error") console.error(message, ...params);
    else if (type === "warn") console.warn(message, ...params);
    else console.log(message, ...params);
  });
}

if (typeof window !== "undefined") {
  patchThreeClock();
}
