import { NextResponse } from "next/server";
import {
  finalizeArticleHtml,
  mergeExpandedDrops,
  pickLootExpandTitles,
  processWikiHtml,
  safeWikiPage,
  wikiParseApiUrl,
  WIKI_USER_AGENT,
  type WikiArticleView,
  type WikiDropRow,
} from "@/lib/wikiArticle";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { log } from "@/lib/log";
import { clientIpFromHeaders, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** On-demand wiki parse after /data icon click only (not RSC/Browse/hover/prefetch). */

/** Cap url/page query params to bound parse cost and abuse. */
const MAX_QUERY_PARAM_LEN = 1024;
/** Cap upstream body before JSON parse (~3 MiB). */
const MAX_UPSTREAM_BYTES = 3 * 1024 * 1024;
/** 30 requests / minute per client IP. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

type ParsePayload = {
  parse?: {
    title?: string;
    displaytitle?: string;
    text?: string;
  };
  error?: { code?: string; info?: string };
};

function displayTitle(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  // Wiki often emits First Necromancer&#039;s equipment in displaytitle.
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, "")).trim() || fallback;
}

type FetchWikiResult =
  | { ok: true; payload: ParsePayload }
  | {
      ok: false;
      kind: "upstream_status" | "malformed_json" | "too_large" | "aborted" | "timeout" | "network";
      detail?: string;
    };

/** Cap upstream body size before JSON.parse. */
async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; kind: "too_large" }> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, kind: "too_large" };
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return { ok: false, kind: "too_large" };
    }
    return { ok: true, text };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore cancel errors */
      }
      return { ok: false, kind: "too_large" };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}

async function fetchWikiParse(pageTitle: string, signal: AbortSignal): Promise<FetchWikiResult> {
  try {
    const response = await fetch(wikiParseApiUrl(pageTitle), {
      headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
      signal,
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return { ok: false, kind: "upstream_status", detail: String(response.status) };
    }

    const body = await readBodyCapped(response, MAX_UPSTREAM_BYTES);
    if (!body.ok) {
      return { ok: false, kind: "too_large", detail: String(MAX_UPSTREAM_BYTES) };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body.text) as unknown;
    } catch {
      return { ok: false, kind: "malformed_json" };
    }
    if (!payload || typeof payload !== "object") {
      return { ok: false, kind: "malformed_json" };
    }
    return { ok: true, payload: payload as ParsePayload };
  } catch (error) {
    if (signal.aborted) {
      return { ok: false, kind: "timeout" };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, kind: "aborted" };
    }
    return {
      ok: false,
      kind: "network",
      detail: error instanceof Error ? error.message : "network",
    };
  }
}

function groupAlreadyHasMode(group: string, modeLabel: string): boolean {
  // Plain substring includes, not RegExp(modeLabel): wiki tails can hold metacharacters.
  return group.toLowerCase().includes(modeLabel.toLowerCase());
}

/**
 * Vorkath-style pages only list uniques + a "loot (normal)" shell row.
 * Follow the preferred loot subpage and merge its real drop table.
 */
async function expandLootContainers(
  view: WikiArticleView,
  signal: AbortSignal,
): Promise<WikiArticleView> {
  // Prefer normal-mode loot subpage; one hop is enough for Vorkath-style shells.
  const titles = pickLootExpandTitles(view.drops, 1);
  if (!titles.length) return view;

  const expanded: WikiDropRow[] = [];
  for (const title of titles) {
    try {
      // Encode path so `&` in titles (Zemouregal & Vorkath…) is not a query sep.
      const path = title
        .replace(/ /g, "_")
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");
      const safe = safeWikiPage(`https://runescape.wiki/w/${path}`);
      if (!safe) continue;
      const fetched = await fetchWikiParse(safe.pageTitle, signal);
      if (!fetched.ok) {
        log.warn("wiki.expand", "loot subpage fetch failed", {
          title: safe.pageTitle,
          kind: fetched.kind,
          detail: fetched.detail,
        });
        continue;
      }
      const html = fetched.payload.parse?.text;
      if (!html || typeof html !== "string") continue;
      let sub: WikiArticleView;
      try {
        sub = processWikiHtml(html, {
          title: safe.pageTitle,
          pageUrl: safe.pageUrl,
        });
      } catch (error) {
        log.warn("wiki.expand", "loot subpage sanitizer/parse failed", {
          title: safe.pageTitle,
          detail: error instanceof Error ? error.message : "unknown",
        });
        continue;
      }
      const modeLabel = /\(([^)]+)\)\s*$/.exec(title)?.[1]?.trim();
      for (const row of sub.drops) {
        expanded.push({
          ...row,
          group:
            row.group && modeLabel && !groupAlreadyHasMode(row.group, modeLabel)
              ? `${row.group} (${modeLabel})`
              : (row.group ?? (modeLabel ? `Loot (${modeLabel})` : null)),
        });
      }
    } catch (error) {
      // Bad subpage / parse must not drop the primary article response.
      log.warn("wiki.expand", "loot expansion hop failed", {
        title,
        detail: error instanceof Error ? error.message : "unknown",
      });
      continue;
    }
  }

  if (!expanded.length) return view;

  const drops = mergeExpandedDrops(view.drops, expanded);
  return finalizeArticleHtml({
    ...view,
    drops,
    hasDrops: drops.length > 0 || Boolean(view.dropsHtml.trim()),
  });
}

function tooLongParam(value: string | null): boolean {
  return typeof value === "string" && value.length > MAX_QUERY_PARAM_LEN;
}

export async function GET(request: Request) {
  // Rate limit before any wiki work.
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(ip, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          "X-RateLimit-Limit": String(limited.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");
  const pageParam = searchParams.get("page");

  if (tooLongParam(urlParam) || tooLongParam(pageParam)) {
    return NextResponse.json({ error: "Query parameter too long" }, { status: 400 });
  }

  let pageTitle: string;
  let pageUrl: string;

  if (urlParam) {
    const safe = safeWikiPage(urlParam);
    if (!safe) {
      return NextResponse.json({ error: "Invalid wiki URL" }, { status: 400 });
    }
    pageTitle = safe.pageTitle;
    pageUrl = safe.pageUrl;
  } else if (pageParam?.trim()) {
    const title = pageParam.trim();
    const safe = safeWikiPage(
      `https://runescape.wiki/w/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (!safe) {
      return NextResponse.json({ error: "Invalid wiki page" }, { status: 400 });
    }
    pageTitle = safe.pageTitle;
    pageUrl = safe.pageUrl;
  } else {
    return NextResponse.json({ error: "Missing url or page" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);

    try {
      const fetched = await fetchWikiParse(pageTitle, controller.signal);
      if (!fetched.ok) {
        log.warn("wiki.article", "upstream fetch failed", {
          pageTitle,
          kind: fetched.kind,
          detail: fetched.detail,
        });
        if (fetched.kind === "timeout" || fetched.kind === "aborted") {
          return NextResponse.json({ error: "RuneScape Wiki request timed out" }, { status: 504 });
        }
        if (fetched.kind === "too_large") {
          return NextResponse.json({ error: "Wiki response too large" }, { status: 502 });
        }
        if (fetched.kind === "upstream_status" && fetched.detail === "404") {
          return NextResponse.json({ error: "Wiki page not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "RuneScape Wiki request failed" }, { status: 502 });
      }
      const payload = fetched.payload;
      if (payload.error?.info) {
        return NextResponse.json({ error: "Wiki page not found" }, { status: 404 });
      }

      const text = payload.parse?.text;
      if (typeof text !== "string" || !text.trim()) {
        log.warn("wiki.article", "malformed wiki response — no HTML", {
          pageTitle,
        });
        return NextResponse.json(
          { error: "Wiki response did not include article HTML" },
          { status: 502 },
        );
      }

      const title = displayTitle(payload.parse?.displaytitle ?? payload.parse?.title, pageTitle);

      let view: WikiArticleView;
      try {
        view = finalizeArticleHtml(processWikiHtml(text, { title, pageUrl }));
      } catch (error) {
        log.error("wiki.article", "sanitizer or process failure", {
          pageTitle,
          detail: error instanceof Error ? error.message : "unknown",
        });
        return NextResponse.json({ error: "Unable to process wiki article" }, { status: 502 });
      }
      try {
        view = await expandLootContainers(view, controller.signal);
      } catch (error) {
        // Expansion is best-effort; base article still ships.
        log.warn("wiki.article", "optional loot expansion failed", {
          pageTitle,
          detail: error instanceof Error ? error.message : "unknown",
        });
      }

      return NextResponse.json(view, {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
          "X-RateLimit-Limit": String(limited.limit),
          "X-RateLimit-Remaining": String(limited.remaining),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    log.error("wiki.article", "unhandled wiki route error", {
      detail: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Unable to load wiki article" }, { status: 504 });
  }
}
