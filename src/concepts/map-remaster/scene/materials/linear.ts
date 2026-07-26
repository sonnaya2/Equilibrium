/**
 * Hex token -> linear-space vec3 for TSL graphs.
 * Hand-built: TSL `color()` node type does not mix with vec3 under r185 defs.
 */
import { vec3 } from "three/tsl";

export function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}
