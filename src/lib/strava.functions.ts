import { createServerFn } from "@tanstack/react-start";

export type StravaStatus = {
  configured: boolean;
  connected: boolean;
  athleteName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  runCount: number;
  splitsCount: number;
  callbackDomain: string;
};

/** Status only — tokens never leave the server. */
export const getStravaStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<StravaStatus> => {
    (await import("./gate.server")).requireAnyRole();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getConnection, PUBLIC_ORIGIN } = await import("./strava.server");
    const conn = await getConnection();
    const configured = Boolean(
      (process.env["STRAVA_CLIENT_ID"] && process.env["STRAVA_CLIENT_SECRET"]) ||
      (conn?.client_id && conn?.client_secret),
    );
    const { count } = await supabaseAdmin
      .from("runs")
      .select("id", { count: "exact", head: true })
      .not("strava_activity_id", "is", null);
    const { data: splitRows } = await supabaseAdmin.from("run_splits").select("strava_activity_id");
    const splitsCount = new Set((splitRows ?? []).map((row) => Number(row.strava_activity_id)))
      .size;
    return {
      configured,
      connected: Boolean(conn?.refresh_token),
      athleteName: conn?.athlete_name ?? null,
      lastSyncedAt: conn?.last_synced_at ?? null,
      lastError: conn?.last_error ?? null,
      runCount: count ?? 0,
      splitsCount,
      callbackDomain: new URL(PUBLIC_ORIGIN).hostname,
    };
  },
);

export const getStravaAuthUrl = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ url: string }> => {
    (await import("./gate.server")).requireOwner();
    const { newOauthState } = await import("./gate.server");
    const { stravaCredentials, REDIRECT_URI } = await import("./strava.server");
    const { clientId } = await stravaCredentials();
    const state = await newOauthState();
    const url =
      `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&approval_prompt=force&scope=activity:read_all&state=${encodeURIComponent(state)}`;
    return { url };
  },
);

export const saveStravaCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: string; clientSecret: string }) => input)
  .handler(async ({ data }) => {
    (await import("./gate.server")).requireOwner();
    const { saveConnection } = await import("./strava.server");
    await saveConnection({
      client_id: data.clientId.trim(),
      client_secret: data.clientSecret.trim(),
      last_error: null,
    });
    return { ok: true };
  });

/**
 * Called by the /strava/callback page. This step runs before the device is
 * necessarily unlocked in that tab, so it is protected by the OAuth state value
 * that this app generated a moment earlier.
 */
export const completeStravaConnect = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; scope?: string; state?: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; message?: string; imported?: number; matched?: number }> => {
      const { consumeOauthState } = await import("./gate.server");
      if (!(await consumeOauthState(data.state))) {
        return {
          ok: false,
          message:
            "This connection request could not be verified. Start again from Settings on this site.",
        };
      }
      const { exchangeCode, saveConnection, syncStrava } = await import("./strava.server");
      try {
        const token = await exchangeCode(data.code);
        await saveConnection({
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: new Date(token.expires_at * 1000).toISOString(),
          scope: token.scope ?? data.scope ?? null,
          athlete_id: token.athlete?.id ?? null,
          athlete_name:
            [token.athlete?.firstname, token.athlete?.lastname].filter(Boolean).join(" ") || null,
          last_synced_at: null,
          last_error: null,
        });
        // Import the full activity list before the callback finishes. Split details
        // are filled in by the next manual or automatic sync to keep OAuth reliable.
        const sync = await syncStrava({ includeSplits: false, replacePastedRuns: true });
        if (sync.status === "error") {
          return { ok: true, message: `Connected, but the first sync failed: ${sync.message}` };
        }
        return { ok: true, imported: sync.imported ?? 0, matched: sync.matched ?? 0 };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Strava connection failed";
        console.error("[strava] connect failed", err);
        await saveConnection({ last_error: message });
        return { ok: false, message };
      }
    },
  );

/**
 * Records why a Strava connection attempt failed. Like completeStravaConnect it
 * runs before the device is necessarily unlocked, so it only accepts the OAuth
 * state value this app generated for the attempt.
 */
export const saveStravaConnectError = createServerFn({ method: "POST" })
  .inputValidator((input: { message: string; state?: string }) => input)
  .handler(async ({ data }) => {
    const { consumeOauthState } = await import("./gate.server");
    if (!(await consumeOauthState(data.state))) return { ok: false };
    const { saveConnection } = await import("./strava.server");
    await saveConnection({ last_error: data.message.slice(0, 500) });
    return { ok: true };
  });

export const runStravaSync = createServerFn({ method: "POST" }).handler(async () => {
  (await import("./gate.server")).requireOwner();
  const { syncStrava, getConnection } = await import("./strava.server");
  const conn = await getConnection();
  const last = conn?.last_synced_at ? Date.parse(conn.last_synced_at) : 0;
  if (last && Date.now() - last < 2 * 60_000) {
    return { status: "error" as const, message: "Just synced — try again in a couple of minutes." };
  }
  return syncStrava();
});

export const disconnectStrava = createServerFn({ method: "POST" }).handler(async () => {
  (await import("./gate.server")).requireOwner();
  const { saveConnection } = await import("./strava.server");
  // Imported runs stay; only the connection is cleared.
  await saveConnection({
    access_token: null,
    refresh_token: null,
    expires_at: null,
    athlete_id: null,
    athlete_name: null,
    last_error: null,
  });
  return { ok: true };
});
