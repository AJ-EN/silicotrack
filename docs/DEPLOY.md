# Deploying SilicoTrack

The app is a single Next.js application with one external dependency: a
Postgres database. There is no queue, no cache, no object store, no background
worker.

> **Before deploying, understand what you are publishing.** This is an
> unvalidated prototype running entirely on synthetic data. Every screen says
> so, and the landing page says it twice. Do not remove those notices to make a
> demo look better — the honesty is the point, and a government evaluator will
> check.

---

## 1. Provision a Postgres database

Any hosted Postgres works. Prisma Postgres is the least friction here because
the project is already on Prisma 7:

```bash
npx prisma init --db
```

That logs you into the Prisma Data Platform, creates a database, and writes the
connection string to `.env`.

For Prisma Client with the `pg` driver adapter, use the **direct TCP**
connection string, not the `prisma+postgres://` one:

```
postgres://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Neon, Supabase, Vercel Postgres and a plain managed Postgres are all equally
fine. Nothing in the application knows which one it is talking to.

## 2. Apply the schema

```bash
DATABASE_URL="<your production url>" npx prisma migrate deploy
```

`migrate deploy` applies committed migrations only and never generates new
ones — the correct command for a deployed environment.

## 3. Seed the synthetic cohort

The demo has nothing to show without it. All four screens read from the
database, so an unseeded deployment renders four empty pages.

```bash
DATABASE_URL="<your production url>" npm run seed
```

This writes ~500 synthetic workers, 16 camps, 61 referrals and their stage
histories. It is deterministic: the same cohort every time, so screenshots and
recorded demos stay consistent.

**The seed wipes before it writes.** Never point it at a database holding
anything you care about.

## 4. Deploy to Vercel

```bash
npx vercel
```

Set one environment variable in the Vercel project settings:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your direct TCP Postgres connection string |

Do **not** set `TEST_DATABASE_URL` in production. It exists only so `npm test`
has an isolated schema to truncate.

No custom build command is needed. `prisma generate` runs from the
`postinstall` script, which matters because `src/generated/prisma` is
gitignored — without it a fresh clone builds against a Prisma client that does
not exist and fails with `Module not found: Can't resolve
'../../generated/prisma/client'`. Verified by deleting the generated directory
and building from clean.

Neither `prisma generate` nor `next build` needs a reachable database, so the
build succeeds even before `DATABASE_URL` is set. It is only needed at
runtime.

---

## Verifying a deployment

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-APP/
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-APP/field
curl -s -o /dev/null -w "%{http_code}\n" "https://YOUR-APP/camp?district=Karauli"
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-APP/referral
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-APP/dashboard
```

All five should return `200`. Then open `/dashboard` and confirm the registry
reads 500 — if it reads 0, step 3 was skipped.

Round-trip the sync endpoint, which is the one write path:

```bash
curl -s -X POST https://YOUR-APP/api/sync \
  -H 'content-type: application/json' \
  -d '{"deviceId":"DEV-smoke","submissions":[{"workerId":"W-smoke-0001",
       "worker":{"name":"Smoke Test","age":44,"sex":"male","district":"Karauli",
       "block":"Todabhim","village":"Bharkholi","phone":null,
       "smokingStatus":"never","priorTB":false},
       "segments":[{"taskCode":"DRILL_DRY","material":"sandstone","method":"dry",
       "enclosure":"open","ppeUse":"none","siteType":"surface","startYear":2015,
       "endYear":null,"monthsPerYear":12,"hoursPerDay":8,"siteName":null}],
       "capturedAt":"2026-08-14T09:15:00Z","referenceDate":"2026-08-14",
       "createdBy":"ASHA-DEMO"}]}'
```

Expect `{"accepted":["W-smoke-0001"],"rejected":[]}`. Send it a second time —
it must return the same thing, because a field device on a bad link WILL
re-deliver, and a duplicate worker is a corrupted registry.

Remember to delete the smoke-test worker afterwards, or re-run the seed.

---

## Things that will bite

**Do not deploy on SQLite.** The project used to. Vercel's filesystem is
ephemeral and not shared between function invocations, so writes vanish and
`*.db` is gitignored anyway. This is why the project moved to Postgres.

**Connection limits.** Serverless functions open a pool per instance. The
client is cached on `globalThis` in development, but a busy deployment on a
small Postgres plan can still exhaust connections. If that happens, use a
pooled connection string — Prisma Postgres, Neon and Supabase all provide one.

**`/field` is static, everything else is dynamic.** `/camp`, `/referral` and
`/dashboard` are marked `force-dynamic` because they read live data. If you
ever see a dashboard frozen at build-time numbers, that directive was removed.

**The service worker caches the app shell.** After a deploy, a returning
visitor may hold the previous shell until the worker updates. Hard-reload when
verifying a fix. `/api/*` is never cached — serving a stale `200` for a sync
would silently drop a worker's record.
