import type { EmitterSubscription } from 'react-native';

/** One telemetry reading from a Bearound beacon — hardware health only. */
export interface TelemetryBeacon {
  uuid: string;
  major: number;
  minor: number;
  /** Signal strength of the encounter, in dBm. */
  rssi: number;
  /** Epoch millis of the last sighting. */
  lastSeen: number;
  /** Battery reading advertised by the beacon (mV). */
  battery?: number;
  /** Temperature in °C from the beacon's onboard sensor. */
  temperature?: number;
  /** Accelerometer movement counter. */
  movements?: number;
  /** Beacon firmware version. */
  firmware?: string;
}

/** Scan precision — background radio duty + sync cadence. Foreground is always LOW_LATENCY. */
export type ScanPrecision = 'high' | 'medium' | 'low';

declare const BearoundTelemetry: {
  /**
   * Configures the SDK. Resolves `true` when the companion handoff happened
   * (Bearound tracking SDK present and configured); `false` on standalone.
   */
  configure(
    businessToken: string,
    scanPrecision?: ScanPrecision
  ): Promise<boolean>;
  /** Requests "Nearby devices" on Android 12+ (never location). */
  requestPermissions(): Promise<void>;
  startScanning(): Promise<void>;
  stopScanning(): Promise<void>;
  getDeviceId(): Promise<string>;
  onBeacons(
    callback: (beacons: TelemetryBeacon[]) => void
  ): EmitterSubscription;
};

export default BearoundTelemetry;
