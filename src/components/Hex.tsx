const SIZES = {
  lg: "h-[171px] w-[148px]",
  md: "h-[111px] w-[96px]",
  sm: "h-[60px] w-[52px]",
} as const;

const STATES = {
  open: "cell-open",
  selected: "cell-open cell-selected",
  locked: "cell-locked",
  unrevealed: "cell-unrevealed",
} as const;

export type HexSize = keyof typeof SIZES;
export type HexState = keyof typeof STATES;

/**
 * Lattice cell classes. The hexagon is the layout grid here, not a logo — region
 * crests, relic tiers and the blessing lattice are the same shape at three
 * densities. Applied directly to a button when the cell is interactive, so the
 * cell keeps its own focus ring. Visual rules live in the equilibrium-ui skill.
 */
export function hexClass(size: HexSize = "md", state: HexState = "open", extra = ""): string {
  return `cell ${SIZES[size]} ${STATES[state]} ${extra}`;
}

export function Hex({
  size = "md",
  state = "open",
  className = "",
  children,
}: {
  size?: HexSize;
  state?: HexState;
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={hexClass(size, state, className)}>{children}</div>;
}

/** Rows interlock: half-cell horizontal offset, quarter-cell vertical overlap. */
export function HexRow({
  offset = false,
  className = "",
  children,
}: {
  offset?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`flex gap-1 ${offset ? "ml-[76px]" : ""} ${className}`}>{children}</div>;
}
