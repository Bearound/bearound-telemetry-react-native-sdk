# Bearound Telemetry — React Native example

Sample app for [`@bearound/telemetry-react-native-sdk`](../README.md). Shows exclusively beacon-hardware telemetry (battery, temperature, movement, firmware, signal) — no tracking, no location permission.

Android only.

## Run

```sh
npm install
# point android/local.properties sdk.dir at your Android SDK, then:
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

Or with Metro for development: `npm run android`.

The app requests only **Nearby devices** (`BLUETOOTH_SCAN`, `neverForLocation`) on Android 12+, then streams live telemetry cards for every Bearound beacon in range. When the Bearound tracking SDK is installed in the same app, the collection card shows "Modo companion (handoff do rastreio)".
