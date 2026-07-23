# Bearound Telemetry — React Native SDK

React Native wrapper for the [Bearound Telemetry Android SDK](https://github.com/Bearound/bearound-telemetry-android-sdk) — beacon-**hardware** telemetry (battery, temperature, movement, firmware version, signal) using Bluetooth scanning with `neverForLocation`.

> **IMPORTANT — no tracking.** This SDK does not track people. It requires **no location permission** and produces no positioning data. It collects exclusively the health telemetry advertised by Bearound beacons. For presence/positioning, use the main [`@bearound/react-native-sdk`](https://github.com/Bearound/bearound-react-native-sdk) — both can (and should) run side by side.

**Android only.** On iOS the telemetry fields already travel through the main Bearound SDK.

## Architecture

Two SDKs, one integration:

| | `@bearound/react-native-sdk` (tracking) | `@bearound/telemetry-react-native-sdk` (this) |
|---|---|---|
| Purpose | Presence & positioning | Beacon hardware health |
| Permissions | Location + Bluetooth | Bluetooth only (`neverForLocation`) |
| Works without location permission | No | **Yes** |

When both are installed, `configure()` performs an automatic **companion handoff**: the telemetry SDK reuses the tracking SDK's business token and device id, so both report as the same device. If the user denies location, tracking stops — telemetry keeps working.

## Installation

```sh
npm install @bearound/telemetry-react-native-sdk
# or
yarn add @bearound/telemetry-react-native-sdk
```

The Android native SDK is resolved from JitPack. Add JitPack to `android/build.gradle` if your project doesn't have it yet:

```groovy
allprojects {
    repositories {
        maven { url 'https://jitpack.io' }
    }
}
```

Requires `minSdkVersion 26`.

## Usage

```js
import BearoundTelemetry from '@bearound/telemetry-react-native-sdk';

// If the Bearound tracking SDK is installed and configured, the token is
// taken from it automatically (companion handoff) — resolves true.
const companion = await BearoundTelemetry.configure('YOUR_BUSINESS_TOKEN');

await BearoundTelemetry.requestPermissions(); // "Nearby devices" on Android 12+
await BearoundTelemetry.startScanning();

const subscription = BearoundTelemetry.onBeacons((beacons) => {
  for (const b of beacons) {
    console.log(b.minor, b.battery, b.temperature, b.movements, b.firmware);
  }
});

// later
subscription.remove();
await BearoundTelemetry.stopScanning();
```

### With the Bearound tracking SDK (recommended)

```js
import { configure, startScanning } from '@bearound/react-native-sdk';
import BearoundTelemetry from '@bearound/telemetry-react-native-sdk';

await configure({ businessToken: TOKEN });
await startScanning();

await BearoundTelemetry.configure(TOKEN); // handoff: same device id, same token
await BearoundTelemetry.startScanning();
```

## API

| Method | Returns | Notes |
|---|---|---|
| `configure(businessToken)` | `Promise<boolean>` | `true` = companion handoff happened |
| `requestPermissions()` | `Promise<void>` | `BLUETOOTH_SCAN` on Android 12+ |
| `startScanning()` | `Promise<void>` | Foreground + background collection |
| `stopScanning()` | `Promise<void>` | |
| `getDeviceId()` | `Promise<string>` | Tracking SDK's id after handoff |
| `onBeacons(cb)` | `EmitterSubscription` | Live `TelemetryBeacon[]` readings |

`TelemetryBeacon`: `{ uuid, major, minor, rssi, lastSeen, battery?, temperature?, movements?, firmware? }`.

## License

MIT © Bearound
