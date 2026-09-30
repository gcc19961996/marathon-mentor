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

const attempts: number[] = [];
let blockedUntil = 0;

export function checkPasscodeThrottle(): number {
  const now = Date.now();
  if (blockedUntil > now) return Math.ceil((blockedUntil - now) / 1000);
  return 0;
}

export function recordPasscodeFailure() {
  const now = Date.now();
  while (attempts.length && now - (attempts[0] as number) > 10 * 60_000) attempts.shift();
  attempts.push(now);
  if (attempts.length >= 5) {
    blockedUntil = now + 60_000;
    attempts.length = 0;
  }
}

export function clearPasscodeFailures() {
  attempts.length = 0;
  blockedUntil = 0;
}
