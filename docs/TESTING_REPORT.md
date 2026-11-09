# Testing report

_Last run: 10 November 2026 (Phase 7d, v1.0.0), Node 22, in the development workspace and on GitHub Actions._

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Type check (all packages) | `npm run typecheck` | Pass, 0 errors |
| Lint (app) | `npm run lint` | Pass, 0 errors, 0 warnings |
| Core tests | `npm test -w @fitmate/core` | 43 / 43 pass |
| Food data tests | `npm test -w @fitmate/food-data` | 42 / 42 pass |
| Validation tests | `npm test -w @fitmate/validation` | 13 / 13 pass |
| Workout tests | `npm test -w @fitmate/workouts` | 12 / 12 pass |
| Coach tests | `npm test -w @fitmate/coach` | 19 / 19 pass |
| App tests | `npm test -w @fitmate/mobile` | 139 / 139 pass |
| Android JS bundle | `npx expo export --platform android` | Pass (5.7 MB Hermes bytecode) |
| Native project generation | `npx expo prebuild --platform android` | Pass; verified `expo.sqlite.useSQLCipher=true`, `android:allowBackup="false"`, `RECORD_AUDIO`, the speech-recognition service query, the Health Connect read permissions, rationale intent and permission-usage alias, minSdk 26, and CAMERA |
| Release APK build | GitHub Actions `android` job | Pass; signed with the release key (verified) |
| On-device testing | Poco X5 (Android 14) | v0.1.x installed by the owner; Phase 2 not yet tried on device |

**Total automated tests: 268, all passing.**

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

### Phase 3 (AI coach and voice)
- `@fitmate/coach`:
  - The prompt includes the useful facts and none of the identifying ones, with eating-disorder, pregnancy and injury rules; it hides calorie numbers for eating-disorder history.
  - Memory tags and history trimming.
  - Crisis and emergency detection (English and Telugu), with no false alarms on gym talk; Markdown removal.
  - Model choice (stable Flash over Lite, preview and image models).
  - The key is sent in a header, not the URL.
  - Error mapping (bad key, quota, busy, offline, timeout, blocked, empty).
- Coach service:
  - Context leaves out the name, date of birth and health notes.
  - The request contains the conversation and summary; the reply is saved and remembered facts are stored.
  - Crisis messages are flagged; nothing is sent without both consent and a key.
  - The key is stored only after Google accepts it, and consent is recorded and withdrawn.
- Screens:
  - Setup prompt, suggestions, sending, plain-text replies, helpline call buttons, error and retry, unanswered message.
  - Voice: Telugu recognition into the box (never auto-sent); unavailable and denied cases; read-aloud in the coach language.
  - Settings: agreement before the key field, a hidden key field, failure reasons, memory and turning the coach off.
- Migration v7 columns match the Drizzle schema.

### Phase 6 (steps and Health Connect)
- Core: step goals, the km and kcal estimates, validation (normal walking and running accepted; impossible cadence, bursts and huge days flagged), reading daily groups, averages over days with data.
- Sync (Health Connect mocked):
  - Daily totals and the 30-day window.
  - Flags on recent records.
  - Weight import: latest per day, skipping days already logged and FitMate's own data.
  - Sleep import: naps skipped.
  - Import switches and permissions.
  - Off, throttled, unavailable and not-allowed states.
  - Connect turns syncing on only if steps are allowed.
- SQL on real SQLite:
  - A typed-in day survives a sync.
  - Imported sleep never replaces a logged night.
  - Impossible step values are rejected.
- Screens:
  - Steps card: connect, typing in with validation, synced view with km/kcal/warning/"synced x min ago", back to the synced value.
  - Week card: averages and days at goal.
  - Settings: availability states, connect and denial, sync result, switches, goal validation, stop syncing.

### Central agent and Face & Skin (v1.1.0)
- Coach actions: validation rejects unknown types, out-of-range values and malformed tags; at most 3 per reply; nothing runs without Confirm.
- Safety: emergency phrases (incl. curly apostrophes, Telugu) flagged; everyday phrases ("end my workout", "breathe during squats") not flagged.
- Face check-in: rating required; optional answers stay null (never treated as 0); emergency card for lip/tongue/throat swelling or breathing; doctor note for pain.
- Photo encryption: round-trip, wrong key, tampered file and foreign file all rejected; large images encode safely.
- Skin routine: every skin type × experience × pregnancy combination — sunscreen always in the morning, ≤1 active for beginners, no retinoid in pregnancy, no clashing actives in the same slot.
- Ingredient checker: empty / messy / 500-item lists; allergy synonyms (fragrance ↔ parfum); pregnancy warnings; compare two; name-only input asks for the list.
- Coach knowledge retrieval only triggers on skin questions (not on "coconut oil for cooking" or "get toned").
- Translations: every key used in code exists in English and Telugu.

## Not yet tested (needs a real phone)

Phase 7: barcode scanning with the real camera; smart reminder timing on a real phone (Android battery savers can delay notifications); food-photo estimates with a real Gemini key, and how good they are for Indian thalis.


Phase 6: Health Connect permission screen and real data on the Poco X5 (whether HyperOS has native phone step counting, or a source app like Google Fit or Mi Fitness is needed), and sync speed with 30 days of data.



Phase 3: a real Gemini key and real replies (the development workspace can't reach Google), the free-tier limits in practice, the Telugu quality of replies, Android speech recognition in Telugu (needs the Google app and the Telugu language pack), and the microphone permission prompt.



Phase 4: text-to-speech voices (Telugu voice availability varies by phone), screen staying awake during a workout, 6 tabs fitting on small screens.


Phase 2 screens on a phone, SQLCipher encryption on device, Keystore/biometric prompts, auto-lock timing, screenshot blocking, backup share sheet and file picker, Telugu font rendering, small/large screens and font scaling, performance of scrypt on mid-range phones (expected ~1–2 s for backups).

## Bugs found by testing and fixed

| Bug | Found by | Fix |
| --- | --- | --- |
| Duplicate React (19.3.0 + 19.3.1) → "Cannot read properties of null (reading 'useState')" | Screen tests | npm `overrides` pins React 19.3.0 |
| `Date.now()` called during render | Lint (React Compiler rules) | Lazy `useState` initialiser |
| Ref updated during render | Lint | Moved to an effect |
| Jest mock factory read a constant before it was initialised | Screen tests | Getter in the `expo-router` mock |
| "Same as yesterday" would have failed for a food-photo entry (new database rule) | Code review while adding v9 | Copies keep the 'photo' type |
| Rest timer showed one extra second right after a set | Workout screen test | Clock refreshed on every workout action |
| "How to end my workout" was flagged as a crisis message | Coach safety test | Narrowed the pattern to "end it all" / "end my life" |

### Bugs found in the v1.1.0 test pass and fixed
- Skin keywords were too broad: "oil", "red", "tone", "dry" made the coach attach skincare notes to food and workout questions. Now matched as skin phrases only.
- An allergy to "fragrance" did not flag "Parfum" (same thing, different label name). Allergy words now cover known synonyms.
- If the AI marked a photo unusable without naming a reason, the message showed empty brackets. Now a plain retake message is shown.
