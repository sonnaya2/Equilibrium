# Bench: Catalyst tasks — live Wiki vs local snapshot

Generated: `2026-07-26T16:28:15.180Z` · host: `ANNA` · node: `v26.4.0`

## Summary table

| Arm | Payload | Records / keys | Fetch (min/med/max) | Parse (min/med/max) | End-to-end (min/med/max) | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| **Local snapshot** | 389.1 KB | 1117 tasks | n/a (disk) | parse 0.5 ms / 1 ms / 1 ms | 0.7 ms / 1.1 ms / 1.2 ms | read+JSON.parse · heap Δ med 751.6 KB |
| **Live Comp% only** | 15.7 KB | 1117 keys | 209.7 ms / 212.6 ms / 275.8 ms | 0.2 ms / 0.2 ms / 0.3 ms | 209.9 ms / 212.9 ms / 276 ms | production overlay · TTFB med 210.4 ms · 3/3 ok |
| **Live full task HTML** | 2.00 MB JSON · HTML 1.87 MB | 1117 tasks | 243.9 ms / 248 ms / 271.4 ms | JSON 1.4 ms + HTML 13.2 ms / 14.2 ms / 16.6 ms | 259.5 ms / 262.6 ms / 289.3 ms | MediaWiki parse API · 3/3 ok |

Network arms: **3 runs** each. Run 1 ≈ cold (DNS/TLS/cache); runs 2–3 ≈ warm.

## Local snapshot detail

- Path: `data/league/catalyst-tasks-snapshot.json`
- File size: **389.1 KB** (398,392 bytes)
- Record count: **1117**
- Total wall (read+parse) min/med/max: 0.7 ms / 1.1 ms / 1.2 ms
- JSON.parse only min/med/max: 0.5 ms / 1 ms / 1 ms
- Heap delta (approx) min/med/max: 402.7 KB / 751.6 KB / 764.5 KB

## Live completion.json detail (current production overlay)

- URL: `https://runescape.wiki/w/Module:Catalyst_League/Tasks/completion.json?action=raw`
- Successes: 3/3
- Body: **15.7 KB** · keys: **1117**
- TTFB min/med/max: 208.6 ms / 210.4 ms / 273.6 ms
- Fetch total min/med/max: 209.7 ms / 212.6 ms / 275.8 ms
- JSON parse min/med/max: 0.2 ms / 0.2 ms / 0.3 ms

Per-run:

| Run | Cold? | OK | TTFB | Fetch | Parse | Bytes | Keys | Error |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | yes | yes | 273.6 ms | 275.8 ms | 0.2 ms | 15.7 KB | 1117 |  |
| 2 | no | yes | 208.6 ms | 209.7 ms | 0.2 ms | 15.7 KB | 1117 |  |
| 3 | no | yes | 210.4 ms | 212.6 ms | 0.3 ms | 15.7 KB | 1117 |  |

## Live full task table detail

- URL: `https://runescape.wiki/api.php?action=parse&page=Catalyst_League%2FTasks&prop=text&format=json&formatversion=2&disableeditsection=1`
- Successes: 3/3
- Response JSON body: **2.00 MB**
- Extracted HTML text length: **1.87 MB** (1,956,669 chars)
- Parsed task records: **1117**
- Fetch total min/med/max: 243.9 ms / 248 ms / 271.4 ms
- JSON envelope parse med: 1.4 ms
- `parseCatalystTasksHtml` min/med/max: 13.2 ms / 14.2 ms / 16.6 ms
- End-to-end min/med/max: 259.5 ms / 262.6 ms / 289.3 ms

Per-run:

| Run | Cold? | OK | TTFB | Fetch | JSON parse | HTML parse | Records | Body | HTML chars | Error |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | yes | yes | 244.2 ms | 271.4 ms | 1.4 ms | 16.6 ms | 1117 | 2.00 MB | 1,956,669 |  |
| 2 | no | yes | 229.6 ms | 243.9 ms | 1.3 ms | 14.2 ms | 1117 | 2.00 MB | 1,956,669 |  |
| 3 | no | yes | 236 ms | 248 ms | 1.4 ms | 13.2 ms | 1117 | 2.00 MB | 1,956,669 |  |

## Recommendation

**Keep the static Catalyst snapshot + live completion.json overlay.** Do not scrape the full task HTML table on every request (or even every page view).

- Local snapshot is ~389.1 KB and loads in ~1.1 ms median wall — zero network, zero timeout risk on Vercel.
- Production Comp% overlay is ~15.7 KB and ~212.9 ms median end-to-end; safe with short timeout + revalidate (already used).
- Full live table is ~2.00 MB response / ~1.87 MB HTML chars, ~262.6 ms median e2e (~1.2× Comp% path), ~130× the Comp% payload.
- HTML table parse alone is ~14.2 ms median CPU — still cheap vs network, but the payload size and wiki latency dominate.
- At Vercel: cold-request cost scales with payload download + parse time. Full HTML historically 1–2 MB → bandwidth + timeout risk on slow wiki days; snapshot ships in the deployment artifact.
- Refresh full tasks offline via `scripts/refresh-catalyst-snapshot.mjs` when the wiki list changes; keep Comp% live for freshness without re-pulling 1k+ rows of static text.

## Variance / honesty notes

- Single-machine sample (not multi-region Vercel). Wiki latency varies with path, CDN, and wiki load.
- HTML parse is CPU-heavy regex over a multi-MB string; much heavier than `completion.json` parse.
- Full MediaWiki `action=parse` payload historically ~1–2 MB of HTML embedded in JSON — large for per-request serverless work.
- Vercel serverless default body/timeout budgets make full HTML scrape per request a timeout risk; snapshot + small Comp% overlay stays well under.
- Local numbers include OS page cache after run 1; pure cold disk would be slightly higher.
