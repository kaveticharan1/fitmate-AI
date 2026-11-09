# Project documentation

## Product

FitMate AI is a personal fitness and nutrition coach. It learns a person's body measurements, goals, food habits and routine, and gives safe, practical guidance focused on Indian food, in English and Telugu (more languages later). It works fully without a smartwatch.

## Stages

- **Stage 1 — Personal (current):** Android APK, all data encrypted on the phone, no server, ₹0 running cost. Built for anyone, used first by the owner and friends.
- **Stage 2 — Public launch (optional, later):** backend for AI requests, accounts, encrypted cloud backup/sync, iPhone, app stores.

## Principles

1. **Safety first.** Calorie targets come from tested formulas with hard floors; no deficits for pregnancy, eating-disorder history or underweight; gentler deficits with medical conditions; never diagnoses.
2. **Privacy by default.** Encrypted database, PIN/biometric lock, no analytics or tracking, no Android auto-backup, user-controlled encrypted backups, export and delete at any time.
3. **Honest estimates.** All numbers are labelled as estimates; uncertainty is shown, not hidden.
4. **No guilt.** Strict coaching is direct but never insulting; missed days are never punished with starvation or extra exercise.
5. **Real features only.** Every button does something; unbuilt features are not shown as controls.

## Users and roles

Single user per phone. No accounts or roles in Stage 1.

## Screens (Phase 1)

| Screen | Purpose |
| --- | --- |
| Welcome | App language, privacy notice, 18+ and consent |
| Create PIN | PIN (4–8 digits, weak PINs rejected), optional biometrics |
| Lock | Custom PIN pad, biometric button, wrong-PIN delays |
| Onboarding (5 steps) | About you · Body · Goal and routine · Food · Health and language |
| Home (dashboard) | Calorie target, macros, water, weight progress and logging, BMI, safety notices |
| You | Edit profile, security, backup, privacy, appearance, app language, lock now |
| Security | Biometrics, auto-lock time, screenshot blocking, auto-wipe, change PIN |
| Backup and restore | Encrypted backup to any app (Drive, Files), restore from file |
| Privacy and data | Notice, readable export, delete everything |
| Appearance | Dark / light / follow phone |

## Glossary

- **BMR** — energy used at complete rest (Mifflin-St Jeor equation).
- **Maintenance** — BMR × activity factor; calories that keep weight stable.
- **Deficit** — eating below maintenance to lose fat.
- **SQLCipher** — encrypted version of SQLite.
- **Keystore** — Android's hardware-backed key storage.
