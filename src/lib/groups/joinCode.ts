/**
 * No 0/O or 1/I — codes get read aloud and copied off a screen, and those are
 * the pairs people get wrong. 32 characters over 6 positions is ~1.07e9 codes.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }

  return code;
}

/** Uppercases and strips separators so "abc-123" and "ABC123" both work. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function isWellFormedJoinCode(input: string): boolean {
  const normalized = normalizeJoinCode(input);

  return (
    normalized.length === JOIN_CODE_LENGTH &&
    [...normalized].every((character) => ALPHABET.includes(character))
  );
}
