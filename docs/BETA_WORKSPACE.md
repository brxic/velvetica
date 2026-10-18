# Beta workspace: delivered scope and verification

This document records the account and route-library changes tested on 17 October 2026. Later frontend and PWA changes are covered in [FRONTEND_SYSTEM.md](./FRONTEND_SYSTEM.md) and [PWA_RELIABILITY.md](./PWA_RELIABILITY.md). The supplied logos, Foundry fonts and brand colours remain unchanged.

## Account and routes

- Account defaults: bike profile, round-trip distance, average speed, surface, climbing and road preference. Defaults apply to the next plan; average speed changes the displayed estimated riding time.
- Home is set or replaced from the planner and removable from account settings.
- Saving uses optimistic version checks and a transaction lock. Stale writes return `409 VERSION_CONFLICT`; the rider can retain changes as a new copy. Earlier versions remain immutable; restoring creates a new version.
- Library filters: profile, maximum distance, favorite, text search and sorting.
- Sharing is explicitly enabled for an owned, saved route. The unlisted link grants read/GPX access, including start and destination. It is not password protected. Account preferences and saved home are not returned. Creating another link invalidates the previous one. Revocation and route deletion invalidate the link. Shared pages are marked noindex and no-referrer.
- Account JSON export includes settings, saved routes, deleted-route records and version history. Account deletion requires a current password and typing `DELETE`, then deletes owned routes, shares, versions, preferences, Auth sessions and the Auth user in one database transaction. Other accounts are preserved.
- Authentication uses server-verified `getUser` for account API access. This rejects tokens for deleted users.
- Failed deletes preserve the route. Failed saves remain local and show a visible notice. A version conflict never silently overwrites the server.

## Database rollout

`supabase/migrations/20261016235933_account_workspace.sql` adds the defaults JSON column and the private share-token table. It is forward-only and preserves existing homes and routes. The current application's schema initializer also creates these additions on first database use, matching the existing runtime setup. Prefer applying the migration through the normal release process before deploying.

No extra service-role key is needed: the existing server-only Postgres connection handles export/deletion and route ownership. Never expose `DATABASE_URL` to the browser.

## Reproducible checks

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:integration
npm run build
```

On Windows with Google Chrome installed, `$env:PLAYWRIGHT_CHANNEL='chrome'` can select it instead of the downloaded Chromium binary. The UI tests use a separate port (3025), synthetic routes and a fake Supabase Auth contract; they cannot create real accounts, send email or write to production. The registration, login, logout, reset and profile UI flows are covered on desktop and mobile. Actual email delivery and device/browser-specific email callbacks still need a staging acceptance pass.

`test:integration` requires a working Docker engine. It starts a separate in-memory PostGIS instance on loopback port 54328, tests real SQL ownership, concurrent updates, history, share revocation, settings and deletion using synthetic accounts, then runs `pg_dump`/`pg_restore` into a second disposable database. It compares complete table checksums and verifies nonempty PostGIS route data. The QA containers are removed afterwards. Production URLs are explicitly rejected by these scripts.

`integration/supabase-preflight.sql` is a transactional alternative smoke test. It verifies additive schema compatibility, version guards, geometry preservation in a logical table backup/restore and soft-deleted share visibility, then rolls everything back. It does not replace a full `pg_dump`/`pg_restore` drill.

## Routing reference corpus

`test-fixtures/routing-reference-cases.json` contains twelve concrete Swiss planning cases covering Basel/Aargau, Jura, Alpine areas and urban trips, across all four profiles. The deterministic regression test validates geometry/schema invariants. These are not claims of road suitability: use the same inputs against the real routing provider and review legal cycling access, tunnels and road/gravel suitability before broad publication. Existing round-trip tests also reject distant excursions, repeated segments, open loops and invalid coordinates.

The FOSSGIS health check now makes a real nearest-road request (cached for 60 seconds), rather than returning `up` just because the provider is configured. The public FOSSGIS bicycle router does not expose independent road/gravel costing profiles; production profile differentiation needs the existing Valhalla adapter or another provider with that capability.

FOSSGIS round trips now compare the total quality score (distance, repeated edges and radial excursions), try one additional direction when necessary, and reject extreme excursions rather than displaying them. No route segments are straightened or clipped off the road network.

## Dependency health

Next.js, MapLibre and Vitest were updated to corrected versions. MapLibre 6's ESM worker and shared module are copied from the installed package during `predev`/`prebuild`, preserving its license and avoiding a broken worker path under Turbopack. Generated vendor files and test reports are excluded from Git and lint.

The remaining npm advisory chain concerns the development-only `braces` dependency used by Next's ESLint plugin. Do not use `npm audit fix --force`: npm proposes downgrading the Next ESLint configuration across major versions. Production dependencies pass `npm audit --omit=dev`.

The Supabase advisor also reports that [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled in the project's Auth configuration. This account setting was not changed as part of the code implementation.

## Verification record, 17 October 2026

- 61 unit, component and API tests pass.
- 16 Playwright browser checks pass across desktop and mobile, using synthetic provider contracts where indicated above.
- TypeScript, ESLint and production build pass.
- Production npm dependency audit: zero reported vulnerabilities.
- Supabase transactional preflight passes. A follow-up read confirms schema, share table and synthetic route were all rolled back.
- After Docker was restarted, all six real PostGIS integration tests passed: guest claiming, account isolation and cross-device reads, concurrent-version conflicts, immutable history/restoration, preferences/home, sharing/revocation, exports, soft deletion, and account/session deletion.
- Full `pg_dump`/`pg_restore` passed in the isolated local QA instance. Checksums match across all six application/auth tables, and nonempty PostGIS route geometry and version history were restored. The disposable container and network were removed afterwards; production data was not involved.
- Migration is prepared in the repository; no production deployment or persistent production database changes were made.
