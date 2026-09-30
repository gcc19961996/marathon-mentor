// Writes a backup of every app table (the same JSON shape as Settings >
// Download backup) from the database named in the env file. Read-only.
//
//   bun --env-file=.env.production.local scripts/export-backup.ts   # live
//   bun --env-file=.env.local scripts/export-backup.ts              # practice
//
// Pair with import-backup.ts to refresh the practice database from live.
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Same list as TABLES in src/lib/db.functions.ts.
const TABLES = [
  "profile",
  "target_times",
  "runs",
  "run_splits",
  "run_best_efforts",
  "daily_checkins",
  "milestones",
  "questions",
  "cross_training",
  "checklist_items",
  "plan_changes",
  "plan_days",
  "plan_weeks",
] as const;

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key || url.includes("FILL_IN")) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the env file.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables: Record<string, unknown[]> = {};
for (const t of TABLES) {
  const { data, error } = await db.from(t).select("*").limit(20000);
  if (error) {
    // A table the source database doesn't have yet is exported as empty.
    console.log(`  ${t.padEnd(18)} skipped (${error.message})`);
    tables[t] = [];
    continue;
  }
  tables[t] = data ?? [];
  console.log(`  ${t.padEnd(18)} ${tables[t].length} rows`);
}

const exportedAt = new Date().toISOString();
mkdirSync("backups", { recursive: true });
const file = `backups/marathon-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ exportedAt, tables }, null, 2));
console.log(`\nSaved ${file} from ${new URL(url).host}`);
