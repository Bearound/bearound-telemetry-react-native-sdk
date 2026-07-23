import { NativeEventEmitter, NativeModules } from 'react-native';

const { BearoundTelemetry: Native } = NativeModules;

if (!Native) {
  throw new Error(
    '@bearound/telemetry-react-native-sdk: native module not linked. ' +
      'Android only — rebuild the app after installing the package.'
  );
}

const emitter = new NativeEventEmitter(Native);

/**
 * Bearound Telemetry — beacon-hardware telemetry (battery, temperature, movement,
 * firmware, signal) with NO location permission. Android only.
 * This SDK does not track people.
 */
const BearoundTelemetry = {
  /**
   * Configures the SDK. Resolves `true` when the companion handoff happened
   * (the Bearound tracking SDK is present and configured — credentials and
   * device id were taken from its instance); `false` on a standalone configure.
   *
   * @param {string} businessToken
   * @param {'high'|'medium'|'low'} [scanPrecision] Scan precision — controls the
   *   background radio duty and sync cadence. Foreground scanning is always
   *   LOW_LATENCY regardless. Default 'medium'.
   */
  configure(businessToken, scanPrecision) {
    return Native.configure(businessToken, scanPrecision ?? null);
  },

  /** Requests the "Nearby devices" permission on Android 12+ (never location). */
  requestPermissions() {
    return Native.requestPermissions();
  },

  /** Starts telemetry collection (foreground + background). */
  startScanning() {
    return Native.startScanning();
  },

  /** Stops telemetry collection. */
  stopScanning() {
    return Native.stopScanning();
  },

  /** Effective device id (tracking SDK's id after a companion handoff). */
  getDeviceId() {
    return Native.getDeviceId();
  },

  /**
   * Subscribes to live telemetry readings.
   * @param {(beacons: Array<object>) => void} callback
   * @returns {{ remove: () => void }} subscription
   */
  onBeacons(callback) {
    return emitter.addListener('bearoundTelemetry:beacons', callback);
  },
};

export default BearoundTelemetry;
