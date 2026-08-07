---
name: playwright-e2e
description: Run and diagnose this repository's local Playwright browser tests with a verified Equilibrium dev server, automatic free-port selection, early Next lock detection, and owned-process cleanup. Use for E2E tests, browser assertions, Playwright failures, port 3100 conflicts, hung test teardown, leaked dev servers, or headed WebGPU test setup.
---

# Playwright E2E

This skill owns **how to run** local Playwright. For writing, editing, deleting, or triaging E2E
cases, also read and follow `test-maintainer` first — mandatory for all suite work.

Use the managed runner for ordinary headless E2E work:

```powershell
pwsh -NoProfile -File .agents/skills/playwright-e2e/scripts/run-e2e.ps1
```

The runner and `playwright.config.ts` default to one worker. The map suite is GPU- and
compile-heavy; serial execution avoids starving or crashing a reused Next dev server. Allow at
least ten minutes for a whole-suite run.

Pass a specific port, worker count, or one or more test files when needed:

```powershell
pwsh -NoProfile -File .agents/skills/playwright-e2e/scripts/run-e2e.ps1 -Port 3104 -Test e2e/combat.spec.ts
pwsh -NoProfile -File .agents/skills/playwright-e2e/scripts/run-e2e.ps1 -Workers 4
```

The runner reuses a responding Equilibrium server or starts one on 3100, then 3102 through 3110. It sets `PLAYWRIGHT_PORT`, waits for `/combat`, runs the local Playwright binary, and force-stops only the server process tree it started. It leaves reused servers alone.

If `.next/dev/lock` exists and no candidate port serves Equilibrium, stop and inspect the existing dev server. Never delete the lock or kill every Node process.

Keep port 3101 for the headed WebGPU pass:

```powershell
npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts
```

Do not force-kill Playwright after a successful exit; no Playwright process remains. The managed runner fixes the observed teardown hang by owning the Next server outside Playwright and terminating that server in `finally`.

Treat the six default headless WebGPU skips as expected. Any other skip or failure needs investigation before push.
