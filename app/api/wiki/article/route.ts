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

export const runtime = "nodejs";

/**
 * On-demand after icon click only.
 * Client hits this after an icon click on /data — never RSC, Browse, hover, or prefetch.
 */

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
      kind: "upstream_status" | "malformed_json" | "aborted" | "timeout" | "network";
      detail?: string;
    };

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
    let payload: unknown;
    try {
      payload = await response.json();
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

/**
 * Vorkath-style pages only list uniques + a "loot (normal)" shell row.
 * Follow the preferred loot subpage and merge its real drop table.
 */
function groupAlreadyHasMode(group: string, modeLabel: string): boolean {
  // Plain substring — never RegExp(modeLabel); wiki tails can hold metacharacters.
  return group.toLowerCase().includes(modeLabel.toLowerCase());
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");
  const pageParam = searchParams.get("page");

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
