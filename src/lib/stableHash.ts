/**
 * Small stable string hash (FNV-1a). Same input, same number, on every device
 * and every load -- which is the whole point: a scenario's voices and faces are
 * derived from its id rather than stored per viewer, so a trainee and their
 * mentor replaying the same run meet the same people.
 */
export function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
