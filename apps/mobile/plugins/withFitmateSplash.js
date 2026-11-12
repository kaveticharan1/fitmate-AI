/**
 * Expo config plugin: FitMate's own opening screen (no expo-splash-screen needed).
 *
 * - Android 12+: the system splash shows the FitMate ring-and-runner mark on the
 *   app's night background (values-v31 theme).
 * - Android 8–11: the window background is the same mark centred on that colour.
 * - Replaces the template's placeholder splashscreen_logo images.
 * After this the app shows its animated jogging loader (src/components/BootLoader.tsx).
 */
const fs = require('fs');
const path = require('path');
const { withAndroidColors, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const BG = '#0C0A1C';

function withSplashColors(config) {
  return withAndroidColors(config, (c) => {
    for (const name of ['splashscreen_background', 'activityBackground']) {
      c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name, value: BG });
    }
    return c;
  });
}

function withSplashFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const projectRoot = c.modRequest.projectRoot;
      const res = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      // Remove the template's placeholder bitmaps (they'd clash with the XML below).
      for (const dir of fs.readdirSync(res)) {
        const f = path.join(res, dir, 'splashscreen_logo.png');
        if (dir.startsWith('drawable') && fs.existsSync(f)) fs.unlinkSync(f);
      }
      const nodpi = path.join(res, 'drawable-nodpi');
      const xxxhdpi = path.join(res, 'drawable-xxxhdpi');
      const drawable = path.join(res, 'drawable');
      for (const d of [nodpi, xxxhdpi, drawable]) fs.mkdirSync(d, { recursive: true });
      fs.copyFileSync(path.join(projectRoot, 'assets/splash/splash-icon-android12.png'), path.join(nodpi, 'fitmate_splash_icon.png'));
      fs.copyFileSync(path.join(projectRoot, 'assets/splash/splash-logo.png'), path.join(xxxhdpi, 'fitmate_splash_logo.png'));
      fs.writeFileSync(
        path.join(drawable, 'splashscreen_logo.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item><bitmap android:gravity="center" android:src="@drawable/fitmate_splash_logo" /></item>
</layer-list>
`,
      );
      const v31 = path.join(res, 'values-v31');
      fs.mkdirSync(v31, { recursive: true });
      fs.writeFileSync(
        path.join(v31, 'fitmate_splash.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@color/splashscreen_background</item>
    <item name="android:windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/fitmate_splash_icon</item>
  </style>
</resources>
`,
      );
      return c;
    },
  ]);
}

module.exports = function withFitmateSplash(config) {
  return withSplashFiles(withSplashColors(config));
};
