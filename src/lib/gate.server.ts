// Server-only device gate: passcode check, signed device tokens, and the
// one-time Strava OAuth state value. Nothing here ever reaches the browser.
import { useSession, getRequestHeader } from "@tanstack/react-start/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AppRole = "owner" | "viewer";

export type GateSession = {
  oauthState?: string;
};

const THIRTY_MINUTES = 60 * 30;
export const TOKEN_DAYS = 90;

function sessionConfig() {
  const password = process.env["APP_SESSION_SECRET"];
  if (!password) throw new Error("The app is missing its session secret.");
  const secure = process.env["NODE_ENV"] !== "development";
  return {
    password,
    name: "mtc-device",
    maxAge: THIRTY_MINUTES,
    cookie: {
      httpOnly: true,
      secure,
      sameSite: (secure ? "none" : "lax") as "none" | "lax",
      path: "/",
    },
  };
}

export function gateSession() {
  // TanStack Start server session helper, not a React hook.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<GateSession>(sessionConfig());
}

export async function newOauthState(): Promise<string> {
  const session = await gateSession();
  const state = randomBytes(16).toString("hex");
  await session.update({ oauthState: state });
  return state;
}

export async function consumeOauthState(state: string | null | undefined): Promise<boolean> {
  const session = await gateSession();
  const saved = session.data.oauthState;
  if (!saved || !state || saved !== state) return false;
  await session.update({ oauthState: "" });
  return true;
}

/* ---------- passcode + signed device tokens ---------- */

function tokenSecret(): string {
  const secret = process.env["APP_TOKEN_SECRET"];
  if (!secret) throw new Error("The app is missing its token secret.");
  return secret;
}

function sameSecret(a: string, b: string): boolean {
  // Hash first: timingSafeEqual needs equal lengths, and the raw length leaks.
  const x = createHash("sha256").update(a, "utf8").digest();
  const y = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(x, y);
}

function sign(payload: string): string {
  return createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

export function mintToken(role: AppRole): { token: string; expiresAt: string } {
  const exp = Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role, exp }), "utf8").toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

export function roleForPasscode(passcode: string): AppRole | null {
  const owner = process.env["APP_PASSCODE"];
  const viewer = process.env["VIEWER_PASSCODE"];
  const entered = passcode.trim();
  if (!entered) return null;
  if (owner && sameSecret(entered, owner)) return "owner";
  if (viewer && sameSecret(entered, viewer)) return "viewer";
  return null;
}

export function roleFromToken(token: string | null | undefined): AppRole | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!sameSecret(signature, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
      exp?: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (parsed.role === "owner" || parsed.role === "viewer") return parsed.role;
    return null;
  } catch {
    return null;
  }
}

export class LockedError extends Error {
  constructor(message = "Locked — enter your passcode to continue.") {
    super(message);
    this.name = "LockedError";
  }
}

function requestToken(): string | null {
  try {
    return getRequestHeader("x-app-token") ?? null;
  } catch {
    return null;
  }
}

/** Any unlocked device (owner or viewer). */
export function requireAnyRole(): AppRole {
  const role = roleFromToken(requestToken());
  if (!role) throw new LockedError();
  return role;
}

/** Full-access device only. */
export function requireOwner(): AppRole {
  const role = roleFromToken(requestToken());
  if (!role) throw new LockedError();
  if (role !== "owner") throw new Error("View only — this device cannot make changes.");
  return role;
}

/* ---------- passcode attempt throttle ---------- */

// 5 wrong passcodes within 15 minutes locks unlocking for 15 minutes. The
// count lives in the database (unlock_throttle) so every server instance
// shares it; memory is only a fallback if the database cannot be reached.
const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;

const attempts: number[] = [];
let blockedUntil = 0;

async function throttleRpc<T>(name: string, args?: Record<string, number>): Promise<T | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
    if (error) throw error;
    return data as T;
  } catch (err) {
    console.error(`[gate] ${name} failed; using in-memory throttle`, err);
    return null;
  }
}

/** Seconds until another passcode attempt is allowed (0 when allowed now). */
export async function checkPasscodeThrottle(): Promise<number> {
  const wait = await throttleRpc<number>("unlock_wait_seconds");
  if (wait !== null) return wait;
  const now = Date.now();
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : 0;
}

export async function recordPasscodeFailure(): Promise<void> {
  const locked = await throttleRpc<number>("record_unlock_failure", {
    max_failures: MAX_FAILURES,
    window_seconds: WINDOW_SECONDS,
    lock_seconds: LOCK_SECONDS,
  });
  if (locked !== null) return;
  const now = Date.now();
  while (attempts.length && now - (attempts[0] as number) > WINDOW_SECONDS * 1000) attempts.shift();
  attempts.push(now);
  if (attempts.length >= MAX_FAILURES) {
    blockedUntil = now + LOCK_SECONDS * 1000;
    attempts.length = 0;
  }
}

export async function clearPasscodeFailures(): Promise<void> {
  attempts.length = 0;
  blockedUntil = 0;
  await throttleRpc("clear_unlock_failures");
}
