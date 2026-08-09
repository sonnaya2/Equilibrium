export function CombatFrameCorners() {
  return (
    <span className="combat-frame-corners" aria-hidden="true">
      {(["nw", "ne", "se", "sw"] as const).map((corner) => (
        <span key={corner} className={`combat-frame-corner is-${corner}`} />
      ))}
    </span>
  );
}
