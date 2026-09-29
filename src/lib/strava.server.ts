// Server-only Strava helpers. Tokens never leave this file's callers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clockLeftRunning, flagSplits, GAP_SECONDS, type SplitRow } from "./splitFlags";

export const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

/** Strava only ever redirects back to the published site, never a preview URL. */
export const PUBLIC_ORIGIN = "https://run-mindset-coach.lovable.app";
export const REDIRECT_URI = `${PUBLIC_ORIGIN}/strava/callback`;

/** Activity types that count as a run (treadmill runs arrive as VirtualRun). */
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

/** Strava allows 100 reads / 15 min; keep detail calls well under that. */
const MAX_DETAIL_CALLS = 80;

export type Connection = {
  id: string;
  athlete_id: number | null;
  athlete_name: string | null;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

/** Env vars win; otherwise fall back to keys saved from the Settings card. */
export async function stravaCredentials() {
  const clientId = process.env["STRAVA_CLIENT_ID"];
  const clientSecret = process.env["STRAVA_CLIENT_SECRET"];
  if (clientId && clientSecret) return { clientId, clientSecret };
  const conn = await getConnection();
  if (conn?.client_id && conn.client_secret) {
    return { clientId: conn.client_id, clientSecret: conn.client_secret };
  }
  throw new Error("Strava is not set up yet — add your Client ID and Secret in Settings.");
}

export async function getConnection(): Promise<Connection | null> {
  const { data } = await supabaseAdmin
    .from("strava_connection")
    .select("*")
    .eq("user_id", SINGLE_USER_ID)
    .maybeSingle();
  return (data as Connection) ?? null;
}

export async function saveConnection(patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("strava_connection")
    .upsert(
      { user_id: SINGLE_USER_ID, updated_at: new Date().toISOString(), ...patch } as never,
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret } = await stravaCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[strava] token exchange failed", res.status, text);
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; errors?: { field?: string; code?: string }[] };
      const first = parsed.errors?.[0];
      detail = [parsed.message, first ? `${first.field ?? ""} ${first.code ?? ""}`.trim() : null]
        .filter(Boolean)
        .join(": ");
    } catch {
      /* keep raw text */
    }
    throw new Error(`Strava rejected the connection (${res.status}) ${detail}`.trim());
  }
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    scope?: string;
    athlete?: { id: number; firstname?: string; lastname?: string };
  };
}

/** Returns a valid access token, refreshing it when it has expired. */
async function accessToken(conn: Connection): Promise<string> {
  const expiresAt = conn.expires_at ? Date.parse(conn.expires_at) : 0;
  if (conn.access_token && expiresAt - Date.now() > 120_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error("revoked");

  const { clientId, clientSecret } = await stravaCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) throw new Error("revoked");
  if (!res.ok) throw new Error("unreachable");
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  await saveConnection({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(json.expires_at * 1000).toISOString(),
  });
  return json.access_token;
}

type StravaActivity = {
  id: number;
  sport_type?: string;
  type?: string;
  workout_type?: number | null;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_speed?: number;
  name?: string;
};

const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("revoked");
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok) throw new Error("unreachable");
  return (await res.json()) as T;
}

export type SyncResult = {
  status: "ok" | "not-connected" | "error";
  imported?: number;
  matched?: number;
  message?: string;
};

/** Strava's workout_type on runs: 1 race, 2 long run, 3 workout. */
function workoutLabel(a: StravaActivity): string | null {
  if (a.workout_type === 1) return "Race";
  if (a.workout_type === 2) return "Long Run";
  if (a.workout_type === 3) return "Tempo";
  return null;
}

export async function syncStrava(
  options: { includeSplits?: boolean; replacePastedRuns?: boolean } = {},
): Promise<SyncResult> {
  const conn = await getConnection();
  if (!conn?.refresh_token) return { status: "not-connected" };

  try {
    const token = await accessToken(conn);

    // One-time cleanup at first connect: pasted copies of Strava runs are
    // dropped so the real Strava records replace them. Runs logged by hand
    // (source "manual") are never touched.
    if (options.replacePastedRuns) {
      const { data: pasted } = await supabaseAdmin
        .from("runs")
        .select("id")
        .eq("source", "strava_import")
        .is("strava_activity_id", null);
      const ids = (pasted ?? []).map((r: { id: string }) => r.id);
      if (ids.length) {
        await supabaseAdmin
          .from("plan_days")
          .update({ actual_run_id: null, status: "planned" } as never)
          .in("actual_run_id", ids);
        await supabaseAdmin.from("runs").delete().in("id", ids);
      }
    }
    // First sync pulls a full year; later syncs only look just past the last sync.
    const since = conn.last_synced_at
      ? Math.floor(Date.parse(conn.last_synced_at) / 1000) - 3 * 86400
      : Math.floor((Date.now() - 365 * 86400_000) / 1000);

    const activities: StravaActivity[] = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await api<StravaActivity[]>(
        `/athlete/activities?after=${since}&per_page=100&page=${page}`,
        token,
      );
      activities.push(...batch);
      if (batch.length < 100) break;
    }

    const runs = activities.filter((a) => RUN_TYPES.has(a.sport_type ?? a.type ?? ""));
    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("recent_race_date, recent_race_distance_mi")
      .eq("user_id", SINGLE_USER_ID)
      .maybeSingle();
    let imported = 0;
    let matched = 0;

    for (const a of runs) {
      const date = a.start_date_local.slice(0, 10);
      const miles = Math.round((a.distance / M_PER_MI) * 100) / 100;
      const matchesRecentRace = Boolean(
        profile?.recent_race_date === date &&
        (date === "2026-04-26"
          ? miles >= 13.1 && miles <= 13.8
          : Math.abs(miles - Number(profile?.recent_race_distance_mi ?? 0)) <= 0.1),
      );
      const label = workoutLabel(a) ?? (matchesRecentRace ? "Race" : null);
      const elapsed = a.elapsed_time ?? null;
      const stopped = elapsed && elapsed > a.moving_time ? elapsed - a.moving_time : null;
      const fields = {
        date,
        distance_mi: miles,
        duration_seconds: a.moving_time,
        elapsed_seconds: elapsed,
        stopped_seconds: stopped,
        clock_left_running: clockLeftRunning({
          distance_mi: miles,
          duration_seconds: a.moving_time,
          avg_pace_seconds: null,
          elapsed_seconds: elapsed,
        }),
        avg_pace_seconds: miles > 0 ? Math.round(a.moving_time / miles) : null,
        elevation_gain_ft: a.total_elevation_gain
          ? Math.round(a.total_elevation_gain * FT_PER_M)
          : null,
        avg_heart_rate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        max_speed_mph: a.max_speed ? Math.round(a.max_speed * 2.23694 * 10) / 10 : null,
        strava_activity_id: a.id,
      };

      const { data: existingStrava } = await supabaseAdmin
        .from("runs")
        .select("id, type")
        .eq("strava_activity_id", a.id)
        .maybeSingle();

      if (existingStrava) {
        const existingType = String(existingStrava.type ?? "");
        const syncedType = label === "Race" || !existingType ? label : null;
        await supabaseAdmin.from("runs").update({ ...fields, ...(syncedType ? { type: syncedType } : {}) } as never).eq("id", existingStrava.id);
        continue;
      }

      // A manually pasted run for the same day and distance becomes the Strava run.
      const { data: sameDay } = await supabaseAdmin
        .from("runs")
        .select("id, distance_mi, strava_activity_id, type")
        .eq("date", date);
      const twin = (sameDay ?? []).find(
        (r: { distance_mi: number; strava_activity_id: number | null }) =>
          r.strava_activity_id == null && Math.abs(Number(r.distance_mi) - miles) <= 0.1,
      ) as { id: string; type?: string | null } | undefined;

      if (twin) {
        const syncedType = label === "Race" || !twin.type ? label : null;
        await supabaseAdmin.from("runs").update({ ...fields, ...(syncedType ? { type: syncedType } : {}) } as never).eq("id", twin.id);
        matched++;
      } else {
        await supabaseAdmin
          .from("runs")
          .insert({
            ...fields,
            user_id: SINGLE_USER_ID,
            type: label ?? "",
            source: "strava",
            notes: a.name ?? null,
          } as never);
        imported++;
      }

      await linkPlanDay(date, miles);
    }

    // Splits run after the runs are saved, newest first, capped for rate limits.
    if (options.includeSplits !== false) {
      await backfillSplits(token);
      await recomputeAllFlags();
      await confirmFlaggedSplits(token);
    }

    await saveConnection({ last_synced_at: new Date().toISOString(), last_error: null });
    return { status: "ok", imported, matched };
  } catch (err) {
    const kind = err instanceof Error ? err.message : "unreachable";
    await saveConnection({ last_error: kind });
    return { status: "error", message: kind };
  }
}

const TRACKED_EFFORTS = new Set(["1 mile", "5k", "10k"]);

/**
 * Per-mile splits and Strava's own best efforts for activities we have not
 * stored yet, newest first. Stops at MAX_DETAIL_CALLS so a long backlog
 * resumes on the next sync.
 */
async function backfillSplits(token: string) {
  const { data: rows } = await supabaseAdmin
    .from("runs")
    .select("id, strava_activity_id, date, duration_seconds, elapsed_seconds")
    .not("strava_activity_id", "is", null)
    .order("date", { ascending: false })
    .limit(400);

  const { data: done } = await supabaseAdmin
    .from("run_splits")
    .select("strava_activity_id, moving_seconds");
  const haveSplits = new Set(
    (done ?? []).map((r: { strava_activity_id: number }) => Number(r.strava_activity_id)),
  );
  // Splits stored before moving/elapsed time was kept are fetched again once.
  const haveDetailedSplits = new Set(
    (done ?? [])
      .filter((r: { moving_seconds: number | null }) => r.moving_seconds != null)
      .map((r: { strava_activity_id: number }) => Number(r.strava_activity_id)),
  );

  const { data: effortRows } = await supabaseAdmin
    .from("run_best_efforts")
    .select("strava_activity_id");
  const haveEfforts = new Set(
    (effortRows ?? []).map((r: { strava_activity_id: number }) => Number(r.strava_activity_id)),
  );

  let calls = 0;
  for (const row of rows ?? []) {
    const run = row as {
      id: string;
      strava_activity_id: number;
      duration_seconds: number;
      elapsed_seconds: number | null;
    };
    const id = Number(run.strava_activity_id);
    if (haveDetailedSplits.has(id) && haveEfforts.has(id) && run.elapsed_seconds != null) continue;
    if (calls >= MAX_DETAIL_CALLS) break;
    calls++;
    try {
      const detail = await api<{
        moving_time?: number;
        elapsed_time?: number;
        distance?: number;
        splits_standard?: {
          distance: number;
          moving_time: number;
          elapsed_time?: number;
          average_heartrate?: number;
        }[];
        best_efforts?: { name: string; distance: number; moving_time: number; elapsed_time: number }[];
      }>(`/activities/${id}?include_all_efforts=true`, token);

      if (detail.elapsed_time && run.elapsed_seconds == null) {
        const moving = detail.moving_time ?? run.duration_seconds;
        const stopped = detail.elapsed_time > moving ? detail.elapsed_time - moving : null;
        await supabaseAdmin
          .from("runs")
          .update({
            elapsed_seconds: detail.elapsed_time,
            stopped_seconds: stopped,
            clock_left_running: clockLeftRunning({
              distance_mi: 0,
              duration_seconds: moving,
              avg_pace_seconds: null,
              elapsed_seconds: detail.elapsed_time,
            }),
          } as never)
          .eq("id", run.id);
      }

      const splits = (detail.splits_standard ?? []).map((s, i) => ({
        user_id: SINGLE_USER_ID,
        strava_activity_id: id,
        mile_number: i + 1,
        pace_seconds: Math.round(s.moving_time),
        distance_mi: s.distance ? Math.round((s.distance / M_PER_MI) * 1000) / 1000 : null,
        moving_seconds: Math.round(s.moving_time),
        elapsed_seconds: s.elapsed_time != null ? Math.round(s.elapsed_time) : null,
        heart_rate: s.average_heartrate ? Math.round(s.average_heartrate) : null,
      }));
      if (splits.length && !(haveSplits.has(id) && haveDetailedSplits.has(id))) {
        await supabaseAdmin
          .from("run_splits")
          .upsert(splits as never, { onConflict: "strava_activity_id,mile_number" });
      }
      const efforts = (detail.best_efforts ?? [])
        .filter((e) => TRACKED_EFFORTS.has((e.name ?? "").trim().toLowerCase()))
        .map((e) => ({
          user_id: SINGLE_USER_ID,
          strava_activity_id: id,
          name: e.name.trim().toLowerCase(),
          distance_m: Math.round(e.distance),
          seconds: Math.round(e.moving_time ?? e.elapsed_time),
        }));
      if (efforts.length) {
        await supabaseAdmin
          .from("run_best_efforts")
          .upsert(efforts as never, { onConflict: "strava_activity_id,name" });
      }
    } catch (err) {
      if (err instanceof Error && err.message === "rate-limited") break;
      if (err instanceof Error && err.message === "revoked") throw err;
      // A single unreadable activity should not stop the sync.
    }
  }
}

async function linkPlanDay(date: string, miles: number) {
  const { data: day } = await supabaseAdmin
    .from("plan_days")
    .select("id, min_miles, max_miles")
    .eq("date", date)
    .maybeSingle();
  if (!day) return;
  const min = Number(day.min_miles ?? 0);
  const max = Number(day.max_miles ?? 0);
  const within = max > 0 ? miles >= min && miles <= max : true;
  await supabaseAdmin
    .from("plan_days")
    .update({ status: within ? "done" : "modified" } as never)
    .eq("id", day.id);
}

/* ---------- stops and suspect splits ---------- */

/** How many activities may have their GPS stream checked in one sync. */
const MAX_STREAM_CALLS = 20;

type StoredRun = {
  strava_activity_id: number;
  distance_mi: number;
  duration_seconds: number;
  avg_pace_seconds: number | null;
  elapsed_seconds: number | null;
};

async function loadRunsAndSplits() {
  const { data: runRows } = await supabaseAdmin
    .from("runs")
    .select("strava_activity_id, date, distance_mi, duration_seconds, avg_pace_seconds, elapsed_seconds, streams_checked_at")
    .not("strava_activity_id", "is", null)
    .order("date", { ascending: false })
    .limit(500);

  const { data: splitRows } = await supabaseAdmin
    .from("run_splits")
    .select("strava_activity_id, mile_number, pace_seconds, distance_mi, moving_seconds, elapsed_seconds, heart_rate, flag, flag_reason")
    .limit(10000);

  const byActivity = new Map<number, SplitRow[]>();
  for (const row of (splitRows ?? []) as unknown as SplitRow[]) {
    const id = Number(row.strava_activity_id);
    const list = byActivity.get(id) ?? [];
    list.push(row);
    byActivity.set(id, list);
  }
  return { runRows: (runRows ?? []) as unknown as (StoredRun & { date: string; streams_checked_at: string | null })[], byActivity };
}

/**
 * Recomputes and stores the flag on every split, so results do not shift
 * between syncs. Confirmed recording gaps are kept.
 */
export async function recomputeAllFlags() {
  const { runRows, byActivity } = await loadRunsAndSplits();
  const updates: Record<string, unknown>[] = [];

  for (const run of runRows) {
    const rows = byActivity.get(Number(run.strava_activity_id));
    if (!rows?.length) continue;
    const flagged = flagSplits(run, rows);
    for (const split of flagged) {
      const stored = rows.find((r) => r.mile_number === split.mile);
      if (!stored) continue;
      if ((stored.flag ?? null) === (split.flag ?? null) && (stored.flag_reason ?? null) === (split.reason ?? null)) {
        continue;
      }
      updates.push({
        user_id: SINGLE_USER_ID,
        strava_activity_id: stored.strava_activity_id,
        mile_number: stored.mile_number,
        pace_seconds: stored.pace_seconds,
        distance_mi: stored.distance_mi,
        moving_seconds: stored.moving_seconds,
        elapsed_seconds: stored.elapsed_seconds,
        heart_rate: stored.heart_rate,
        flag: split.flag,
        flag_reason: split.reason,
      });
    }
  }

  for (let i = 0; i < updates.length; i += 200) {
    await supabaseAdmin
      .from("run_splits")
      .upsert(updates.slice(i, i + 200) as never, { onConflict: "strava_activity_id,mile_number" });
  }
  return updates.length;
}

/**
 * Optional confirmation for flagged splits: one time+distance stream per
 * activity, newest first, never fetched twice. A gap of more than a minute
 * with no points relabels the split as a recording gap.
 */
async function confirmFlaggedSplits(token: string) {
  const { runRows, byActivity } = await loadRunsAndSplits();
  let calls = 0;

  for (const run of runRows) {
    if (run.streams_checked_at) continue;
    const id = Number(run.strava_activity_id);
    const rows = byActivity.get(id);
    if (!rows?.some((r) => r.flag === "too_slow" || r.flag === "too_fast")) continue;
    if (calls >= MAX_STREAM_CALLS) break;
    calls++;
    try {
      const stream = await api<{
        time?: { data: number[] };
        distance?: { data: number[] };
      }>(`/activities/${id}/streams?keys=time,distance&key_by_type=true`, token);
      const times = stream.time?.data ?? [];
      const metres = stream.distance?.data ?? [];

      const gapMiles = new Set<number>();
      for (let i = 1; i < times.length; i++) {
        if ((times[i] as number) - (times[i - 1] as number) > GAP_SECONDS) {
          const at = Number(metres[i - 1] ?? 0) / M_PER_MI;
          gapMiles.add(Math.floor(at) + 1);
        }
      }

      for (const row of rows) {
        if (row.flag !== "too_slow" && row.flag !== "too_fast") continue;
        if (!gapMiles.has(row.mile_number)) continue;
        await supabaseAdmin
          .from("run_splits")
          .update({
            flag: "gap",
            flag_reason: "no GPS points for over a minute — this mile's distance may be undercounted",
          } as never)
          .eq("strava_activity_id", id)
          .eq("mile_number", row.mile_number);
      }

      await supabaseAdmin
        .from("runs")
        .update({ streams_checked_at: new Date().toISOString() } as never)
        .eq("strava_activity_id", id);
    } catch (err) {
      if (err instanceof Error && err.message === "rate-limited") break;
      if (err instanceof Error && err.message === "revoked") throw err;
      // One unreadable stream should not stop the sync.
    }
  }
}
