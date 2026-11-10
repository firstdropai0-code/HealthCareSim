/**
 * Checks a Firebase ID token on the server, without the Admin SDK.
 *
 * The project deliberately has no service account (see the README's security
 * section), but an ID token needs none to verify: it is an RS256 JWT signed by
 * Google, and the public keys are published. This does the same checks the
 * Admin SDK's `verifyIdToken` does -- signature, audience, issuer, expiry,
 * subject -- with WebCrypto, so it adds no dependency and runs on any runtime.
 *
 * What it cannot do is see a revoked session or a disabled account before the
 * token's own one-hour expiry. That needs the Admin SDK. For the job here --
 * stopping strangers spending the AI keys -- an hour's lag is acceptable.
 *
 * Self-contained on purpose (no `@/` imports), so it can be run on its own.
 */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/** Used when Google's response carries no usable max-age. */
const DEFAULT_KEY_TTL_MS = 60 * 60 * 1000;

/**
 * An unknown key id normally means Google rotated its keys, so the cache is
 * refetched once. Capped, so a stream of forged tokens with made-up key ids
 * cannot turn every request into a fetch to Google.
 */
const MIN_REFETCH_INTERVAL_MS = 60 * 1000;

/** Allowance for a client clock that runs a little ahead of the server's. */
const CLOCK_SKEW_SEC = 60;

type Jwk = JsonWebKey & { kid?: string };

export type KeySource = () => Promise<{ keys: Jwk[]; ttlMs: number }>;

export type VerifiedToken = { uid: string };

export class IdTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdTokenError";
  }
}

let cachedKeys: Map<string, Jwk> | null = null;
let cacheExpiresAt = 0;
let lastFetchedAt = 0;

async function fetchGoogleKeys(): Promise<{ keys: Jwk[]; ttlMs: number }> {
  const response = await fetch(JWKS_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load Google's signing keys (${response.status}).`);
  }

  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "");
  const data = (await response.json()) as { keys?: Jwk[] };

  return {
    keys: Array.isArray(data.keys) ? data.keys : [],
    ttlMs: maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_KEY_TTL_MS,
  };
}

async function keyFor(kid: string, source: KeySource, now: number): Promise<Jwk | null> {
  const stale = !cachedKeys || now >= cacheExpiresAt;
  const mayRefetch = now - lastFetchedAt >= MIN_REFETCH_INTERVAL_MS;

  if (stale || (!cachedKeys?.has(kid) && mayRefetch)) {
    const { keys, ttlMs } = await source();

    cachedKeys = new Map(
      keys.filter((key): key is Jwk & { kid: string } => typeof key.kid === "string").map((key) => [key.kid, key]),
    );
    cacheExpiresAt = now + ttlMs;
    lastFetchedAt = now;
  }

  return cachedKeys?.get(kid) ?? null;
}

function decodeBase64Url(segment: string): Uint8Array<ArrayBuffer> {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));

    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Falls through to the error below.
  }

  throw new IdTokenError("The sign-in token is malformed.");
}

/**
 * Resolves to the caller's uid, or throws `IdTokenError` when the token should
 * be refused. Any other error means the check itself could not run (Google's
 * keys were unreachable), which a caller should report as a server fault
 * rather than as the user's sign-in being bad.
 *
 * `source` and `nowMs` exist so the checks can be exercised with a local key.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  source: KeySource = fetchGoogleKeys,
  nowMs: number = Date.now(),
): Promise<VerifiedToken> {
  const segments = token.split(".");

  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new IdTokenError("The sign-in token is malformed.");
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const header = decodeJsonSegment(headerSegment);
  const payload = decodeJsonSegment(payloadSegment);

  // Pinned, never read from the token: honouring the token's own `alg` is the
  // classic way a verifier gets talked into accepting an unsigned one.
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new IdTokenError("The sign-in token uses an unexpected signature.");
  }

  const nowSec = Math.floor(nowMs / 1000);

  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new IdTokenError("The sign-in token is for a different project.");
  }

  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new IdTokenError("The sign-in token has expired.");
  }

  if (typeof payload.iat !== "number" || payload.iat > nowSec + CLOCK_SKEW_SEC) {
    throw new IdTokenError("The sign-in token is not valid yet.");
  }

  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) {
    throw new IdTokenError("The sign-in token names no user.");
  }

  const jwk = await keyFor(header.kid, source, nowMs);

  if (!jwk) {
    throw new IdTokenError("The sign-in token was signed with an unknown key.");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(signatureSegment),
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );

  if (!valid) {
    throw new IdTokenError("The sign-in token's signature does not match.");
  }

  return { uid: payload.sub };
}
