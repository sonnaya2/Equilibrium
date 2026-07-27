"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WikiArticleView, WikiFact } from "@/lib/wikiArticle";
import { safeWikiPage } from "@/lib/wikiArticle";
import {
  collectArticleAssets,
  resolveLocalAsset,
  resolveLocalAssets,
} from "@/lib/wikiLocalAssets";
import { WikiDropTable, type WikiDropTableRow } from "@/components/WikiDropTable";
import {
  WikiAssetRail,
  WikiFactStrip,
  type WikiFactChip,
} from "@/components/WikiArticleChrome";

export type WikiArticleTarget = {
  /** Local public/game art — never a wiki image URL. */
  localArtSrc: string | null;
  name: string;
  /** Existing catalog source URL; wrapper opens only when this is a wiki page. */
  wikiUrl?: string | null;
  /** Extra local asset labels (reward names, etc.) already in memory — not wiki-fetched. */
  relatedLabels?: string[];
  /** Pre-resolved local icons from catalog rewards — used for drop table rows. */
  relatedIcons?: { label: string; src: string }[];
};

/** Optional structured drops (server may start emitting these). */
export type WikiDropRow = WikiDropTableRow;

/** Client view: base contract + optional structured drops from future API. */
type WikiArticleClientView = WikiArticleView & {
  drops?: WikiDropRow[];
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; view: WikiArticleClientView }
  | { status: "error"; message: string; pageUrl: string | null };

function isWikiView(data: unknown): data is WikiArticleClientView {
  if (!data || typeof data !== "object") return false;
  const v = data as Record<string, unknown>;
  if (
    typeof v.title !== "string" ||
    typeof v.pageUrl !== "string" ||
    typeof v.leadHtml !== "string" ||
    typeof v.dropsHtml !== "string" ||
    typeof v.bodyHtml !== "string" ||
    typeof v.hasDrops !== "boolean" ||
    !Array.isArray(v.facts)
  ) {
    return false;
  }
  // Optional structured drops — tolerate missing; reject wrong shape.
  if (v.drops != null && !Array.isArray(v.drops)) return false;
  return true;
}

function applyPixelScale(
  img: HTMLImageElement,
  setPixelated: (v: boolean) => void,
  maxCanvas: number,
) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const maxEdge = Math.max(nw, nh);
  const isGlyph = maxEdge > 0 && maxEdge <= 96;
  setPixelated(isGlyph);
  if (isGlyph) {
    const scale = Math.min(
      maxCanvas >= 400 ? 8 : 6,
      Math.max(maxCanvas >= 400 ? 4 : 3, Math.floor(maxCanvas / maxEdge)),
    );
    img.style.width = `${nw * scale}px`;
    img.style.height = `${nh * scale}px`;
  } else {
    img.style.width = "";
    img.style.height = "";
  }
}

function factsToChips(facts: WikiFact[]): WikiFactChip[] {
  return facts.map((f) => {
    const icon =
      resolveLocalAsset(f.value) ??
      resolveLocalAsset(f.label) ??
      null;
    return { label: f.label, value: f.value, iconSrc: icon?.src ?? null };
  });
}

/**
 * Optional LOCAL /game overrides for drop rows.
 * Live wiki icons live on each row.iconUrl (harvested server-side) — not here.
 */
function dropIconMap(
  drops: WikiDropRow[],
  relatedIcons?: { label: string; src: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const byNorm = new Map<string, string>();
  for (const icon of relatedIcons ?? []) {
    if (!icon.src?.startsWith("/game/")) continue;
    const key = icon.label.replace(/\s+/g, " ").trim().toLowerCase();
    if (key) byNorm.set(key, icon.src);
  }

  const lookupRelated = (item: string): string | null => {
    const norm = item.replace(/\s+/g, " ").trim().toLowerCase();
    if (byNorm.has(norm)) return byNorm.get(norm) ?? null;
    for (const [key, src] of byNorm) {
      if (key.length < 4 || norm.length < 4) continue;
      if (norm.includes(key) || key.includes(norm)) return src;
    }
    return null;
  };

  for (const row of drops) {
    if (out[row.item]) continue;
    const fromCatalog = lookupRelated(row.item);
    if (fromCatalog) {
      out[row.item] = fromCatalog;
      continue;
    }
    const hit = resolveLocalAsset(row.item);
    if (hit) out[row.item] = hit.src;
  }
  return out;
}

export function WikiArticleDialog({
  target,
  onClose,
}: {
  target: WikiArticleTarget | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pixelated, setPixelated] = useState(false);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  // Resolved only from the click-set target — never from row mount / hover.
  const wiki = target?.wikiUrl ? safeWikiPage(target.wikiUrl) : null;
  const imageOnly = Boolean(target && !wiki);
  const fetchPageUrl = target && wiki ? wiki.pageUrl : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) dialog.showModal();
    if (!target && dialog?.open) dialog.close();
    setPixelated(false);
  }, [target]);

  // Live wiki only after an icon click sets `target` with a wiki URL.
  // No prefetch, no mount fetch, no hover — `fetchPageUrl` is null until then.
  useEffect(() => {
    if (!fetchPageUrl) {
      setLoad({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setLoad({ status: "loading" });

    const qs = new URLSearchParams({ url: fetchPageUrl });
    fetch(`/api/wiki/article?${qs.toString()}`, {
      signal: controller.signal,
      // Do not use Next router prefetch; this is an explicit user action only.
      cache: "no-store",
    })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            data &&
            typeof data === "object" &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Could not load article (${res.status})`;
          setLoad({ status: "error", message, pageUrl: fetchPageUrl });
          return;
        }
        if (!isWikiView(data)) {
          setLoad({
            status: "error",
            message: "Unexpected wiki response",
            pageUrl: fetchPageUrl,
          });
          return;
        }
        setLoad({ status: "ready", view: data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({
          status: "error",
          message:
            error instanceof Error ? error.message : "Could not load article",
          pageUrl: fetchPageUrl,
        });
      });

    return () => controller.abort();
  }, [fetchPageUrl]);

  const title =
    load.status === "ready" ? load.view.title : (target?.name ?? "Article");

  return (
    <dialog
      ref={dialogRef}
      className={
        imageOnly || !target
          ? "data-image-viewer"
          : "data-image-viewer data-wiki-article"
      }
      aria-label={target ? `${title} article` : "Article"}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {target ? (
        <>
          <button
            type="button"
            className="data-image-viewer__close"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>

          {imageOnly ? (
            <ImageOnlyBody
              src={target.localArtSrc}
              name={target.name}
              relatedLabels={target.relatedLabels}
              pixelated={pixelated}
              setPixelated={setPixelated}
            />
          ) : (
            <WikiBody
              name={target.name}
              localArtSrc={target.localArtSrc}
              relatedLabels={target.relatedLabels}
              relatedIcons={target.relatedIcons}
              pageUrl={wiki?.pageUrl ?? null}
              load={load}
              pixelated={pixelated}
              setPixelated={setPixelated}
            />
          )}
        </>
      ) : null}
    </dialog>
  );
}

function ImageOnlyBody({
  src,
  name,
  relatedLabels,
  pixelated,
  setPixelated,
}: {
  src: string | null;
  name: string;
  relatedLabels?: string[];
  pixelated: boolean;
  setPixelated: (v: boolean) => void;
}) {
  const railAssets = useMemo(
    () =>
      resolveLocalAssets(relatedLabels ?? [])
        .filter((a) => a.src !== src)
        .map((a) => ({ src: a.src, label: a.label })),
    [relatedLabels, src],
  );

  return (
    <div className="data-wiki-article__image-only">
      <div className="data-wiki-article__image-only-well">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className={pixelated ? "is-pixel" : undefined}
            onLoad={(event) =>
              applyPixelScale(event.currentTarget, setPixelated, 480)
            }
          />
        ) : (
          <span className="data-wiki-article__art-empty" aria-hidden />
        )}
      </div>
      <p className="data-wiki-article__image-only-name">{name}</p>
      {railAssets.length > 0 ? (
        <WikiAssetRail
          assets={railAssets}
          primary={{ src, label: name }}
        />
      ) : null}
    </div>
  );
}

function WikiBody({
  name,
  localArtSrc,
  relatedLabels,
  relatedIcons,
  pageUrl,
  load,
  pixelated,
  setPixelated,
}: {
  name: string;
  localArtSrc: string | null;
  relatedLabels?: string[];
  relatedIcons?: { label: string; src: string }[];
  pageUrl: string | null;
  load: LoadState;
  pixelated: boolean;
  setPixelated: (v: boolean) => void;
}) {
  const view = load.status === "ready" ? load.view : null;
  const heading = view?.title || name;
  const drops = view?.drops ?? [];
  const hasStructuredDrops = drops.length > 0;
  const hasHtmlDrops = Boolean(view?.hasDrops && view.dropsHtml.trim());
  const showDrops = hasStructuredDrops || hasHtmlDrops;

  // Client-side only after article loads — catalog icons first, then resolve.
  const iconByItem = useMemo(() => {
    if (!view) return {};
    return dropIconMap(view.drops ?? [], relatedIcons);
  }, [view, relatedIcons]);

  // relatedLabels + catalog icons: click-time. Wiki drops join once ready.
  const railAssets = useMemo(() => {
    const related = relatedLabels ?? [];
    const fromIcons = (relatedIcons ?? [])
      .filter((i) => i.src.startsWith("/game/") && i.src !== localArtSrc)
      .map((i) => ({ src: i.src, label: i.label }));

    if (!view) {
      const resolved = resolveLocalAssets(related)
        .filter((a) => a.src !== localArtSrc)
        .map((a) => ({ src: a.src, label: a.label }));
      const seen = new Set(fromIcons.map((a) => a.src));
      const merged = [...fromIcons];
      for (const a of resolved) {
        if (seen.has(a.src)) continue;
        seen.add(a.src);
        merged.push(a);
      }
      return merged;
    }
    const dropItems = (view.drops ?? []).map((d) => d.item);
    const collected = collectArticleAssets({
      title: view.title || name,
      dropItems,
      factValues: view.facts.map((f) => f.value),
      primaryArtSrc: localArtSrc,
      extraLabels: [...related, name],
    }).map((a) => ({ src: a.src, label: a.label }));
    const seen = new Set<string>();
    const merged: { src: string; label: string }[] = [];
    for (const a of [...fromIcons, ...collected]) {
      if (seen.has(a.src)) continue;
      seen.add(a.src);
      merged.push(a);
    }
    return merged;
  }, [view, localArtSrc, name, relatedLabels, relatedIcons]);

  const factChips = useMemo(
    () => (view?.facts.length ? factsToChips(view.facts) : []),
    [view],
  );

  const bodyHtml = view?.bodyHtml?.trim() ?? "";
  const leadHtml = view?.leadHtml?.trim() ?? "";

  return (
    <div className="data-wiki-article__shell">
      <header className="data-wiki-article__header">
        <h2 className="data-wiki-article__title">{heading}</h2>
      </header>

      {/* 1. Large primary local art — top of shell, left-aligned */}
      <div className="data-wiki-article__stage">
        <div className="data-wiki-article__art-primary">
          {localArtSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localArtSrc}
              alt=""
              className={pixelated ? "is-pixel" : undefined}
              onLoad={(event) =>
                applyPixelScale(event.currentTarget, setPixelated, 400)
              }
            />
          ) : (
            <span className="data-wiki-article__art-empty" aria-hidden />
          )}
          {name && name !== heading ? (
            <p className="data-wiki-article__art-name">{name}</p>
          ) : null}
        </div>
      </div>

      {load.status === "loading" ? (
        <p className="data-wiki-article__status" aria-busy="true">
          Loading
        </p>
      ) : null}
      {load.status === "error" ? (
        <p className="data-wiki-article__status" role="alert">
          {load.message}
        </p>
      ) : null}

      {/* 2. Short wiki top description, then compact facts */}
      {leadHtml || factChips.length > 0 ? (
        <section className="data-wiki-article__lead" aria-label="Summary">
          {leadHtml ? (
            <div
              className="data-wiki-article__content"
              dangerouslySetInnerHTML={{ __html: leadHtml }}
            />
          ) : null}
          {factChips.length > 0 ? <WikiFactStrip facts={factChips} /> : null}
        </section>
      ) : null}

      {/* 3. Drop tables — structured first, HTML fallback */}
      {showDrops ? (
        <section className="data-wiki-article__drops" aria-label="Drops">
          {hasStructuredDrops ? (
            <WikiDropTable rows={drops} iconByItem={iconByItem} />
          ) : null}
          {!hasStructuredDrops && hasHtmlDrops ? (
            <div
              className="data-wiki-article__content"
              dangerouslySetInnerHTML={{ __html: view!.dropsHtml }}
            />
          ) : null}
        </section>
      ) : null}

      {/* 4. Asset rail of local icons (related / drop items) */}
      {railAssets.length > 0 ? (
        <WikiAssetRail
          assets={railAssets}
          primary={{ src: localArtSrc, label: name }}
        />
      ) : null}

      {/* 5. Residual body last only — de-emphasized More when non-empty after strip */}
      {bodyHtml ? (
        <details className="data-wiki-article__body">
          <summary className="data-wiki-article__body-summary">More</summary>
          <div
            className="data-wiki-article__content"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </details>
      ) : null}

      {/* 6. Footer */}
      <footer className="data-wiki-article__footer">
        {pageUrl || view?.pageUrl ? (
          <a
            href={view?.pageUrl ?? pageUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="data-wiki-article__external"
          >
            Open on Wiki
          </a>
        ) : null}
        <span className="data-wiki-article__credit">
          RuneScape Wiki · CC BY-NC-SA 3.0
        </span>
      </footer>
    </div>
  );
}
