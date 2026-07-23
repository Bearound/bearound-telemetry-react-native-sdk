# Changelog

## 0.2.0

* Native SDK `v0.1.3` → `v0.2.0`: continuous scan architecture (one hardware-managed registration per precision, no scan-start-quota starvation), foreground always LOW_LATENCY, weak-receiver SoC compensation, zombie-scan self-heal. Bench realme C61: 7-10× more readings, max gaps from ~60s down to 10-14s.
* `configure(businessToken, scanPrecision?)` — `'high'`/`'medium'`/`'low'` prices the background radio duty and sync cadence.
* Example: detection log tab (detailed + per-minute observed counts, FG/BG and frame filters), beacon pinning, ghost-beacon fix (list now mirrors SDK emissions).

## 0.1.0

* Initial release: React Native wrapper for the Bearound Telemetry Android SDK. Beacon-hardware telemetry only (no tracking, no location permission), automatic companion handoff, classic native module with main-thread dispatch, example app.
