# Testing report

_Last run: 9 November 2026 (Phase 4), Node 22, in the development workspace and on GitHub Actions._

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Type check (all packages) | `npm run typecheck` | Pass, 0 errors |
| Lint (app) | `npm run lint` | Pass, 0 errors, 0 warnings |
| Core tests | `npm test -w @fitmate/core` | 37 / 37 pass |
| Food data tests | `npm test -w @fitmate/food-data` | 30 / 30 pass |
| Validation tests | `npm test -w @fitmate/validation` | 13 / 13 pass |
| Workout tests | `npm test -w @fitmate/workouts` | 12 / 12 pass |
| App tests | `npm test -w @fitmate/mobile` | 56 / 56 pass |
| Android JS bundle | `npx expo export --platform android` | Pass (5.4 MB Hermes bytecode) |
| Native project generation | `npx expo prebuild --platform android` | Pass; verified `expo.sqlite.useSQLCipher=true` and `android:allowBackup="false"` |
| Release APK build | GitHub Actions `android` job | Pass; signed with the release key (verified) |
| On-device testing | Poco X5 (Android 14) | v0.1.x installed by the owner; Phase 2 not yet tried on device |

**Total automated tests: 148, all passing.**

## What the tests cover

### packages/core (25)
- BMI values and both category systems; BMR for male, female and unspecified.
- Hand-checked target for a sedentary 30-year-old man (175 cm, 85 kg): BMR floor applied → 1,800 kcal, 120 g protein, −0.33 kg/week, 31 weeks to 75 kg.
- Full 20 % deficit when above the floor; floors never broken across several profiles; macros add up to the target.
- Safeguards: pregnancy, eating-disorder history, medical condition, underweight BMI, target below healthy BMI.
- Muscle-gain surplus cap; maintenance protein; rejection of minors and impossible values.
- Water target; age from date of birth incl. leap day and invalid dates.
- Backups: round trip with Telugu text, no plaintext in the file, fresh salt/nonce, wrong password, tampered body or header, non-backup files, short passwords.

### packages/validation (13)
- Date formats, adult check, impossible dates; comma decimals; required/number/min/max messages; list splitting; full profile; pregnancy flag for men rejected; PIN format, weak PINs, mismatches; backup password length; consent.

### apps/mobile (22)
- Key wrapping: random keys, right/wrong PIN, tampering, malformed keys; wrong-PIN delay schedule.
- Migrations on real SQLite (`node:sqlite`): fresh migrate, idempotent re-run, columns identical to Drizzle schema, CHECK constraints, refusal of newer databases, full rollback of a failing migration.
- Backup snapshot/restore on real SQLite: Telugu and JSON columns, replace-not-merge, unknown/unsafe column names ignored, invalid backup leaves data untouched, wrong app/newer version rejected.
- Screens (React Native Testing Library): consent required on Welcome; Telugu switch; full onboarding wizard with per-step validation (missing fields, minor, non-number, out of range) and correctly parsed output; dashboard targets and safety banners; weight entry validation; lock screen minimum length and wait-time message.

### packages/food-data (30)
- Data integrity for all 133 foods: unique ids, calories consistent with protein/carbs/fat (4/4/9 rule within 15 %), sane values, oil ≤ fat, all ingredient and template links valid, allergens inherited from ingredients.
- Search in English, Telugu script and Roman Telugu; cooked dishes ranked above raw ingredients.
- Household measures, oil adjustment (only the oil part changes), rejection of negative amounts, readable quantities.
- Family-pot recipes: totals, per serving, per 100 g, share by servings or grams.
- Allergy words (English/Telugu/Hindi) and dislikes.
- Planner: within 15 % of 1,400/1,800/2,400 kcal targets, deterministic, swaps, vegan/vegetarian/eggetarian respected for a week, allergies and dislikes never suggested for 14 days, budget and quick-meal rules, protein top-up, whole pieces only.
- Grocery list: raw conversion, shop-order grouping, weekly totals and friendly units.

### apps/mobile additions (Phase 2)
- Migration v2: upgrade from v1 keeps data, cascade delete, entry must reference a food or recipe.
- Screens: search → portion screen with live kcal, oil choice and save; plan with swap and "I ate this"; grocery tick-off; recipe editor validation, preview and save; dashboard "Today" card.
- Date arithmetic across months, years and leap days.

### Phase 4 (workouts)
- `@fitmate/workouts`: unique ids, easier alternatives exist, are no harder and never loop; every workout uses known exercises; equipment/preference filters; injury text (English and Telugu) → joints; knee-safe swaps; weekday suggestions; calorie and time estimates; the session state machine (sets, rests, skips, ending early, ignoring wrong-phase actions).
- Screens: tab filters, week summary and resume card; detail swaps exercises for knee pain and starts a session; full session run with rest, easier swap and save; rest and timed-set countdowns finishing on their own; nothing saved when ended before any set; voice cues only when switched on.
- Migration v6 columns match the Drizzle schema.

## Not yet tested (needs a real phone)

Phase 4: text-to-speech voices (Telugu voice availability varies by phone), screen staying awake during a workout, 6 tabs fitting on small screens.


Phase 2 screens on a phone, SQLCipher encryption on device, Keystore/biometric prompts, auto-lock timing, screenshot blocking, backup share sheet and file picker, Telugu font rendering, small/large screens and font scaling, performance of scrypt on mid-range phones (expected ~1–2 s for backups).

## Bugs found by testing and fixed

| Bug | Found by | Fix |
| --- | --- | --- |
| Duplicate React (19.3.0 + 19.3.1) → "Cannot read properties of null (reading 'useState')" | Screen tests | npm `overrides` pins React 19.3.0 |
| `Date.now()` called during render | Lint (React Compiler rules) | Lazy `useState` initialiser |
| Ref updated during render | Lint | Moved to an effect |
| Jest mock factory read a constant before it was initialised | Screen tests | Getter in the `expo-router` mock |
| Rest timer showed one extra second right after a set | Workout screen test | Clock refreshed on every workout action |
