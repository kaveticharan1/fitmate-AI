#!/usr/bin/env bash
# Installs the APK on the running emulator, opens it and fails if it crashes.
set -u
APK="$1"
PKG=com.kaveticharan.fitmate
adb install -r "$APK" || exit 1
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 30
adb logcat -d -b crash > crash.txt || true
if adb shell pidof "$PKG" >/dev/null && ! grep -q "FATAL EXCEPTION" crash.txt; then
  echo "App opened and is still running."
  adb logcat -d -s ReactNativeJS:V | tail -20
  exit 0
fi
echo "::error::FitMate crashed or closed at launch."
head -80 crash.txt
adb logcat -d -s ReactNativeJS:V AndroidRuntime:E | tail -60
exit 1
