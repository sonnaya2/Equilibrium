"use client";

/**
 * Board Sky DOM chrome around the shared WebGPU board.
 * Ledger owns a11y region names; canvas is visual + pointer only.
 */

import { REGION_ANCHORS } from "@/map/data/regionAnchors";
import { PLACES_BY_REGION } from "@/map/data/placeAnchors";
import type { RegionId } from "@/league";
import { RemasterCanvas } from "./RemasterCanvas";
import { RemasterProvider, useRemaster } from "./remasterState";
import type { RemasterSkin } from "./skins";
import "./remaster.css";

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;

/** Fixture-honest dossier lines — labeled as concept samples, not live drops. */
function dossierFor(region: RegionId | null, place: string | null) {
  if (!region || !place) return null;
  return {
    place,
    region,
    content: [
      { name: place, kind: "pinned place" },
      { name: `${place} activities`, kind: "skilling / content (concept)" },
    ],
    drops: place.toLowerCase().includes("god wars")
      ? [
          { name: "Godsword shard (concept)", note: "illustrative — not catalog" },
          { name: "Warpriest piece (concept)", note: "illustrative — not catalog" },
        ]
      : place.toLowerCase().includes("varrock")
        ? [{ name: "Champion scroll (concept)", note: "illustrative — not catalog" }]
        : ([] as { name: string; note: string }[]),
  };
}

function ShellBody() {
  const { skin, focus, setRegion, setPlace, unlocked } = useRemaster();
  const dossier = dossierFor(focus.region, focus.place);
  const placeCount = focus.region ? (PLACES_BY_REGION.get(focus.region)?.length ?? 0) : 0;
  const picks = unlocked.size;
  // Elective-ish counter for chrome only.
  const pickLabel = `${Math.min(3, Math.max(0, picks - 2))}/3`;

  return (
    <div className={skin.shellClass}>
      <header className="remaster-nav">
        <span className="remaster-brand">EQUILIBRIUM</span>
        <ul>
          {NAV.map((n) => (
            <li key={n} className={n === "Map" ? "is-active" : undefined}>
              {n}
            </li>
          ))}
        </ul>
        <span className="remaster-picks font-mono">{pickLabel}</span>
      </header>

      <div className="remaster-meta">
        <h2>{skin.title}</h2>
        <p>{skin.blurb}</p>
        <p className="remaster-meta-note">
          Live production landmasses (REGION_SHAPES) · WebGPU · concept skin only
        </p>
      </div>

      <div className="remaster-board-sky">
        <div className="remaster-board-wrap">
          <RemasterCanvas />
        </div>

        <div className="remaster-under">
          <div className="remaster-ledger" role="group" aria-label="Regions">
            {REGION_ANCHORS.map((r) => {
              const pressed = focus.region === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setRegion(pressed ? null : (r.id as RegionId))}
                >
                  {r.name}
                  {!unlocked.has(r.id as RegionId) ? (
                    <span className="remaster-lock"> · locked</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {focus.region && placeCount > 0 && !dossier ? (
            <div className="remaster-place-rail">
              <span className="remaster-place-rail-label">Places</span>
              {(PLACES_BY_REGION.get(focus.region) ?? []).slice(0, 12).map((p) => (
                <button
                  key={p.area}
                  type="button"
                  className={focus.place === p.area ? "is-on" : undefined}
                  onClick={() => setPlace(focus.place === p.area ? null : p.area)}
                >
                  {p.area}
                </button>
              ))}
              {placeCount > 12 ? (
                <span className="remaster-more">+{placeCount - 12}</span>
              ) : null}
            </div>
          ) : null}

          <section className="remaster-dossier" aria-live="polite">
            {dossier ? (
              <>
                <h3>
                  {dossier.place}
                  <span className="remaster-dossier-sub"> · pin dossier</span>
                </h3>
                <div className="remaster-dossier-grid">
                  <table>
                    <thead>
                      <tr>
                        <th>Content</th>
                        <th>Kind</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.content.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.kind}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table>
                    <thead>
                      <tr>
                        <th>Unique drops</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.drops.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="remaster-empty">
                            No unique drops listed for this pin in the concept fixture.
                          </td>
                        </tr>
                      ) : (
                        dossier.drops.map((d) => (
                          <tr key={d.name}>
                            <td>{d.name}</td>
                            <td>{d.note}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : focus.region ? (
              <>
                <h3>
                  {REGION_ANCHORS.find((r) => r.id === focus.region)?.name}
                  <span className="remaster-dossier-sub"> · region framed</span>
                </h3>
                <p className="remaster-empty">
                  Click a map pin for content and drops. {placeCount} places pinned in this
                  region.
                </p>
              </>
            ) : (
              <p className="remaster-empty">
                Select a region on the board or ledger. Framed land stays elevated and lit.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function RemasterShell({ skin }: { skin: RemasterSkin }) {
  return (
    <RemasterProvider skin={skin}>
      <ShellBody />
    </RemasterProvider>
  );
}
