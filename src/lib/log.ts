/**
 * Dev-only structured logging. Silent in production builds so we never spam
 * user consoles or ship internal diagnostics.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = process.env.NODE_ENV !== "production";

function emit(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  if (!isDev) return;
  const prefix = `[eq:${scope}]`;
  const args = detail === undefined ? [prefix, message] : [prefix, message, detail];
  // eslint-disable-next-line no-console -- intentional dev-only diagnostic channel
  console[level === "debug" ? "log" : level](...args);
}

export const log = {
  debug: (scope: string, message: string, detail?: unknown) =>
    emit("debug", scope, message, detail),
  info: (scope: string, message: string, detail?: unknown) => emit("info", scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) => emit("warn", scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) =>
    emit("error", scope, message, detail),
};
