package com.bearoundtelemetry

import android.Manifest
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.bearound.telemetry.BearoundTelemetrySDK
import io.bearound.telemetry.interfaces.BearoundTelemetrySDKListener
import io.bearound.telemetry.models.Beacon

/**
 * Bearound Telemetry — React Native module (Android only, classic module — works on
 * both architectures via interop).
 *
 * Thin bridge over the native Bearound Telemetry SDK: beacon-hardware telemetry
 * (battery, temperature, movement, firmware, signal) with NO location permission.
 *
 * Companion handoff is AUTOMATIC: when the Bearound tracking SDK is present in the
 * same app (e.g. via @bearound/react-native-sdk) and already configured, this module
 * hands its instance to the telemetry SDK reflectively — business token and device id
 * come from tracking, so both SDKs report as the same device.
 */
class BearoundTelemetryModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), BearoundTelemetrySDKListener {

    companion object {
        const val NAME = "BearoundTelemetry"
        private const val EVENT_BEACONS = "bearoundTelemetry:beacons"
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    private val sdk: BearoundTelemetrySDK by lazy {
        BearoundTelemetrySDK.getInstance(ctx.applicationContext)
    }

    override fun getName(): String = NAME

    // -------------------------------------------------------------------------
    // API
    // -------------------------------------------------------------------------

    // React method threads are NOT the main thread; the SDK registers process
    // lifecycle observers, which Android requires to happen on the main thread.
    private fun onMain(promise: Promise, code: String, block: () -> Any?) {
        mainHandler.post {
            try {
                promise.resolve(block())
            } catch (t: Throwable) {
                Log.w(NAME, "$code failed", t)
                promise.reject(code, t.message, t)
            }
        }
    }

    @ReactMethod
    fun configure(businessToken: String, promise: Promise) = onMain(promise, "configure_failed") {
        sdk.listener = this
        val tracking = trackingSdkInstanceOrNull()
        if (tracking != null) {
            // Companion: credentials + deviceId handoff from the tracking instance.
            sdk.configure(tracking)
        } else {
            sdk.configure(businessToken = businessToken)
        }
        tracking != null
    }

    @ReactMethod
    fun startScanning(promise: Promise) = onMain(promise, "start_failed") {
        sdk.startScanning()
        null
    }

    @ReactMethod
    fun stopScanning(promise: Promise) = onMain(promise, "stop_failed") {
        sdk.stopScanning()
        null
    }

    @ReactMethod
    fun getDeviceId(promise: Promise) {
        promise.resolve(sdk.deviceId)
    }

    /** Requests "Nearby devices" on Android 12+. No location permission exists here. */
    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val activity = ctx.currentActivity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && activity != null) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.BLUETOOTH_SCAN),
                7402
            )
        }
        promise.resolve(null)
    }

    // Required for NativeEventEmitter (no-op bookkeeping).
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Int) = Unit

    // -------------------------------------------------------------------------
    // BearoundTelemetrySDKListener → JS events
    // -------------------------------------------------------------------------

    override fun onBeaconsUpdated(beacons: List<Beacon>) {
        val array = Arguments.createArray()
        for (b in beacons) {
            val map = Arguments.createMap()
            map.putString("uuid", b.uuid.toString())
            map.putInt("major", b.major)
            map.putInt("minor", b.minor)
            map.putInt("rssi", b.rssi)
            map.putDouble("lastSeen", b.timestamp.time.toDouble())
            b.metadata?.let { m ->
                map.putInt("battery", m.batteryLevel)
                map.putInt("temperature", m.temperature)
                map.putInt("movements", m.movements)
                map.putString("firmware", m.firmwareVersion)
            }
            array.pushMap(map)
        }
        mainHandler.post {
            ctx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_BEACONS, array)
        }
    }

    // -------------------------------------------------------------------------

    /**
     * Reflective lookup of a CONFIGURED io.bearound.sdk.BeAroundSDK instance — no
     * compile-time dependency on the tracking SDK. Null when absent/unconfigured.
     */
    private fun trackingSdkInstanceOrNull(): Any? = try {
        val cls = Class.forName("io.bearound.sdk.BeAroundSDK")
        val instance = cls.getMethod("getInstance", Context::class.java)
            .invoke(null, ctx.applicationContext)
        val token = runCatching {
            cls.getMethod("getBusinessToken").invoke(instance) as? String
        }.getOrNull()
        if (token.isNullOrBlank()) null else instance
    } catch (_: Throwable) {
        null
    }
}
