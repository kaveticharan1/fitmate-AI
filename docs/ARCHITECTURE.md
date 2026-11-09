# Architecture

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | **Local-first, no server in Stage 1** | Zero running cost, works offline, health data never leaves the phone. Every table has a UUID and timestamps so cloud sync can be added later. |
| 2 | **Expo + React Native (Android first)** | One TypeScript codebase for Android and, later, iPhone; development builds allow native modules (SQLCipher, Keystore, sensors). |
| 3 | **SQLite + SQLCipher instead of PostgreSQL** | One user per phone; SQLite is built for on-device storage. PostgreSQL/Redis/FastAPI are deferred to Stage 2. |
| 4 | **Pure packages for logic** | `packages/core` (calculations, backup crypto) and `packages/validation` (Zod) have no React Native dependencies, so they are fast to test and can be reused by a future backend. |
| 5 | **Numbers come from code, never from AI** | Calorie and macro targets are computed by tested functions; the future AI coach will only explain them. |
| 6 | **Expo Router protected routes** | Screens are only reachable in the right state (setup → onboarding → app), enforced by the router, not by individual screens. |
| 7 | **Lock = unmount** | When locked, the database is closed, React Query's cache is cleared and every screen unmounts, so no health data remains in memory. |
| 8 | **Native projects are generated** | `android/` is produced by `expo prebuild` (not committed). Native settings live in `app.json` and config plugins. |

## App flow

```
Launch ─▶ no vault? ─▶ Welcome (language, notice, 18+) ─▶ Create PIN ─▶ (biometric?) ─▶ Onboarding ─▶ Dashboard
       └▶ vault exists ─▶ Lock screen ─▶ (PIN or biometric) ─▶ Dashboard
App in background longer than the auto-lock time ─▶ database closed, cache cleared ─▶ Lock screen
```

## Encryption design

```
PIN ──scrypt(N=2^14, r=8, p=1, salt)──▶ PIN key ──AES-256-GCM──▶ unwraps ──▶ DB key (32 random bytes)
                                                                                 │
SecureStore (Android Keystore-encrypted):                                        ▼
  fm.vault.wrapped.v1  = {salt, nonce, wrapped key}            SQLCipher: PRAGMA key = "x'<DB key>'"
  fm.vault.bio.v1      = DB key, released only after biometric check (optional)
  fm.vault.failures.v1 = wrong-PIN counter and lock-out time
```

- A wrong PIN fails GCM authentication; no PIN hash is stored.
- The app checks `PRAGMA cipher_version` and refuses to open a database without SQLCipher.
- Android auto-backup is off (`allowBackup=false`), so neither the database nor the Keystore-wrapped secrets are copied off the phone by the system.
- Backups: JSON snapshot → scrypt(N=2^15) + AES-256-GCM with the backup password; the header (salt, nonce, KDF parameters) is authenticated as associated data.

## Module map (apps/mobile/src)

| Folder | Contents |
| --- | --- |
| `app/` | Screens (Expo Router). `_layout.tsx` holds providers and route guards. |
| `security/` | `vault.ts` (keys, PIN, biometrics), `keyWrap.ts` (pure crypto), `SessionProvider.tsx` (lock state, auto-lock, screenshot blocking), `LockScreen.tsx` |
| `db/` | `client.ts` (encrypted open, migrations), `schema.ts` (Drizzle), `migrations.ts` (SQL), `repositories.ts` (queries) |
| `features/profile/` | Wizard, React Query hooks, target calculation adapter |
| `features/backup/` | Snapshot/restore (pure) and file/share service |
| `components/` | Design-system components (text, buttons, fields, choices, PIN pad) |
| `i18n/` | English and Telugu strings |
| `theme/` | Colour tokens (dark default), theme provider |

## Stage 2 additions (not built)

FastAPI backend (AI proxy, accounts, end-to-end-encrypted sync), PostgreSQL, Redis, iPhone build, Play Store/App Store. The local schema and validation package are designed to carry over unchanged.
