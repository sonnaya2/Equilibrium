import type {
  AmmunitionSupportStatus,
  ResolvedRangedAmmunitionProfile,
} from "@/combat/styles/ranged/ammunitionProfile";
import { ammunitionAppliedEffectId } from "@/combat/styles/ranged/ammunitionEffects";
import { equipmentIconPath } from "@/lib/gameArt";
import type { Loadout } from "./useLoadout";
import { combatEffectDisplayName } from "./effectPresentation";
import { loadoutRangedAmmunitionProfile } from "./loadout/weaponConfiguration";

type FullStatusClass = "modeled" | "partially-modeled" | "not-modeled";

interface SupportPresentation {
  readonly label: string;
  readonly fullStatusClass: FullStatusClass;
  readonly rowClass: "" | "setup-status-row--partial" | "setup-status-row--unmodeled";
}

const SUPPORT_PRESENTATION: Readonly<Record<AmmunitionSupportStatus, SupportPresentation>> = {
  modeled: {
    label: "Loaded · Active",
    fullStatusClass: "modeled",
    rowClass: "",
  },
  "partially-modeled": {
    label: "Loaded · Partial",
    fullStatusClass: "partially-modeled",
    rowClass: "setup-status-row--partial",
  },
  unsupported: {
    label: "Loaded · Unsupported",
    fullStatusClass: "not-modeled",
    rowClass: "setup-status-row--unmodeled",
  },
};

export interface AmmunitionEffectPresentation {
  readonly effectId: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly label: string;
  readonly icon: string | null;
  readonly support: AmmunitionSupportStatus;
  readonly statusLabel: string;
  readonly fullStatusClass: FullStatusClass;
  readonly rowClass: SupportPresentation["rowClass"];
}

export function rangedAmmunitionEffectPresentationFromProfile(
  profile: ResolvedRangedAmmunitionProfile | null | undefined,
): AmmunitionEffectPresentation | null {
  const projectile = profile?.projectile;
  if (projectile == null) return null;

  const effectId = ammunitionAppliedEffectId(projectile.mechanicId);
  if (effectId == null) return null;
  const label = combatEffectDisplayName(effectId);
  if (label == null) return null;

  const support = SUPPORT_PRESENTATION[projectile.support.status];
  return {
    effectId,
    itemId: projectile.itemId,
    itemLabel: projectile.label,
    label,
    icon: equipmentIconPath(projectile.itemId),
    support: projectile.support.status,
    statusLabel: support.label,
    fullStatusClass: support.fullStatusClass,
    rowClass: support.rowClass,
  };
}

export function rangedAmmunitionEffectPresentation(
  loadout: Loadout,
): AmmunitionEffectPresentation | null {
  return rangedAmmunitionEffectPresentationFromProfile(loadoutRangedAmmunitionProfile(loadout));
}
