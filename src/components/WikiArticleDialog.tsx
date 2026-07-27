"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WikiFact } from "@/lib/wikiArticle";
import { safeWikiPage } from "@/lib/wikiArticle";
import { collectArticleAssets, resolveLocalAsset, resolveLocalAssets } from "@/lib/wikiLocalAssets";
import { notableDropsForPresentation, pickHeroFacts } from "@/lib/wikiDropPresentation";
import { WikiDropTable, WikiNotableDrops } from "@/components/WikiDropTable";
import { WikiAssetRail, WikiFactStrip, type WikiFactChip } from "@/components/WikiArticleChrome";
import {
  applyPixelScale,
  isWikiView,
  type WikiArticleTarget,
  type WikiDropRow,
  type WikiLoadState,
} from "@/components/wiki/wikiArticleModel";
import "@/components/wiki/wiki-article.css";

export type { WikiArticleTarget, WikiDropRow };

function factsToChips(facts: WikiFact[]): WikiFactChip[] {
  return facts.map((f) => {
    const icon = resolveLocalAsset(f.value) ?? resolveLocalAsset(f.label) ?? null;
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
  const [load, setLoad] = useState<WikiLoadState>({ status: "idle" });
  // Full drop table lives in a nested dialog — keeps the article modal short.

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
          message: error instanceof Error ? error.message : "Could not load article",
          pageUrl: fetchPageUrl,
        });
      });

    return () => controller.abort();
  }, [fetchPageUrl]);

  const title = load.status === "ready" ? load.view.title : (target?.name ?? "Article");

  return (
    <dialog
      ref={dialogRef}
      className={imageOnly || !target ? "data-image-viewer" : "data-image-viewer data-wiki-article"}
      aria-label={target ? `${title} article` : "Article"}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {target ? (
        imageOnly ? (
          <>
            <button
              type="button"
              className="data-image-viewer__close"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              <span aria-hidden>×</span>
            </button>
            <ImageOnlyBody
              src={target.localArtSrc}
              name={target.name}
              relatedLabels={target.relatedLabels}
              pixelated={pixelated}
              setPixelated={setPixelated}
            />
          </>
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
            onClose={() => dialogRef.current?.close()}
          />
        )
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
            onLoad={(event) => applyPixelScale(event.currentTarget, setPixelated, 480)}
          />
        ) : (
          <span className="data-wiki-article__art-empty" aria-hidden />
        )}
      </div>
      <p className="data-wiki-article__image-only-name">{name}</p>
      {railAssets.length > 0 ? (
        <WikiAssetRail assets={railAssets} primary={{ src, label: name }} />
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
  onClose,
}: {
  name: string;
  localArtSrc: string | null;
  relatedLabels?: string[];
  relatedIcons?: { label: string; src: string }[];
  pageUrl: string | null;
  load: WikiLoadState;
  pixelated: boolean;
  setPixelated: (v: boolean) => void;
  onClose: () => void;
}) {
  const dropsDialogRef = useRef<HTMLDialogElement>(null);
  const [dropsOpen, setDropsOpen] = useState(false);
  const view = load.status === "ready" ? load.view : null;
  const heading = view?.title || name;
  const drops = view?.drops ?? [];
  const hasStructuredDrops = drops.length > 0;
  const hasHtmlDrops = Boolean(view?.hasDrops && view.dropsHtml.trim());
  // Prefer click-time safe URL; re-validate view.pageUrl before external nav.
  const externalWikiHref =
    pageUrl ?? (view?.pageUrl ? safeWikiPage(view.pageUrl)?.pageUrl : null) ?? null;
  const showDrops = hasStructuredDrops || hasHtmlDrops;

  useEffect(() => {
    const dialog = dropsDialogRef.current;
    if (!dialog) return;
    if (dropsOpen && !dialog.open) dialog.showModal();
    if (!dropsOpen && dialog.open) dialog.close();
  }, [dropsOpen]);

  // Close the nested drops window when the parent article unloads / reloads.
  useEffect(() => {
    setDropsOpen(false);
  }, [pageUrl, load.status]);

  const iconByItem = useMemo(() => {
    if (!view) return {};
    return dropIconMap(view.drops ?? [], relatedIcons);
  }, [view, relatedIcons]);

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

  const heroFacts = useMemo(() => (view?.facts.length ? pickHeroFacts(view.facts, 4) : []), [view]);
  const factChips = useMemo(() => factsToChips(heroFacts), [heroFacts]);

  const notable = useMemo(
    () => (hasStructuredDrops ? notableDropsForPresentation(drops, 8) : []),
    [hasStructuredDrops, drops],
  );

  const bodyHtml = view?.bodyHtml?.trim() ?? "";
  const leadHtml = view?.leadHtml?.trim() ?? "";
  // Facts strip already shows combat level — don't double it under the art.
  const showArtCaption =
    !heroFacts.some((f) => /combat\s*level/i.test(f.label)) && Boolean(name && name !== heading);

  // Notable strip + unique summary table were the same items twice (see Gate of Elidinis).
  // Prefer the rate table when structured uniques exist; strip only when no table.
  const showNotableStrip = notable.length > 0 && !hasStructuredDrops;
  // Icon rail mostly repeats drop glyphs — keep only when we have no drop tables.
  const showAssetRail = railAssets.length > 0 && !hasStructuredDrops;

  return (
    <div className="data-wiki-article__shell">
      <header className="data-wiki-article__header">
        <h2 className="data-wiki-article__title">{heading}</h2>
        <button
          type="button"
          className="data-wiki-article__close"
          aria-label="Close"
          onClick={onClose}
        >
          <span aria-hidden>×</span>
        </button>
      </header>

      {/* Hero: art sized to content · summary shares the row without stretch voids. */}
      <div className="data-wiki-article__hero">
        <div className="data-wiki-article__stage">
          <div className="data-wiki-article__art-primary">
            {localArtSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localArtSrc}
                alt=""
                className={
                  pixelated ? "data-wiki-article__art-img is-pixel" : "data-wiki-article__art-img"
                }
                onLoad={(event) =>
                  // Only upscale tiny inventory glyphs; boss art fills via CSS.
                  applyPixelScale(event.currentTarget, setPixelated, 280)
                }
              />
            ) : (
              <span className="data-wiki-article__art-empty" aria-hidden />
            )}
            {showArtCaption ? <p className="data-wiki-article__art-name">{name}</p> : null}
          </div>
        </div>

        <div className="data-wiki-article__summary">
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

          {leadHtml ? (
            <div
              className="data-wiki-article__content data-wiki-article__lead-prose"
              dangerouslySetInnerHTML={{ __html: leadHtml }}
            />
          ) : null}

          {factChips.length > 0 ? <WikiFactStrip facts={factChips} /> : null}

          {showNotableStrip ? (
            <div className="data-wiki-article__modules" aria-label="Encounter">
              <section className="data-wiki-article__module">
                <h3 className="data-wiki-article__module-title">Notable drops</h3>
                <WikiNotableDrops rows={notable} iconByItem={iconByItem} />
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {/* Summary drops — full table opens in a nested dialog. */}
      {showDrops ? (
        <section className="data-wiki-article__drops" aria-label="Drops">
          {hasStructuredDrops ? (
            <WikiDropTable
              rows={drops}
              iconByItem={iconByItem}
              variant="summary"
              onOpenFull={() => setDropsOpen(true)}
            />
          ) : null}
          {!hasStructuredDrops && hasHtmlDrops ? (
            <div
              className="data-wiki-article__content"
              dangerouslySetInnerHTML={{ __html: view!.dropsHtml }}
            />
          ) : null}
        </section>
      ) : null}

      {showAssetRail ? (
        <WikiAssetRail assets={railAssets} primary={{ src: localArtSrc, label: name }} />
      ) : null}

      {bodyHtml ? (
        <details className="data-wiki-article__body">
          <summary className="data-wiki-article__body-summary">More</summary>
          <div
            className="data-wiki-article__content"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </details>
      ) : null}

      <footer className="data-wiki-article__footer">
        {externalWikiHref ? (
          <a
            href={externalWikiHref}
            target="_blank"
            rel="noreferrer"
            className="data-wiki-article__external"
          >
            Open on Wiki
          </a>
        ) : null}
        <span className="data-wiki-article__credit">RuneScape Wiki · CC BY-NC-SA 3.0</span>
      </footer>

      {/* Full drop table popup — separate scroll surface from the article shell. */}
      <dialog
        ref={dropsDialogRef}
        className="data-wiki-drops-popup"
        aria-label={`${heading} full drop table`}
        onClose={() => setDropsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="data-wiki-drops-popup__shell">
          <header className="data-wiki-drops-popup__header">
            <h2 className="data-wiki-drops-popup__title">
              {heading}
              <span className="data-wiki-drops-popup__subtitle">Drops</span>
            </h2>
            <button
              type="button"
              className="data-wiki-article__close"
              aria-label="Close drop table"
              onClick={() => dropsDialogRef.current?.close()}
            >
              <span aria-hidden>×</span>
            </button>
          </header>
          <div className="data-wiki-drops-popup__body">
            {hasStructuredDrops ? (
              <WikiDropTable rows={drops} iconByItem={iconByItem} variant="full" />
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
