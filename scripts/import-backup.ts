// Loads a backup made with Settings > Download backup into the database named
// in .env.local. Every app table is emptied first, then refilled with the
// backup's rows exactly as exported (same ids, same timestamps).
//
//   bun --env-file=.env.local scripts/import-backup.ts backups/marathon-backup-YYYY-MM-DD.json
//   bun --env-file=.env.local scripts/import-backup.ts backups/marathon-backup-YYYY-MM-DD.json --yes
//
// Without --yes it only reports what it would do.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Same list as TABLES in src/lib/db.functions.ts (what exportAllData writes).
const TABLES = [
  "profile",
  "target_times",
  "runs",
  "run_splits",
  "run_best_efforts",
  "weekly_plans",
  "daily_checkins",
  "milestones",
  "questions",
  "cross_training",
  "checklist_items",
  "plan_changes",
  "plan_days",
  "plan_weeks",
] as const;

const BATCH = 500;

type Backup = { exportedAt: string; tables: Record<string, Record<string, unknown>[]> };

const file = process.argv[2];
const confirmed = process.argv.includes("--yes");
if (!file) {
  console.error("Usage: bun --env-file=.env.local scripts/import-backup.ts <backup.json> [--yes]");
  process.exit(1);
}

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key || url.includes("FILL_IN") || key.includes("FILL_IN")) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}
if (url.includes("rbojbxptqrlwyqlrlyns")) {
  console.error(
    "Refusing to import into the Lovable database. Point .env.local at the new project.",
  );
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8")) as Backup;
const missing = TABLES.filter((t) => !Array.isArray(backup.tables[t]));
if (missing.length) {
  console.error(`Backup is missing tables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Backup exported ${backup.exportedAt}`);
console.log(`Target database ${new URL(url).host}`);
for (const t of TABLES) console.log(`  ${t.padEnd(18)} ${backup.tables[t]!.length} rows`);

if (!confirmed) {
  console.log(
    "\nDry run only. Re-run with --yes to replace the database contents with this backup.",
  );
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

for (const t of TABLES) {
  const { error } = await db.from(t).delete().not("id", "is", null);
  if (error) throw new Error(`Emptying ${t} failed: ${error.message}`);
}

for (const t of TABLES) {
  const rows = backup.tables[t]!;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db.from(t).insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Loading ${t} failed: ${error.message}`);
  }
}

let mismatches = 0;
console.log("\nRow counts (database / backup):");
for (const t of TABLES) {
  const { count, error } = await db.from(t).select("id", { count: "exact", head: true });
  if (error) throw new Error(`Counting ${t} failed: ${error.message}`);
  const expected = backup.tables[t]!.length;
  const ok = count === expected;
  if (!ok) mismatches++;
  console.log(`  ${ok ? "ok " : "BAD"} ${t.padEnd(18)} ${count} / ${expected}`);
}

if (mismatches) {
  console.error(`\n${mismatches} table(s) do not match the backup.`);
  process.exit(1);
}
console.log("\nImport complete. Every table matches the backup.");
