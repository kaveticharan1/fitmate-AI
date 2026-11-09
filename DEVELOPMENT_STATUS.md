# Development status

_Last updated: 9 November 2026_

## Plan

Stage 1 (personal, ₹0, Android APK) in 7 phases, then optional Stage 2 (public launch). Full plan: the "FitMate AI — Implementation Plan" document.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: encrypted storage, app lock, consent, onboarding, calculations, dashboard, backup | **Done (v0.1.1), installed on device** |
| 2 | Nutrition: Indian food database, food diary, oil/family-pot logging, meal planner, grocery list | **Done (v0.2.0), automated tests passing; awaiting on-device test** |
| 3 | AI coach: chat, personalities, memory, Telugu, voice | Not started |
| 4 | Workouts: exercise library, plans, timers | Not started |
| 5 | Progress: weight/waist trends, water, sleep, habits, weekly reports | **Done (v0.4.0 + v0.5.0)**: weight/waist charts, water, sleep, habits with forgiving streaks, weekly/monthly report |
| 6 | Health: step counter, Activity Recognition, Health Connect, step validation | Not started |
| 7 | Advanced: food photos, kitchen assistant, barcode, notifications | Not started |

## Phase 1 report

### 1. Completed features
- Monorepo with npm workspaces: `apps/mobile`, `packages/core`, `packages/validation`.
- Encrypted SQLite database (SQLCipher); app refuses to run if encryption is missing (e.g. in Expo Go).
- Random 256-bit database key, wrapped with a scrypt-derived PIN key (AES-256-GCM) and stored in SecureStore (Android Keystore). Optional biometric unlock via a second Keystore-bound copy.
- Lock screen with custom PIN pad, wrong-PIN delays (30 s → 30 min), optional auto-wipe after 10 wrong PINs, auto-lock (immediately / 1 min / 5 min), screenshot blocking (on by default), Android auto-backup disabled.
- Welcome + privacy notice + 18+ check; consent records with notice version.
- 5-step onboarding wizard and profile editing (shared component), with Zod validation and translated error messages.
- Calculation engine: BMI (Asian-Indian and WHO categories), BMR, maintenance, target, macros, water, weekly change, weeks to target, safety flags.
- Dashboard with targets, macros, weight card with daily weight logging, BMI card, safety banners.
- Encrypted backup/restore (`.fmbak`, scrypt + AES-256-GCM), readable JSON export, delete all data.
- Dark/light/system theme; English and Telugu UI with bundled Noto Sans Telugu.
- CI workflow: checks + release APK build with signature verification.

### 2. Files created
See `git show --stat` for the first commit. Main areas: `packages/core/src/*`, `packages/validation/src/*`, `apps/mobile/src/{app,components,db,features,i18n,lib,security,theme}`, `apps/mobile/plugins/withReleaseSigning.js`, `.github/workflows/ci.yml`, docs.

### 3. Files modified
Expo template files: `apps/mobile/app.json`, `package.json`, `tsconfig.json` (template `App.tsx`/`index.ts` removed in favour of Expo Router).

### 4. Database changes
Migration v1: `profile`, `consents`, `weight_logs`, `body_measurements`, `app_settings`. See [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

### 5. APIs implemented
No network APIs (Stage 1 has no server). Internal module APIs: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

### 6. Tests executed
60 automated tests, all passing (25 core, 13 validation, 22 app). Details: [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md).

### 7. Bugs fixed during the phase
- Two React versions installed (19.3.0 and 19.3.1) broke hooks → pinned one version with npm `overrides`.
- Screens could unmount mid-setup when the session switched to "unlocked" → consent/biometric saving now runs before the switch (`setup(pin, beforeReady)`).
- Pregnancy answer could stay on after switching sex to male → reset automatically.
- Lint: impure `Date.now()` during render, ref written during render → fixed.

### 8. Remaining issues
See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md). Most important: not yet tested on a real phone; release key must be added to GitHub secrets; Telugu needs native review.

### 9. Environment variables
None for the app. CI secrets for signing: `FITMATE_KEYSTORE_BASE64`, `FITMATE_KEYSTORE_PASSWORD`, `FITMATE_KEY_ALIAS`, `FITMATE_KEY_PASSWORD`.

### 10. Setup and run commands
See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

### 11. Next phase
Phase 2 — Nutrition (Indian food database from IFCT 2017, food diary, oil adjustment, family pot mode, one-tap logging, meal planner, grocery list).

## Phase 2 report (v0.2.0)

### 1. Completed features
- `@fitmate/food-data`: 133 foods (Indian-first: rice, idli, dosa, pesarattu, pappu, sambar, curries, biryani, eggs, dairy, fruits, snacks, raw staples) with per-100 g nutrition, household measures (piece, katori, cup, glass, tbsp, ladle…), Telugu names and Roman-Telugu aliases, diet and allergen tags, typical cooking oil, raw-ingredient breakdown.
- Search in English, Telugu script and Roman Telugu (e.g. "annam", "kodi kura", "majjiga").
- Food diary: date navigation, 4 meals, eaten/left calories, protein/carbs/fat bars against targets, add/edit/remove, "same as yesterday", favourites, recent and popular foods.
- Portion screen: unit picker, quantity stepper, less/normal/more oil, live nutrition.
- Home (family-pot) recipes: raw ingredients + servings (+ optional cooked weight) → log your share by servings or grams.
- Meal plan (7 days): rule-based, respects diet type, allergies, dislikes, budget and cooking time; portions scaled to the calorie target; protein top-ups; swap a meal; "I ate this" logs it.
- Grocery list for 7 days: raw amounts grouped by aisle, tick-off, share as text (WhatsApp etc.).
- Home screen "Today" card with eaten vs target.

### 2–3. Files
New: `packages/food-data/*`, `apps/mobile/src/db/foodRepo.ts`, `src/features/food/*`, screens `(tabs)/food.tsx`, `(tabs)/plan.tsx`, `food/{add,item,recipes,recipe-edit,grocery}.tsx`, tests `src/__tests__/food.test.tsx`, `src/lib/time.test.ts`. Modified: schema, migrations, i18n, dashboard, tabs, root layout.

### 4. Database changes
Migration v2: `food_log_entries`, `favourite_foods`, `recipes`, `recipe_ingredients` (cascade delete), `meal_plan_choices`. All included in backups.

### 6. Tests
102 automated tests passing (34 app, 25 core, 30 food data, 13 validation) — see TESTING_REPORT.md.

### 11. Next phase
Phase 3 — AI coach (chat, personalities, Telugu, voice) — or in-app water/medicine reminders first, as discussed.

## Reminders (v0.3.0, pulled forward from Phase 7)
- Water reminders (from/until hour, every 1 or 2 hours) and medicine reminders (name + time), as local daily notifications: offline, nothing leaves the phone.
- Android channel with lock-screen text hidden; settings stored in `app_settings` (`reminders.v1`), no migration needed.
- FitMate never suggests medicine doses; it only reminds at the user's times.
- Tests: schedule building and time parsing (4 new tests; 38 app tests total). Not yet tested on a phone.

## Phase 5, part 1 (v0.4.0)
- Progress tab: weight chart (daily dots, 7-day average line, target line) over 30 days / 3 months / 1 year, weekly rate from a least-squares trend (shown only after a week of data); waist chart with logging; last-7-days food summary (only logged days count — missing is not zero).
- Home: water counter (+1 glass of 250 ml, undo) toward the daily water target.
- DB migration v3: `water_logs` (included in backups).
- `@fitmate/core/trends`: rolling average, weekly rate, week summary (6 new tests). App tests: 43.
- Not yet tested on a phone.

## Phase 5, part 2 (v0.5.0)
- Sleep log (bedtime/wake time, crosses midnight; one entry per morning, re-saving updates it) with 7-night average.
- Custom daily habits with forgiving streaks (one missed day is forgiven, two in a row end the streak).
- Report screen (last 7 or 30 days): weight change (period average vs previous period), food days, average calories/protein vs targets, average water and sleep, habit completion %.
- DB migration v4: `sleep_logs`, `habit_definitions`, `habit_logs` (cascade delete; in backups).
- Tests: 126 passing (46 app, 37 core, 30 food data, 13 validation). Not yet tested on a phone.
- Body measurements card: waist, hip, chest and upper arm (any combination), with change over the selected period. DB migration v5 adds `chest_cm`, `arm_cm`.
