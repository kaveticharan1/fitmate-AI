# Setup guide

## A. Install FitMate on an Android phone (no developer tools needed)

1. **One-time: add the signing key to GitHub** (section C). Do this before installing the first APK you intend to keep, otherwise later updates won't install over it.
2. On the phone, open **https://github.com/kaveticharan1/fitmate-AI/releases/latest/download/FitMate.apk** — it always downloads the newest signed version. (Test builds without the signing key are not published there; they appear only under Actions → Artifacts.)
3. If you downloaded on a computer instead, copy the .apk to the phone.
4. Tap the file. Android asks to allow installs from that app (Files/Chrome) → **Allow** → **Install**.
5. Open FitMate → choose language → accept the notice → create a PIN → onboarding.

**Updates:** download the new APK and install it over the old one. Your data stays (as long as every APK is signed with the same release key).

**Xiaomi / Redmi / Poco (HyperOS/MIUI):** if installation is blocked, Settings → Apps → Manage apps → (your file manager or browser) → enable *Install unknown apps*. If the phone shows a "risky app" scan, choose to install anyway — the app is unsigned by Google Play, not harmful.

**Android 10–13 phones** work the same way. Android 9 and older are not supported.

## B. Developer setup

```bash
git clone https://github.com/kaveticharan1/fitmate-ai
cd fitmate-ai
npm install                 # Node 22.5 or newer
npm run check               # type check, lint, 60 tests
```

Run on a device or emulator (requires Android Studio + SDK, JDK 17):

```bash
cd apps/mobile
npx expo run:android        # builds a development build with SQLCipher
```

Expo Go **cannot** run FitMate: it has no SQLCipher, and the app deliberately refuses to store data unencrypted.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript in all packages |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | Vitest + Jest in all packages |
| `cd apps/mobile && npx expo export --platform android` | Bundle check without Android SDK |
| `cd apps/mobile && npx expo prebuild --platform android` | Generate `android/` (not committed) |

## C. Release signing key (GitHub secrets)

All APKs must be signed with the same key. The key is **never** stored in the repository.

GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Name | Value |
| --- | --- |
| `FITMATE_KEYSTORE_BASE64` | base64 of `fitmate-release.keystore` |
| `FITMATE_KEYSTORE_PASSWORD` | keystore password |
| `FITMATE_KEY_ALIAS` | `fitmate` |
| `FITMATE_KEY_PASSWORD` | key password (same as keystore password) |

Without these, CI still builds, but names the APK `…-TEST-BUILD-debug-signed.apk`. Test builds cannot be updated by properly signed builds; uninstall them first (after making a backup).

Keep `fitmate-release.keystore` and its password in a password manager plus an offline copy. Losing them means future updates can't install over the existing app.

To create a new key (only if starting over):

```bash
keytool -genkeypair -storetype PKCS12 -keystore fitmate-release.keystore -alias fitmate \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 fitmate-release.keystore > fitmate-release.keystore.base64.txt
```

## D. Environment variables

None needed by the app in Phase 1. From Phase 3 the AI key is entered inside the app and stored in the Keystore, not in files.
