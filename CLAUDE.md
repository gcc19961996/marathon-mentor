# Marathon Training Companion

Personal, single-runner NYC Marathon dashboard: fixed weekly plan, run log, Strava sync,
mile-split pace analysis, race-day checklist, and a small AI coach. Originally built in
Lovable; now developed here and deployed to Vercel. Repo: github.com/gcc19961996/marathon-mentor.

## Stack
- TanStack Start (React 19, file routes in `src/routes`, server functions via `createServerFn`)
- Vite 8 through `@lovable.dev/vite-tanstack-config` (bundles the plugins; see the note in
  `vite.config.ts` before adding any). Nitro builds the server with the `vercel` preset.
- Tailwind 4 + shadcn/ui (`src/components/ui`), app components in `src/components/marathon`
- Supabase Postgres. The browser never talks to the database directly.
- AI coach: Gemini via Google's OpenAI-compatible endpoint (`src/lib/ai-gateway.server.ts`)

## Commands
Use **bun** for installs (the lockfile is `bun.lock`); scripts run on Node.
- `bun install` · `bun run dev` (http://localhost:8080) · `bun run build` · `bun run lint`
- Tests: `bun run test` (Vitest, `src/**/*.test.ts`; pure functions only, no database)
- Type check: `node node_modules/typescript/bin/tsc --noEmit`
- Apply migrations: `npx supabase db push --db-url "$SUPABASE_DB_URL"` (value from `.env.local`)
- Load a backup: `bun --env-file=.env.local scripts/import-backup.ts backups/<file>.json [--yes]`
  (empties all app tables first; without `--yes` it is a dry run)

## How it works
- **Access:** no accounts. `PasscodeGate` exchanges `APP_PASSCODE` (owner) or `VIEWER_PASSCODE`
  (read-only) for a signed 90-day device token sent as `x-app-token` (`src/lib/gate.server.ts`).
  Wrong passcodes are counted in the `unlock_throttle` table (5 misses in 15 min locks unlocking
  for 15 min); the owner deliberately keeps a simple one-word passcode.
- **Data:** all reads/writes go through `dbOp` in `src/lib/db.functions.ts` using the service-role
  client. Writes need the owner role, are range-validated (text max 500 chars unless listed in
  `TEXT_LIMITS`) and rate limited. Every row uses the
  fixed `SINGLE_USER_ID`. Runs are soft-deleted (`hidden = true`). React Query hooks live in
  `src/lib/data.ts`; `useDashboard` (`src/lib/dashboard.ts`) derives what the tabs show.
- **Schema:** `supabase/migrations` is the source of truth; `src/integrations/supabase/types.ts`
  mirrors it. Add a new migration file rather than editing old ones.
- **Strava:** OAuth + sync in `src/lib/strava.server.ts`. Redirect origin comes from `PUBLIC_ORIGIN`.
  Sync is triggered from the browser (`useStravaAutoSync`); there are no cron jobs.
- **AI coach:** `askCoach` in `src/lib/ai.functions.ts`, capped at 30 calls/day via `bump_ai_usage`.
- **Dates:** "today" is always New York (`isoDate()`/`nyToday()` in `training.ts`). Do date math on
  YYYY-MM-DD strings with `shiftISODate`/`mondayOfISO`, never `new Date(...).toISOString()` on
  local times.
- **Tabs:** Weekly Plan loads up front; Progress, Pace Analysis and Race Day are `React.lazy` in
  `Dashboard.tsx`. Pace Analysis sections fold on phones (`Fold` / `useFoldedOnPhone`).
- **Protected metrics:** the race-day split table, check-in scaling, plan matching and the
  training prediction are pinned by tests. The prediction (`predictFromTraining`) is Riegel from the
  best recent 10K/5K, multiplied by smooth endurance/volume factors (`enduranceFactor`, `volumeFactor`); it
  read 4:21:22 on 2026-09-30. Run log totals must not move unless a change intends it.

## Environment
Names are listed in `.env.example`. Local values live in `.env.local` (gitignored).
**Local dev currently points at the live database** — don't write test data locally until a
separate practice Supabase project is set up and `.env.local` points at it.

## Deploy
- Live site: https://marathon-mentor-nine.vercel.app (Vercel project `gc-1996/marathon-mentor`).
  Local folder is linked via `.vercel/project.json`.
- Deploy from this folder: `npx vercel deploy --prod --yes` (preview: omit `--prod`; preview URLs
  sit behind Vercel login). `.vercelignore` keeps `.env*` and `backups/` out of uploads.
- Vercel Hobby rejects CLI deploys unless the latest commit's author email is the Vercel account's
  email (gcc.crawford1@gmail.com).
- Env vars live in Vercel (`npx vercel env ls`). Production `PUBLIC_ORIGIN` is the live URL and must
  match Strava's Authorization Callback Domain (strava.com/settings/api). `SUPABASE_DB_URL` is
  local-only and is not stored in Vercel.

## Git
- `main` is the working branch. The code as downloaded from Lovable is tagged
  `pre-migration-snapshot`.
- Never commit `.env*` (except `.env.example`) or `backups/` (personal training data).
- Before every push, scan the diff for key-like strings (`sb_secret_`, `eyJ…`, `AIza…`,
  connection strings) and ask the owner if anything looks like a secret.
