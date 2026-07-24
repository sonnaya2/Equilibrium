/**
 * RS applies modifiers to floored intermediates, then floors again. Compose these in
 * sequence; never rewrite a floor(A) -> mod -> floor(B) chain as floor(A*B).
 */
export function mulFloor(value: number, factor: number): number {
  return Math.floor(value * factor);
}

export function percentFloor(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}
