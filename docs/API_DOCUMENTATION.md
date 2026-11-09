# API documentation

Stage 1 has **no network API**: there is no FitMate server and the app makes no network requests in Phase 1. This page documents the internal module APIs other code builds on. The REST API arrives with the Stage 2 backend.

## @fitmate/core

| Function | Purpose |
| --- | --- |
| `calculateTargets(profile: BodyProfile): NutritionTargets` | BMI, BMR, maintenance, target kcal, protein/carbs/fat, water, weekly change, weeks to target, safety flags. Throws `RangeError` for invalid input or age under 18. |
| `calculateBmi(weightKg, heightCm)` | BMI to 1 decimal |
| `bmiCategoryAsian(bmi)` / `bmiCategoryWho(bmi)` | Category with Indian (23/25) or WHO (25/30) cut-offs |
| `calculateBmr(p)` | Mifflin-St Jeor, unrounded |
| `calculateWaterMl(weightKg)` | 35 ml/kg, rounded to 100 ml, 1.5–4 L |
| `ageFromDateOfBirth(iso, today?)` | Whole years, calendar-date based |
| `encryptJsonBackup(data, password, randomBytes, kdf?)` → `Uint8Array` | Encrypted `.fmbak` file |
| `decryptJsonBackup(bytes, password)` | Throws `BackupPasswordError` or `BackupFormatError` |

### Calculation rules

- Fat loss: deficit ≤ 20 % of maintenance (≤ 10 % with a disclosed medical condition).
- No deficit with pregnancy/breastfeeding, eating-disorder history, or BMI < 18.5.
- Target never below max(sex floor, BMR) — floors: men 1,500, women 1,200, unspecified 1,350 kcal — and never above maintenance when cutting.
- Muscle gain: surplus = min(10 % of maintenance, 300 kcal).
- Protein 1.6 g/kg (target weight for fat loss, current for muscle gain), 1.2 g/kg otherwise, capped at 35 % of calories. Fat 25 % of calories. Carbs = remainder.

## @fitmate/validation

Zod schemas: `aboutYouSchema`, `bodySchema`, `goalSchema`, `foodSchema`, `healthSchema`, `profileSchema`, `setPinSchema`, `backupPasswordSchema`, `consentSchema`, plus field helpers. Error messages are translation keys (`errors.*`). Numbers accept `72.5` and `72,5`; dates accept `DD-MM-YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`.

## App modules

| Module | Key functions |
| --- | --- |
| `security/vault.ts` | `createVault(pin)`, `unlockWithPin(pin)` → `PinResult`, `changePin`, `enableBiometricUnlock`, `unlockWithBiometric`, `getSecurityPrefs`/`setSecurityPrefs`, `destroyVault` |
| `db/client.ts` | `openEncryptedDatabase(keyHex)`, `getDb()`, `closeDatabase()`, `deleteDatabaseFile()` |
| `db/repositories.ts` | `getProfile`, `saveProfile`, `logWeight`, `recentWeights`, `recordConsent`, `hasActiveConsent`, `getSetting`/`setSetting` |
| `features/backup/backupService.ts` | `exportEncryptedBackup(password)`, `exportReadableCopy()`, `pickBackupFile()`, `restoreEncryptedBackup(bytes, password)` |
