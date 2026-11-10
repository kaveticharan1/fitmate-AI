package expo.modules.fitmatesteps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/**
 * FitMate's own step counter. Reads Android's hardware step counter
 * (TYPE_STEP_COUNTER): a low-power chip that counts every step since the phone
 * started, whether or not FitMate is open. No other app is involved.
 */
class FitmateStepsModule : Module() {
  private var watcher: SensorEventListener? = null

  private val sensorManager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private fun stepSensor(): Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

  /** Wall-clock time (ms) when the phone last started; the counter restarts from 0 then. */
  private fun bootTimeMs(): Double = (System.currentTimeMillis() - SystemClock.elapsedRealtime()).toDouble()

  override fun definition() = ModuleDefinition {
    Name("FitmateSteps")

    Events("onSteps")

    Function("isAvailable") {
      stepSensor() != null
    }

    // One reading of the running total. Resolves null if the sensor gives nothing in time.
    AsyncFunction("readTotal") { timeoutMs: Int, promise: Promise ->
      val manager = sensorManager
      val sensor = stepSensor()
      if (manager == null || sensor == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val done = AtomicBoolean(false)
      val handler = Handler(Looper.getMainLooper())
      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          if (done.compareAndSet(false, true)) {
            manager.unregisterListener(this)
            promise.resolve(mapOf("total" to event.values[0].toDouble(), "bootMs" to bootTimeMs()))
          }
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
      }
      handler.post {
        manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, 0)
      }
      handler.postDelayed({
        if (done.compareAndSet(false, true)) {
          manager.unregisterListener(listener)
          promise.resolve(null)
        }
      }, timeoutMs.toLong().coerceIn(500L, 20000L))
    }

    // Live updates while a screen is open: emits the running total on every step.
    Function("startWatching") {
      if (watcher != null) return@Function true
      val manager = sensorManager ?: return@Function false
      val sensor = stepSensor() ?: return@Function false
      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          sendEvent("onSteps", mapOf("total" to event.values[0].toDouble(), "bootMs" to bootTimeMs()))
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
      }
      watcher = listener
      Handler(Looper.getMainLooper()).post {
        manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
      }
      true
    }

    Function("stopWatching") {
      watcher?.let { sensorManager?.unregisterListener(it) }
      watcher = null
    }

    OnDestroy {
      watcher?.let { sensorManager?.unregisterListener(it) }
      watcher = null
    }
  }
}
