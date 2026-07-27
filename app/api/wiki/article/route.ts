import { NextResponse } from "next/server";
import {
  finalizeArticleHtml,
  processWikiHtml,
  safeWikiPage,
  wikiParseApiUrl,
  WIKI_USER_AGENT,
  type WikiArticleView,
} from "@/lib/wikiArticle";

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
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim() || fallback;
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
    const response = await fetch(wikiParseApiUrl(pageTitle), {
      headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(18_000),
      // Wiki is the origin of truth; edge can cache the cleaned result.
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `RuneScape Wiki returned ${response.status}` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as ParsePayload;
    if (payload.error?.info) {
      return NextResponse.json(
        { error: payload.error.info },
        { status: 404 },
      );
    }

    const text = payload.parse?.text;
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Wiki response did not include article HTML" },
        { status: 502 },
      );
    }

    const title = displayTitle(
      payload.parse?.displaytitle ?? payload.parse?.title,
      pageTitle,
    );

    // Full WikiArticleView — every field from processWikiHtml/finalizeArticleHtml
    // (title, pageUrl, leadHtml, facts, dropsHtml, bodyHtml, hasDrops, and any
    // future additions). Do not pick a subset; JSON-serialize the view as-is.
    const view: WikiArticleView = finalizeArticleHtml(
      processWikiHtml(text, { title, pageUrl }),
    );

    return NextResponse.json(view, {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load wiki article";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
