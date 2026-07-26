/**
 * One-shot: measure local Catalyst snapshot I/O vs live RuneScape Wiki pulls.
 * Writes scraped-data/bench-tasks-wiki-live-vs-local.{json,md}
 *
 * Arms:
 *   1. Local snapshot read + JSON.parse
 *   2. Live completion.json only (production Comp% overlay)
 *   3. Live MediaWiki parse API (full task HTML) + parseCatalystTasksHtml
 *
 * Network arms run 3× each (run 1 = cold, 2–3 = warm). Exit 1 only if all live fetches fail.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SNAPSHOT_PATH = join(ROOT, "data/league/catalyst-tasks-snapshot.json");
const OUT_JSON = join(ROOT, "scraped-data/bench-tasks-wiki-live-vs-local.json");
const OUT_MD = join(ROOT, "scraped-data/bench-tasks-wiki-live-vs-local.md");

const UA = "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)";
const COMPLETION_URL =
  "https://runescape.wiki/w/Module:Catalyst_League/Tasks/completion.json?action=raw";
const TASKS_API =
  "https://runescape.wiki/api.php?action=parse&page=Catalyst_League%2FTasks&prop=text&format=json&formatversion=2&disableeditsection=1";

const NETWORK_REPEATS = 3;
const FETCH_TIMEOUT_MS = 120_000;

// ─── Parser (ported from scripts/refresh-catalyst-snapshot.mjs / src/tasks/catalyst.ts) ───

const POINT_TO_TIER = new Map([
  [10, "easy"],
  [30, "medium"],
  [80, "hard"],
  [200, "elite"],
  [400, "master"],
]);

const LOCALITY_TO_REGION = {
  global: "global",
  anachronia: "anachronia",
  karamja: "karamja",
  morytania: "morytania",
  desert: "desert",
  menaphos: "desert",
  fremennik: "fremennik",
  lunar: "fremennik",
  elves: "tirannwn",
  wilderness: "forinthry",
  daemonheim: "forinthry",
  falador: "asgarnia",
  burthorpe: "asgarnia",
  taverley: "asgarnia",
  portsarim: "asgarnia",
  ardougne: "kandarin",
  seer: "kandarin",
  yanille: "kandarin",
  gnomes: "kandarin",
  piscatoris: "kandarin",
  feldip: "kandarin",
  varrock: "misthalin",
  lumbridge: "misthalin",
  draynor: "misthalin",
  edgeville: "misthalin",
  um: "misthalin",
  fort: "misthalin",
};

const REGION_DISPLAY = {
  global: "Global",
  misthalin: "Misthalin",
  havenhythe: "Havenhythe",
  karamja: "Karamja",
  asgarnia: "Asgarnia",
  kandarin: "Kandarin",
  fremennik: "Fremennik",
  forinthry: "Forinthry",
  desert: "Desert",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  anachronia: "Anachronia",
};

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function attr(source, name) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match?.[1];
}

function localityLabelFromCell(localityHtml) {
  const title = localityHtml.match(/\btitle="([^"]+)"/i)?.[1];
  if (title?.trim()) return decodeHtmlEntities(title.trim());
  const alt = localityHtml.match(/\balt="([^"]+)"/i)?.[1];
  if (alt?.trim()) return decodeHtmlEntities(alt.trim());
  const text = textFromHtml(localityHtml);
  return text || undefined;
}

function parseCompletionRate(value) {
  const match = value.match(/(<)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return {};
  return {
    catalystCompletionRate: Number(match[2]),
    ...(match[1] === "<" ? { catalystCompletionRateQualifier: "<" } : {}),
  };
}

/** Same algorithm as src/tasks/catalyst.ts parseCatalystTasksHtml */
function parseCatalystTasksHtml(html) {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  const taskTable = tables.find((table) => {
    const text = textFromHtml(table);
    return text.includes("Locality") && text.includes("Task") && text.includes("Comp%");
  });
  if (!taskTable) return [];

  const rows = taskTable.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  return rows.flatMap((row) => {
    const rawCells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (rawCells.length < 6) return [];

    const wikiTaskIdRaw = attr(row, "data-taskid") ?? attr(row, "id");
    const wikiTaskId =
      wikiTaskIdRaw && /^\d+$/.test(wikiTaskIdRaw) ? Number(wikiTaskIdRaw) : undefined;
    const localityKey = attr(row, "data-tbz-area-for-filtering")?.toLowerCase();

    const [localityHtml, taskHtml, informationHtml, requirementsHtml, pointsHtml, completionHtml] =
      rawCells;
    const localityLabel = localityLabelFromCell(localityHtml);
    const name = textFromHtml(taskHtml);
    const information = textFromHtml(informationHtml);
    const requirements = textFromHtml(requirementsHtml);
    const pointsMatch = textFromHtml(pointsHtml).match(/\b(10|30|80|200|400)\b/);
    const points = pointsMatch ? Number(pointsMatch[1]) : null;
    const tier = points === null ? undefined : POINT_TO_TIER.get(points);
    const regionId = localityKey ? LOCALITY_TO_REGION[localityKey] : undefined;
    const region =
      regionId && regionId !== "global"
        ? REGION_DISPLAY[regionId]
        : regionId === "global"
          ? "Global"
          : localityLabel;

    if (!name || !tier || points === null) return [];

    return [
      {
        name,
        tier,
        points,
        ...(wikiTaskId !== undefined ? { id: `wiki:${wikiTaskId}`, wikiTaskId } : {}),
        ...(information && information !== name ? { description: information } : {}),
        ...(region ? { region } : {}),
        ...(regionId ? { regionId } : {}),
        ...(localityKey ? { localityKey } : {}),
        ...(localityLabel ? { localityLabel } : {}),
        ...(requirements && requirements !== "N/A" ? { requirements } : {}),
        ...parseCompletionRate(textFromHtml(completionHtml)),
        sourceLeague: "catalyst",
      },
    ];
  });
}

// ─── Stats helpers ───

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function minMaxMed(nums) {
  if (nums.length === 0) return { min: null, median: null, max: null };
  return {
    min: Math.min(...nums),
    median: median(nums),
    max: Math.max(...nums),
  };
}

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function heapUsed() {
  return process.memoryUsage().heapUsed;
}

function formatBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(n) {
  if (n == null) return "—";
  return `${round(n, 1)} ms`;
}

// ─── Arms ───

function benchLocalSnapshot() {
  const runs = [];
  // Warm FS cache with a discarded read so first measured run is not pure cold-disk
  // for the *reported* local arm — still report one cold-ish first pass.
  for (let i = 0; i < 3; i++) {
    if (global.gc) global.gc();
    const heapBefore = heapUsed();
    const t0 = performance.now();
    const buf = readFileSync(SNAPSHOT_PATH);
    const tRead = performance.now();
    const text = buf.toString("utf8");
    const data = JSON.parse(text);
    const tParse = performance.now();
    const heapAfter = heapUsed();
    const records = data.records ?? [];
    runs.push({
      run: i + 1,
      cold: i === 0,
      fileBytes: buf.length,
      readMs: tRead - t0,
      parseMs: tParse - tRead,
      totalMs: tParse - t0,
      recordCount: records.length,
      heapDeltaBytes: heapAfter - heapBefore,
    });
  }

  const fileBytes = runs[0].fileBytes;
  const totals = runs.map((r) => r.totalMs);
  const parses = runs.map((r) => r.parseMs);
  return {
    path: "data/league/catalyst-tasks-snapshot.json",
    fileBytes,
    fileBytesHuman: formatBytes(fileBytes),
    recordCount: runs[0].recordCount,
    runs,
    summary: {
      totalMs: minMaxMed(totals),
      parseMs: minMaxMed(parses),
      heapDeltaBytes: {
        min: Math.min(...runs.map((r) => r.heapDeltaBytes)),
        max: Math.max(...runs.map((r) => r.heapDeltaBytes)),
        median: median(runs.map((r) => r.heapDeltaBytes)),
      },
    },
  };
}

async function fetchWithTiming(url, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const t0 = performance.now();
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const tHeaders = performance.now();
  const buf = Buffer.from(await response.arrayBuffer());
  const tBody = performance.now();
  return {
    ok: response.ok,
    status: response.status,
    ttfbMs: tHeaders - t0,
    bodyMs: tBody - tHeaders,
    totalFetchMs: tBody - t0,
    bodyBytes: buf.length,
    text: buf.toString("utf8"),
  };
}

async function benchCompletion() {
  const runs = [];
  let liveOk = 0;

  for (let i = 0; i < NETWORK_REPEATS; i++) {
    const cold = i === 0;
    try {
      const fetched = await fetchWithTiming(COMPLETION_URL, { timeoutMs: 15_000 });
      if (!fetched.ok) {
        runs.push({
          run: i + 1,
          cold,
          ok: false,
          error: `HTTP ${fetched.status}`,
          ttfbMs: fetched.ttfbMs,
          totalFetchMs: fetched.totalFetchMs,
          bodyBytes: fetched.bodyBytes,
        });
        continue;
      }
      const t0 = performance.now();
      const payload = JSON.parse(fetched.text);
      const parseMs = performance.now() - t0;
      const keyCount = Object.keys(payload).length;
      liveOk++;
      runs.push({
        run: i + 1,
        cold,
        ok: true,
        ttfbMs: fetched.ttfbMs,
        totalFetchMs: fetched.totalFetchMs,
        bodyBytes: fetched.bodyBytes,
        parseMs,
        keyCount,
        endToEndMs: fetched.totalFetchMs + parseMs,
      });
    } catch (err) {
      runs.push({
        run: i + 1,
        cold,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const okRuns = runs.filter((r) => r.ok);
  return {
    url: COMPLETION_URL,
    liveOkCount: liveOk,
    runs,
    summary: {
      ttfbMs: minMaxMed(okRuns.map((r) => r.ttfbMs)),
      totalFetchMs: minMaxMed(okRuns.map((r) => r.totalFetchMs)),
      parseMs: minMaxMed(okRuns.map((r) => r.parseMs)),
      endToEndMs: minMaxMed(okRuns.map((r) => r.endToEndMs)),
      bodyBytes: okRuns[0]?.bodyBytes ?? null,
      keyCount: okRuns[0]?.keyCount ?? null,
    },
  };
}

async function benchFullTasks() {
  const runs = [];
  let liveOk = 0;

  for (let i = 0; i < NETWORK_REPEATS; i++) {
    const cold = i === 0;
    try {
      const fetched = await fetchWithTiming(TASKS_API);
      if (!fetched.ok) {
        runs.push({
          run: i + 1,
          cold,
          ok: false,
          error: `HTTP ${fetched.status}`,
          ttfbMs: fetched.ttfbMs,
          totalFetchMs: fetched.totalFetchMs,
          bodyBytes: fetched.bodyBytes,
        });
        continue;
      }

      const tJson0 = performance.now();
      const payload = JSON.parse(fetched.text);
      const jsonParseMs = performance.now() - tJson0;

      const html = payload?.parse?.text;
      if (typeof html !== "string" || !html) {
        runs.push({
          run: i + 1,
          cold,
          ok: false,
          error: "parse.text missing from MediaWiki response",
          ttfbMs: fetched.ttfbMs,
          totalFetchMs: fetched.totalFetchMs,
          bodyBytes: fetched.bodyBytes,
          jsonParseMs,
        });
        continue;
      }

      const htmlChars = html.length;
      const tHtml0 = performance.now();
      const records = parseCatalystTasksHtml(html);
      const htmlParseMs = performance.now() - tHtml0;

      liveOk++;
      runs.push({
        run: i + 1,
        cold,
        ok: true,
        ttfbMs: fetched.ttfbMs,
        totalFetchMs: fetched.totalFetchMs,
        bodyBytes: fetched.bodyBytes,
        jsonParseMs,
        htmlChars,
        htmlParseMs,
        recordCount: records.length,
        endToEndMs: fetched.totalFetchMs + jsonParseMs + htmlParseMs,
      });
    } catch (err) {
      runs.push({
        run: i + 1,
        cold,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const okRuns = runs.filter((r) => r.ok);
  return {
    url: TASKS_API,
    liveOkCount: liveOk,
    runs,
    summary: {
      ttfbMs: minMaxMed(okRuns.map((r) => r.ttfbMs)),
      totalFetchMs: minMaxMed(okRuns.map((r) => r.totalFetchMs)),
      jsonParseMs: minMaxMed(okRuns.map((r) => r.jsonParseMs)),
      htmlParseMs: minMaxMed(okRuns.map((r) => r.htmlParseMs)),
      endToEndMs: minMaxMed(okRuns.map((r) => r.endToEndMs)),
      bodyBytes: okRuns[0]?.bodyBytes ?? null,
      htmlChars: okRuns[0]?.htmlChars ?? null,
      recordCount: okRuns[0]?.recordCount ?? null,
    },
  };
}

// ─── Report ───

function buildMarkdown(report) {
  const { local, completion, fullTasks, recommendation, meta } = report;
  const loc = local.summary;
  const comp = completion.summary;
  const full = fullTasks.summary;

  const lines = [
    `# Bench: Catalyst tasks — live Wiki vs local snapshot`,
    ``,
    `Generated: \`${meta.generatedAt}\` · host: \`${meta.host}\` · node: \`${meta.node}\``,
    ``,
    `## Summary table`,
    ``,
    `| Arm | Payload | Records / keys | Fetch (min/med/max) | Parse (min/med/max) | End-to-end (min/med/max) | Notes |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | --- |`,
    `| **Local snapshot** | ${formatBytes(local.fileBytes)} | ${local.recordCount} tasks | n/a (disk) | parse ${formatMs(loc.parseMs.min)} / ${formatMs(loc.parseMs.median)} / ${formatMs(loc.parseMs.max)} | ${formatMs(loc.totalMs.min)} / ${formatMs(loc.totalMs.median)} / ${formatMs(loc.totalMs.max)} | read+JSON.parse · heap Δ med ${formatBytes(loc.heapDeltaBytes.median)} |`,
    `| **Live Comp% only** | ${formatBytes(comp.bodyBytes)} | ${comp.keyCount ?? "—"} keys | ${formatMs(comp.totalFetchMs.min)} / ${formatMs(comp.totalFetchMs.median)} / ${formatMs(comp.totalFetchMs.max)} | ${formatMs(comp.parseMs.min)} / ${formatMs(comp.parseMs.median)} / ${formatMs(comp.parseMs.max)} | ${formatMs(comp.endToEndMs.min)} / ${formatMs(comp.endToEndMs.median)} / ${formatMs(comp.endToEndMs.max)} | production overlay · TTFB med ${formatMs(comp.ttfbMs.median)} · ${completion.liveOkCount}/${NETWORK_REPEATS} ok |`,
    `| **Live full task HTML** | ${formatBytes(full.bodyBytes)} JSON · HTML ${formatBytes(full.htmlChars)} | ${full.recordCount ?? "—"} tasks | ${formatMs(full.totalFetchMs.min)} / ${formatMs(full.totalFetchMs.median)} / ${formatMs(full.totalFetchMs.max)} | JSON ${formatMs(full.jsonParseMs.median)} + HTML ${formatMs(full.htmlParseMs.min)} / ${formatMs(full.htmlParseMs.median)} / ${formatMs(full.htmlParseMs.max)} | ${formatMs(full.endToEndMs.min)} / ${formatMs(full.endToEndMs.median)} / ${formatMs(full.endToEndMs.max)} | MediaWiki parse API · ${fullTasks.liveOkCount}/${NETWORK_REPEATS} ok |`,
    ``,
    `Network arms: **${NETWORK_REPEATS} runs** each. Run 1 ≈ cold (DNS/TLS/cache); runs 2–3 ≈ warm.`,
    ``,
    `## Local snapshot detail`,
    ``,
    `- Path: \`${local.path}\``,
    `- File size: **${formatBytes(local.fileBytes)}** (${local.fileBytes.toLocaleString()} bytes)`,
    `- Record count: **${local.recordCount}**`,
    `- Total wall (read+parse) min/med/max: ${formatMs(loc.totalMs.min)} / ${formatMs(loc.totalMs.median)} / ${formatMs(loc.totalMs.max)}`,
    `- JSON.parse only min/med/max: ${formatMs(loc.parseMs.min)} / ${formatMs(loc.parseMs.median)} / ${formatMs(loc.parseMs.max)}`,
    `- Heap delta (approx) min/med/max: ${formatBytes(loc.heapDeltaBytes.min)} / ${formatBytes(loc.heapDeltaBytes.median)} / ${formatBytes(loc.heapDeltaBytes.max)}`,
    ``,
    `## Live completion.json detail (current production overlay)`,
    ``,
    `- URL: \`${completion.url}\``,
    `- Successes: ${completion.liveOkCount}/${NETWORK_REPEATS}`,
    `- Body: **${formatBytes(comp.bodyBytes)}** · keys: **${comp.keyCount ?? "—"}**`,
    `- TTFB min/med/max: ${formatMs(comp.ttfbMs.min)} / ${formatMs(comp.ttfbMs.median)} / ${formatMs(comp.ttfbMs.max)}`,
    `- Fetch total min/med/max: ${formatMs(comp.totalFetchMs.min)} / ${formatMs(comp.totalFetchMs.median)} / ${formatMs(comp.totalFetchMs.max)}`,
    `- JSON parse min/med/max: ${formatMs(comp.parseMs.min)} / ${formatMs(comp.parseMs.median)} / ${formatMs(comp.parseMs.max)}`,
    ``,
    `Per-run:`,
    ``,
    `| Run | Cold? | OK | TTFB | Fetch | Parse | Bytes | Keys | Error |`,
    `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...completion.runs.map(
      (r) =>
        `| ${r.run} | ${r.cold ? "yes" : "no"} | ${r.ok ? "yes" : "no"} | ${formatMs(r.ttfbMs)} | ${formatMs(r.totalFetchMs)} | ${formatMs(r.parseMs)} | ${formatBytes(r.bodyBytes)} | ${r.keyCount ?? "—"} | ${r.error ?? ""} |`,
    ),
    ``,
    `## Live full task table detail`,
    ``,
    `- URL: \`${fullTasks.url}\``,
    `- Successes: ${fullTasks.liveOkCount}/${NETWORK_REPEATS}`,
    `- Response JSON body: **${formatBytes(full.bodyBytes)}**`,
    `- Extracted HTML text length: **${formatBytes(full.htmlChars)}** (${(full.htmlChars ?? 0).toLocaleString()} chars)`,
    `- Parsed task records: **${full.recordCount ?? "—"}**`,
    `- Fetch total min/med/max: ${formatMs(full.totalFetchMs.min)} / ${formatMs(full.totalFetchMs.median)} / ${formatMs(full.totalFetchMs.max)}`,
    `- JSON envelope parse med: ${formatMs(full.jsonParseMs.median)}`,
    `- \`parseCatalystTasksHtml\` min/med/max: ${formatMs(full.htmlParseMs.min)} / ${formatMs(full.htmlParseMs.median)} / ${formatMs(full.htmlParseMs.max)}`,
    `- End-to-end min/med/max: ${formatMs(full.endToEndMs.min)} / ${formatMs(full.endToEndMs.median)} / ${formatMs(full.endToEndMs.max)}`,
    ``,
    `Per-run:`,
    ``,
    `| Run | Cold? | OK | TTFB | Fetch | JSON parse | HTML parse | Records | Body | HTML chars | Error |`,
    `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...fullTasks.runs.map(
      (r) =>
        `| ${r.run} | ${r.cold ? "yes" : "no"} | ${r.ok ? "yes" : "no"} | ${formatMs(r.ttfbMs)} | ${formatMs(r.totalFetchMs)} | ${formatMs(r.jsonParseMs)} | ${formatMs(r.htmlParseMs)} | ${r.recordCount ?? "—"} | ${formatBytes(r.bodyBytes)} | ${r.htmlChars?.toLocaleString() ?? "—"} | ${r.error ?? ""} |`,
    ),
    ``,
    `## Recommendation`,
    ``,
    recommendation.verdict,
    ``,
    ...recommendation.bullets.map((b) => `- ${b}`),
    ``,
    `## Variance / honesty notes`,
    ``,
    `- Single-machine sample (not multi-region Vercel). Wiki latency varies with path, CDN, and wiki load.`,
    `- HTML parse is CPU-heavy regex over a multi-MB string; much heavier than \`completion.json\` parse.`,
    `- Full MediaWiki \`action=parse\` payload historically ~1–2 MB of HTML embedded in JSON — large for per-request serverless work.`,
    `- Vercel serverless default body/timeout budgets make full HTML scrape per request a timeout risk; snapshot + small Comp% overlay stays well under.`,
    `- Local numbers include OS page cache after run 1; pure cold disk would be slightly higher.`,
    ``,
  ];
  return lines.join("\n");
}

function buildRecommendation(local, completion, fullTasks) {
  const fullBody = fullTasks.summary.bodyBytes ?? 0;
  const fullHtml = fullTasks.summary.htmlChars ?? 0;
  const compBody = completion.summary.bodyBytes ?? 0;
  const localBytes = local.fileBytes;
  const fullE2E = fullTasks.summary.endToEndMs.median;
  const compE2E = completion.summary.endToEndMs.median;
  const localE2E = local.summary.totalMs.median;
  const fullParse = fullTasks.summary.htmlParseMs.median;

  const ratioPayload =
    fullBody > 0 && compBody > 0 ? round(fullBody / Math.max(compBody, 1), 1) : null;
  const ratioE2E =
    fullE2E != null && compE2E != null && compE2E > 0 ? round(fullE2E / compE2E, 1) : null;

  return {
    verdict:
      "**Keep the static Catalyst snapshot + live completion.json overlay.** Do not scrape the full task HTML table on every request (or even every page view).",
    bullets: [
      `Local snapshot is ~${formatBytes(localBytes)} and loads in ~${formatMs(localE2E)} median wall — zero network, zero timeout risk on Vercel.`,
      `Production Comp% overlay is ~${formatBytes(compBody)} and ~${formatMs(compE2E)} median end-to-end; safe with short timeout + revalidate (already used).`,
      `Full live table is ~${formatBytes(fullBody)} response / ~${formatBytes(fullHtml)} HTML chars, ~${formatMs(fullE2E)} median e2e${ratioE2E != null ? ` (~${ratioE2E}× Comp% path)` : ""}${ratioPayload != null ? `, ~${ratioPayload}× the Comp% payload` : ""}.`,
      `HTML table parse alone is ~${formatMs(fullParse)} median CPU — still cheap vs network, but the payload size and wiki latency dominate.`,
      `At Vercel: cold-request cost scales with payload download + parse time. Full HTML historically 1–2 MB → bandwidth + timeout risk on slow wiki days; snapshot ships in the deployment artifact.`,
      `Refresh full tasks offline via \`scripts/refresh-catalyst-snapshot.mjs\` when the wiki list changes; keep Comp% live for freshness without re-pulling 1k+ rows of static text.`,
    ],
  };
}

// ─── Main ───

async function main() {
  console.log("[bench-tasks-wiki] Local snapshot…");
  const local = benchLocalSnapshot();
  console.log(
    `  ${local.fileBytes} bytes, ${local.recordCount} records, total med ${round(local.summary.totalMs.median)} ms`,
  );

  console.log("[bench-tasks-wiki] Live completion.json ×3…");
  const completion = await benchCompletion();
  console.log(
    `  ok ${completion.liveOkCount}/${NETWORK_REPEATS}, body ${completion.summary.bodyBytes ?? "?"} B, e2e med ${round(completion.summary.endToEndMs.median)} ms`,
  );

  console.log("[bench-tasks-wiki] Live full task parse API ×3…");
  const fullTasks = await benchFullTasks();
  console.log(
    `  ok ${fullTasks.liveOkCount}/${NETWORK_REPEATS}, body ${fullTasks.summary.bodyBytes ?? "?"} B, html ${fullTasks.summary.htmlChars ?? "?"} chars, records ${fullTasks.summary.recordCount ?? "?"}, e2e med ${round(fullTasks.summary.endToEndMs.median)} ms`,
  );

  const recommendation = buildRecommendation(local, completion, fullTasks);
  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      host: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "unknown",
      node: process.version,
      platform: process.platform,
      networkRepeats: NETWORK_REPEATS,
      userAgent: UA,
      note: "Run 1 of each network arm treated as cold; runs 2–3 as warm. Single-host sample — not multi-region Vercel latency.",
    },
    local,
    completion,
    fullTasks,
    recommendation,
  };

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(OUT_MD, buildMarkdown(report), "utf8");
  console.log(`[bench-tasks-wiki] Wrote ${OUT_JSON}`);
  console.log(`[bench-tasks-wiki] Wrote ${OUT_MD}`);

  const anyLive = completion.liveOkCount > 0 || fullTasks.liveOkCount > 0;
  if (!anyLive) {
    console.error("[bench-tasks-wiki] All live fetches failed");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
