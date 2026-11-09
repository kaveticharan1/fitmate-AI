/**
 * Expo config plugin: signs release APKs with the FitMate release key.
 *
 * The key never lives in the repository. At build time Gradle reads:
 *   FITMATE_KEYSTORE_PATH, FITMATE_KEYSTORE_PASSWORD, FITMATE_KEY_ALIAS, FITMATE_KEY_PASSWORD
 * (CI writes the keystore from a GitHub secret). Without them the build falls
 * back to the debug key and the APK is marked as a test build.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// fitmate-release-signing';

function applySigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const releaseConfig = `
        release { ${MARKER}
            if (System.getenv('FITMATE_KEYSTORE_PATH')) {
                storeFile file(System.getenv('FITMATE_KEYSTORE_PATH'))
                storePassword System.getenv('FITMATE_KEYSTORE_PASSWORD')
                keyAlias System.getenv('FITMATE_KEY_ALIAS')
                keyPassword System.getenv('FITMATE_KEY_PASSWORD')
            }
        }`;

  const signingBlock = /signingConfigs\s*\{\s*\n(\s*)debug\s*\{[^}]*\}/;
  if (!signingBlock.test(gradle)) throw new Error('withReleaseSigning: signingConfigs block not found');
  gradle = gradle.replace(signingBlock, (m) => `${m}${releaseConfig}`);

  const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseType.test(gradle)) throw new Error('withReleaseSigning: release buildType not found');
  gradle = gradle.replace(
    releaseType,
    `$1signingConfig System.getenv('FITMATE_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`,
  );
  return gradle;
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents = applySigning(c.modResults.contents);
    return c;
  });

module.exports = withReleaseSigning;
module.exports.applySigning = applySigning;
