import type { CastRecord } from "@/combat";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { formatNumber } from "./revoPanelFormat";

export function RotationAnalysisCastTimeline({
  casts,
  nameForId,
}: {
  casts: readonly CastRecord[];
  nameForId: (id: string) => string;
}) {
  return (
    <section className="rotation-analysis-section rotation-analysis-timeline">
      <h3 className="combat-section-title rotation-analysis-section__title">
        Ability casts
        <span className="rotation-analysis-section__meta">
          {casts.length} cast{casts.length === 1 ? "" : "s"}
        </span>
      </h3>
      <div className="revo-timeline-scroll" data-testid="analysis-cast-timeline">
        <table className="revo-cast-table">
          <caption className="sr-only">Ability cast timeline</caption>
          <thead>
            <tr>
              <th>Tick</th>
              <th>Ability</th>
              <th className="text-right">Dmg</th>
            </tr>
          </thead>
          <tbody>
            {casts.map((cast, index) => {
              const spec = ENGINE_SPECS.get(cast.abilityId);
              return (
                <tr key={`${cast.tick}-${cast.abilityId}-${index}`}>
                  <td className="revo-num">{cast.tick}</td>
                  <td className="revo-ability-cell">
                    <span className="revo-ability-line">
                      {spec ? (
                        <GameIcon
                          src={abilityIconPath(spec.id, spec.style)}
                          size={16}
                          className="shrink-0"
                        />
                      ) : null}
                      <span className="revo-ability-name">{nameForId(cast.abilityId)}</span>
                    </span>
                  </td>
                  <td className="revo-num revo-dmg-cell text-right">
                    {formatNumber(cast.result.expected)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
