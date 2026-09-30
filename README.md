# Marathon Mentor

A personal NYC Marathon training dashboard: a fixed seven-week plan, daily check-ins, a run log
synced from Strava, mile-split pace analysis, race-day splits and a small AI coach.

Live at https://marathon-mentor-nine.vercel.app (passcode protected).

## Run it locally

Requires Node.js 22+ and [Bun](https://bun.sh) (used for installs; the lockfile is `bun.lock`).

```sh
bun install
cp .env.example .env.local   # then fill in the values
bun run dev                  # http://localhost:8080
```

## Useful commands

| Command                    | What it does                                         |
| -------------------------- | ---------------------------------------------------- |
| `bun run dev`              | Start the local dev server                           |
| `bun run build`            | Production build (Vercel output in `.vercel/output`) |
| `bun run test`             | Run the unit tests for the training rules            |
| `bun run lint`             | ESLint + Prettier checks                             |
| `npx vercel deploy --prod` | Deploy to the live site                              |

See [CLAUDE.md](CLAUDE.md) for how the app is put together, the database, and deployment.

## Built with

TanStack Start (React 19), Vite, Tailwind CSS, Supabase (Postgres), Gemini, the Strava API, and
Vercel. Originally prototyped in Lovable.
