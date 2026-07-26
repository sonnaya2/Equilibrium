"use client";

import type { ReactNode } from "react";
import { RegionCrest } from "@/components/RegionCrest";
import {
  canSelectElective,
  type BuildState,
  type RegionId,
} from "@/league";
import {
  BLESSING_PATHS,
  godTierAlignments,
  PATH_TIERS,
  type BlessingPath,
} from "@/league/blessings";
import {
  availLabel,
  relicIcon,
  relicMono,
  SHOWCASE_BLESSING_TIERS,
  SHOWCASE_REGIONS,
  type ShowcaseRegion,
} from "./showcaseData";

export function Mast({
  title,
  pickCounter,
  loaded,
  picksLen,
  onClear,
  onCopy,
  copyLabel,
  onReset,
  pathPicks,
  extra,
}: {
  title: string;
  pickCounter: string;
  loaded: boolean;
  picksLen: number;
  onClear: () => void;
  onCopy: () => void;
  copyLabel: string;
  onReset?: () => void;
  /** Blessing path trail as micro-pips (Order / Chaos / Balance). Nameplate only. */
  pathPicks?: readonly string[];
  extra?: ReactNode;
}) {
  return (
    <div className="r3-build__mast">
      <h2 className="r3-build__title">{title}</h2>
      <span className="r3-build__count" aria-live="polite">
        {pickCounter}
      </span>
      {pathPicks && pathPicks.length > 0 ? (
        <span
          className="r3-build__path-pips"
          aria-label={`Path ${pathPicks.join(" → ")}`}
        >
          {pathPicks.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className={`r3-build__path-pip is-${p.toLowerCase()}`}
              title={p}
            />
          ))}
        </span>
      ) : null}
      <button
        type="button"
        className="r3-build__btn"
        disabled={!loaded || picksLen === 0}
        onClick={onClear}
      >
        Clear picks
      </button>
      <button
        type="button"
        className="r3-build__btn r3-build__btn--gem"
        disabled={!loaded}
        onClick={onCopy}
      >
        {copyLabel}
      </button>
      {onReset ? (
        <button type="button" className="r3-build__btn" disabled={!loaded} onClick={onReset}>
          Reset build
        </button>
      ) : null}
      {extra}
    </div>
  );
}

export function RegionHive({
  build,
  loaded,
  onToggle,
  className,
}: {
  build: BuildState;
  loaded: boolean;
  onToggle: (id: RegionId) => void;
  className?: string;
}) {
  const picks = build.elective;
  const cells = SHOWCASE_REGIONS.map((region) => (
    <RegionCell
      key={region.id}
      region={region}
      build={build}
      loaded={loaded}
      picks={picks}
      onToggle={onToggle}
    />
  ));
  // className "contents" lets parents (flex/grid) own layout.
  if (className === "contents") {
    return <>{cells}</>;
  }
  return <div className={className}>{cells}</div>;
}

function RegionCell({
  region,
  build,
  loaded,
  picks,
  onToggle,
}: {
  region: ShowcaseRegion;
  build: BuildState;
  loaded: boolean;
  picks: RegionId[];
  onToggle: (id: RegionId) => void;
}) {
  const elective = region.availability === "elective";
  const selectable = elective && canSelectElective(build, region.id as RegionId);
  const blocked = elective && (!loaded || !selectable);
  const isOn = !elective || picks.includes(region.id as RegionId);
  // Visual meta: start | early | pick (availability only — never invent labels).
  const meta = availLabel(region.availability);
  // Accessible name must start with display name (frozen contract / map ledger parity).
  const status = blocked ? "blocked" : isOn && elective ? "picked" : meta;
  // Board tiles: r3-seal only (avoids legacy .r3-region flex wars).
  const className = [
    "r3-seal",
    isOn ? "is-on" : "",
    elective && !isOn ? "is-dim" : "",
    blocked ? "is-blocked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      aria-pressed={isOn}
      aria-disabled={blocked || undefined}
      disabled={blocked}
      aria-label={`${region.name}, ${status}`}
      onClick={() => {
        if (elective && loaded && selectable) onToggle(region.id as RegionId);
      }}
    >
      {/* Crest decorative — never prefixes accessible name. */}
      <span className="r3-seal__crest">
        <RegionCrest regionId={region.id} size={40} className="r3-seal__crest-art" />
      </span>
      <span className="r3-seal__name" aria-hidden="true">
        {region.name}
      </span>
      <span className="r3-seal__meta" aria-hidden="true">
        {meta}
      </span>
    </button>
  );
}

export function RelicChoiceButton({
  name,
  selected,
  onPick,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
}) {
  const icon = relicIcon(name);
  const mono = relicMono(name);
  return (
    <button
      type="button"
      className={`r3-choice${selected ? " is-on" : ""}`}
      aria-pressed={selected}
      onClick={onPick}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" />
      ) : (
        <span className="mono" aria-hidden>
          {mono}
        </span>
      )}
      <span>{name}</span>
    </button>
  );
}

export function BlessingLattice({
  build,
  onPick,
  compact,
  className,
}: {
  build: BuildState;
  onPick: (tier: number, path: BlessingPath) => void;
  compact?: boolean;
  className?: string;
}) {
  const paths =
    SHOWCASE_BLESSING_TIERS.find((t) => !t.godTier)?.paths ??
    ([...BLESSING_PATHS] as string[]);
  const alignments = godTierAlignments(build.blessingPicks);
  const tiers = SHOWCASE_BLESSING_TIERS;
  const rootClass = className ? `r3-lattice ${className}` : "r3-lattice";

  return (
    <div
      className={rootClass}
      role="grid"
      aria-label="Blessing lattice"
      style={compact ? { gap: "0.15rem" } : undefined}
    >
      <span />
      {tiers.map((t) => (
        <span key={t.tier} className="r3-lattice__head">
          T{t.tier}
          {t.godTier ? "?" : ""}
        </span>
      ))}
      {paths.flatMap((path) => {
        // Path chip: keep sizing classes (r3-tier) + path color token; visible text
        // so meaning is not color-only.
        const row = [
          <span
            key={`${path}-l`}
            className={`r3-tier r3-lattice__path is-${path.toLowerCase()}`}
          >
            {path}
          </span>,
        ];
        for (const tier of tiers) {
          if (tier.godTier) {
            const god = alignments[tier.tier];
            const lit = god === path;
            row.push(
              <div
                key={`${path}-${tier.tier}`}
                className={`r3-lattice__cell is-god${lit ? " is-on" : ""}`}
                role="img"
                title={god ? `God T${tier.tier}: ${god}` : `God T${tier.tier} open`}
                aria-label={`${path}, god tier ${tier.tier}${lit ? ", active" : ", open"}`}
              />,
            );
            continue;
          }
          const pickIndex = PATH_TIERS.indexOf(tier.tier);
          const valid = (BLESSING_PATHS as readonly string[]).includes(path);
          if (pickIndex < 0 || !valid) {
            row.push(
              <div
                key={`${path}-${tier.tier}`}
                className="r3-lattice__cell"
                aria-hidden="true"
              />,
            );
            continue;
          }
          const locked = pickIndex > build.blessingPicks.length;
          const selected = build.blessingPicks[pickIndex] === path;
          const state = selected ? ", selected" : locked ? ", locked" : "";
          row.push(
            <button
              key={`${path}-${tier.tier}`}
              type="button"
              disabled={locked}
              aria-pressed={selected}
              aria-label={`${path}, tier ${tier.tier}${state}`}
              className={`r3-lattice__cell${selected ? " is-on" : ""}`}
              onClick={() => onPick(tier.tier, path as BlessingPath)}
            />,
          );
        }
        return row;
      })}
    </div>
  );
}

export function EffectsList({
  name,
  effects,
}: {
  name: string | null;
  effects: string[];
}) {
  if (!name) {
    return <p className="r3-muted">Pick a Tier 1 relic.</p>;
  }
  return (
    <>
      <p className="r3-label">{name}</p>
      <ul className="r3-effects">
        {effects.map((fx) => (
          <li key={fx}>{fx}</li>
        ))}
      </ul>
    </>
  );
}
