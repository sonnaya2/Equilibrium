/** Suppress Three's Clock deprecation until R3F removes its Clock dependency. */

import { getConsoleFunction, setConsoleFunction } from "three";

let patched = false;

const CLOCK_DEPRECATION = /Clock: This module has been deprecated/;

export function patchThreeClock(): void {
  if (patched) return;
  patched = true;

  const prev = getConsoleFunction();
  setConsoleFunction((type, message, ...params) => {
    if (type === "warn" && typeof message === "string" && CLOCK_DEPRECATION.test(message)) {
      return;
    }
    if (prev) {
      prev(type, message, ...params);
      return;
    }
    // Mirror three's default path for stack-trace objects and plain messages.
    const stackTrace = params[0] as
      { isStackTrace?: boolean; getError?: (m: string) => unknown } | undefined;
    if (stackTrace?.isStackTrace && typeof stackTrace.getError === "function") {
      const out = stackTrace.getError(message as string);
      if (type === "error") console.error(out);
      else if (type === "warn") console.warn(out);
      // eslint-disable-next-line no-console -- preserve Three's requested console level
      else console.log(out);
      return;
    }
    if (type === "error") console.error(message, ...params);
    else if (type === "warn") console.warn(message, ...params);
    // eslint-disable-next-line no-console -- preserve Three's requested console level
    else console.log(message, ...params);
  });
}

if (typeof window !== "undefined") {
  patchThreeClock();
}
