# Testing report

_Run on 9 November 2026, Node 22, in the development workspace._

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Type check (all packages) | `npm run typecheck` | Pass, 0 errors |
| Lint (app) | `npm run lint` | Pass, 0 errors, 0 warnings |
| Core tests | `npm test -w @fitmate/core` | 25 / 25 pass |
| Validation tests | `npm test -w @fitmate/validation` | 13 / 13 pass |
| App tests | `npm test -w @fitmate/mobile` | 22 / 22 pass |
| Android JS bundle | `npx expo export --platform android` | Pass (4.8 MB Hermes bytecode) |
| Native project generation | `npx expo prebuild --platform android` | Pass; verified `expo.sqlite.useSQLCipher=true` and `android:allowBackup="false"` |
| Release APK build | GitHub Actions `android` job | Configured; first run happens on the first push |
| On-device testing | Poco X5 (Android 14), flagship phone | **Not yet done** |

**Total automated tests: 60, all passing.**

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

## Not yet tested (needs a real phone)

SQLCipher encryption on device, Keystore/biometric prompts, auto-lock timing, screenshot blocking, backup share sheet and file picker, Telugu font rendering, small/large screens and font scaling, performance of scrypt on mid-range phones (expected ~1–2 s for backups).

## Bugs found by testing and fixed

| Bug | Found by | Fix |
| --- | --- | --- |
| Duplicate React (19.3.0 + 19.3.1) → "Cannot read properties of null (reading 'useState')" | Screen tests | npm `overrides` pins React 19.3.0 |
| `Date.now()` called during render | Lint (React Compiler rules) | Lazy `useState` initialiser |
| Ref updated during render | Lint | Moved to an effect |
| Jest mock factory read a constant before it was initialised | Screen tests | Getter in the `expo-router` mock |
