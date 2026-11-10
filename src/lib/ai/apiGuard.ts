import { NextResponse } from "next/server";
import { IdTokenError, verifyFirebaseIdToken } from "@/lib/firebase/verifyIdToken";

/**
 * Who may call the AI routes, and how often.
 *
 * These routes exist to keep the provider keys off the browser, which is not
 * the same as keeping strangers off the keys: until this guard they answered
 * anyone on the internet, so a script could spend the month's voice credit
 * without ever opening the app. Every page that calls them already sits behind
 * a sign-in, so asking for that sign-in's token costs a real user nothing.
 *
 * The messages below are matched by `serverErrorKeys` in `strings.ts` to be
 * shown in the reader's language. Change them in both places.
 */
export const SIGN_IN_REQUIRED = "Sign in to use this.";
export const TOO_MANY_REQUESTS = "Too many requests. Please wait a moment and try again.";
export const REQUEST_TOO_LARGE = "That request is too large.";

export type ApiRoute = "gemini" | "tts" | "transcribe";

/**
 * Per signed-in account, per minute. A run is one request per turn on each
 * route, plus replays of a line, so a person never comes near these; a loop
 * does within seconds.
 */
const LIMITS: Record<ApiRoute, number> = {
  gemini: 30,
  tts: 40,
  transcribe: 20,
};

const WINDOW_MS = 60_000;

/*
 * Held in this server instance's memory, so it is a brake, not a meter:
 * instances do not share it and a cold start forgets it. It still turns "as
 * fast as a script can post" into "a trickle per account per instance". A cap
 * that holds across instances needs a shared store (Vercel's firewall rules or
 * a Redis counter), and there is none in this project yet.
 */
const recentCalls = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 5_000;

function allowCall(key: string, limit: number, now: number): boolean {
  const recent = (recentCalls.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= limit) {
    recentCalls.set(key, recent);
    return false;
  }

  recent.push(now);
  recentCalls.set(key, recent);

  // Bounded, so a flood of distinct accounts cannot grow this without limit.
  // Insertion order makes the first key the one idle longest.
  if (recentCalls.size > MAX_TRACKED_KEYS) {
    const oldest = recentCalls.keys().next().value;

    if (oldest !== undefined) {
      recentCalls.delete(oldest);
    }
  }

  return true;
}

function refuse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * The same four values `isFirebaseConfigured()` checks, read here directly:
 * importing that module would pull the Firebase client SDK into every route.
 */
function firebaseProjectId(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  return configured ? (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string) : null;
}

/**
 * Resolves to the caller, or to the response to send back instead.
 *
 * Two cases are let through with no token, both on purpose:
 *   - No Firebase configured. The app then has no accounts at all and runs
 *     against localStorage, so there is no sign-in to ask for. A deployment in
 *     that mode is open to anyone who finds it -- give it Firebase, or keep it
 *     private.
 *   - `API_REQUIRE_AUTH=off` outside production, for the Node scripts that post
 *     to a local dev server (`scripts/probeAudioTags.mjs`). Ignored in a
 *     production build, so it cannot be left on by accident.
 */
export async function requireCaller(
  request: Request,
  route: ApiRoute,
): Promise<{ uid: string } | NextResponse> {
  const projectId = firebaseProjectId();

  if (!projectId) {
    return { uid: "local" };
  }

  if (process.env.NODE_ENV !== "production" && process.env.API_REQUIRE_AUTH === "off") {
    return { uid: "local" };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!token) {
    return refuse(SIGN_IN_REQUIRED, 401);
  }

  let uid: string;

  try {
    ({ uid } = await verifyFirebaseIdToken(token, projectId));
  } catch (error) {
    if (error instanceof IdTokenError) {
      return refuse(SIGN_IN_REQUIRED, 401);
    }

    // Google's keys could not be fetched. Refused rather than waved through:
    // failing open here would reopen the routes whenever that fetch hiccups.
    console.error("[auth] could not verify a sign-in token:", error);
    return refuse("Could not check your sign-in. Please try again.", 503);
  }

  if (!allowCall(`${route}:${uid}`, LIMITS[route], Date.now())) {
    return refuse(TOO_MANY_REQUESTS, 429);
  }

  return { uid };
}

/**
 * Refuses a body by its declared size before it is read. Declared, so it stops
 * an honest mistake or a lazy script rather than a determined one; the hosting
 * platform's own body limit is the hard stop behind it.
 */
export function refuseOversizedBody(request: Request, maxBytes: number): NextResponse | null {
  const declared = Number(request.headers.get("content-length"));

  return Number.isFinite(declared) && declared > maxBytes ? refuse(REQUEST_TOO_LARGE, 413) : null;
}
