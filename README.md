# FitMate AI

A personal AI fitness and nutrition coach for Android (iPhone later), built for Indian food habits, with English and Telugu from day one.

**Status:** Phase 1 (foundation) complete — see [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## What works today

- Welcome screen with plain-language privacy notice, 18+ check and consent (stored with the notice version).
- PIN-protected, **encrypted** on-phone database (SQLCipher AES-256). The database key is wrapped with your PIN and stored in the Android Keystore; optional fingerprint/face unlock.
- Auto-lock, wrong-PIN delays, optional auto-wipe, screenshot/screen-recording blocking.
- 5-step onboarding (about you, body, goal and routine, food, health and language) with validation; every optional question can be left empty.
- Dashboard: calorie target, maintenance, BMR, protein/carbs/fat, water, BMI (Indian cut-offs), weight progress, safety notices, daily weight logging.
- Profile editing, encrypted backup and restore (password-protected file you can save to Google Drive), readable data export, delete-all-data.
- Dark (default), light or follow-phone theme. App language English or Telugu.

## How it is built

| Part | Technology |
| --- | --- |
| App | React Native 0.88, Expo SDK 58, TypeScript, Expo Router |
| Data on phone | SQLite + SQLCipher via `expo-sqlite`, Drizzle ORM, versioned migrations |
| Forms and validation | React Hook Form + Zod (shared schemas in `packages/validation`) |
| Calculations | Pure TypeScript in `packages/core` (Mifflin-St Jeor BMR, safety floors) |
| Crypto | `@noble/ciphers` (AES-256-GCM), `@noble/hashes` (scrypt), Android Keystore via `expo-secure-store` |
| Tests | Vitest (packages), Jest + React Native Testing Library (app) |
| Builds | GitHub Actions → signed release APK |

```
fitmate-ai/
  apps/mobile/           Expo app (src/app = screens, src/db, src/security, src/features, src/i18n)
  packages/core/         Nutrition calculations + encrypted backup format
  packages/validation/   Zod schemas shared by the app and the future backend
  docs/                  Architecture, database, testing, setup, known issues
  .github/workflows/     CI: checks + APK build
```

## Quick start (developers)

```bash
npm install          # Node 22.5+ required (tests use node:sqlite)
npm run check        # type check + lint + all tests
cd apps/mobile && npx expo run:android   # needs Android Studio / SDK; Expo Go is NOT supported (no SQLCipher)
```

Installing on a phone without developer tools: see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## Documentation

- [Project documentation](docs/PROJECT_DOCUMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [API documentation](docs/API_DOCUMENTATION.md)
- [Development status](DEVELOPMENT_STATUS.md)
- [Testing report](docs/TESTING_REPORT.md)
- [Setup guide](docs/SETUP_GUIDE.md)
- [Known issues](docs/KNOWN_ISSUES.md)

## Health disclaimer

FitMate gives estimates from standard formulas. It is not a medical device and does not give medical advice. People who are pregnant, breastfeeding, have a medical condition or a history of eating disorders should follow their doctor's guidance; the app deliberately sets no calorie deficit in those cases.

## Credits

Telugu text uses Noto Sans Telugu (SIL Open Font License 1.1), bundled in `apps/mobile/assets/fonts`.
