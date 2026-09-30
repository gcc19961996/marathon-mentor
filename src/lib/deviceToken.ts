// Browser-side storage for the signed device token. The token itself carries
// the role; it is verified on the server on every request.
const KEY = "mtc-device-token";
const ROLE_KEY = "mtc-device-role";

export type AppRole = "owner" | "viewer";

const listeners = new Set<() => void>();

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveDeviceToken(token: string, role: AppRole) {
  try {
    window.localStorage.setItem(KEY, token);
    window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* storage blocked — the session simply will not be remembered */
  }
  listeners.forEach((fn) => fn());
}

export function clearDeviceToken() {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}
