/** Small authored brace reused by the major Combat workbench frames. */
export function CombatFrameCorners() {
  return (
    <span className="combat-frame-corners" aria-hidden="true">
      {(["nw", "ne", "se", "sw"] as const).map((corner) => (
        <svg key={corner} className={`combat-frame-corner is-${corner}`} viewBox="0 0 28 28">
          <path d="M1 27V9L9 1h18M1 16h5l6-6M12 1v5M17 1l4 4" />
          <path d="m6 6 3-3 3 3-3 3z" />
        </svg>
      ))}
    </span>
  );
}
