import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  disconnectStrava,
  getStravaAuthUrl,
  getStravaStatus,
  runStravaSync,
} from "./strava.functions";

const LAST_SYNC_KEY = "strava-last-auto-sync";
const FIFTEEN_MIN = 15 * 60 * 1000;

export function useStravaStatus() {
  const status = useServerFn(getStravaStatus);
  return useQuery({ queryKey: ["strava-status"], queryFn: () => status() });
}

export function useStravaSync() {
  const qc = useQueryClient();
  const sync = useServerFn(runStravaSync);
  return useMutation({
    mutationFn: () => sync(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["plan-days"] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["strava-status"] });
      qc.invalidateQueries({ queryKey: ["run-splits"] });
    },
  });
}

export function useStravaConnect() {
  const authUrl = useServerFn(getStravaAuthUrl);
  return useMutation({
    mutationFn: async () => {
      const { url } = await authUrl();
      // Strava blocks framing, so approval always opens in a full browser tab.
      if (window.top && window.top !== window.self) window.open(url, "_blank");
      else window.location.href = url;
    },
  });
}

export function useStravaDisconnect() {
  const qc = useQueryClient();
  const disconnect = useServerFn(disconnectStrava);
  return useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strava-status"] }),
  });
}

/** Syncs once when the app opens, at most every 15 minutes. */
export function useStravaAutoSync(connected: boolean | undefined) {
  const sync = useStravaSync();
  const done = useRef(false);
  useEffect(() => {
    if (!connected || done.current) return;
    const last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
    if (Date.now() - last < FIFTEEN_MIN) return;
    done.current = true;
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    sync.mutate();
  }, [connected]);
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
