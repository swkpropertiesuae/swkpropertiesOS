package ae.swk.one

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.location.*
import android.os.*
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import org.json.JSONObject
import java.time.Instant

fun Location.evidence(): JSONObject = JSONObject().put("lat", latitude).put("lng", longitude)
    .put("accuracy", accuracy.toDouble()).put("capturedAt", Instant.ofEpochMilli(time).toString())
    .put("mock", if (Build.VERSION.SDK_INT >= 31) isMock else isFromMockProvider)

/** User starts this while the Activity is visible. Never restarts after process death or reboot. */
class DutyService : Service(), LocationListener {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var api: Api
    private lateinit var manager: LocationManager
    private var session = 0
    private var deadline = 0L
    private var sending = false
    private var failures = 0
    override fun onCreate() {
        super.onCreate(); api = Api(this); manager = getSystemService(LocationManager::class.java)
        getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("duty", "Field duty location sharing", NotificationManager.IMPORTANCE_LOW))
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") {
            scope.launch { runCatching { api.obj("/api/mobile/field/$session/end", "POST") }; withContext(Dispatchers.Main) { stopSelf() } }
            manager.removeUpdates(this)
            return START_NOT_STICKY
        }
        session = intent?.getIntExtra("session", 0) ?: 0
        deadline = intent?.getLongExtra("deadline", 0) ?: 0
        if (session <= 0 || deadline <= System.currentTimeMillis() || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
        val stop = PendingIntent.getService(this, 2, Intent(this, DutyService::class.java).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(this, "duty").setSmallIcon(ae.swk.one.R.drawable.ic_swk).setContentTitle("SWK ONE · Field duty")
            .setContentText("Work location sharing is active. Tap Stop to end.").setOngoing(true).setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "Stop sharing", stop).build()).build()
        startForeground(71, notification)
        try {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 60_000L, 25f, this, Looper.getMainLooper())
            if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 60_000L, 25f, this, Looper.getMainLooper())
        } catch (_: Exception) { stopSelf(); return START_NOT_STICKY }
        scope.launch { delay((deadline - System.currentTimeMillis()).coerceAtLeast(0)); runCatching { api.obj("/api/mobile/field/$session/end", "POST") }; withContext(Dispatchers.Main) { stopSelf() } }
        return START_NOT_STICKY
    }
    override fun onLocationChanged(location: Location) {
        if (System.currentTimeMillis() >= deadline) { stopSelf(); return }
        if (sending || location.accuracy > 100 || SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos > 90_000_000_000L) return
        sending = true
        scope.launch {
            try { api.obj("/api/mobile/field/$session/point", "POST", location.evidence()); failures = 0 }
            catch (e: Exception) {
                failures++
                if (e is ApiException && e.status in listOf(400, 401, 403) || failures >= 5) withContext(Dispatchers.Main) { stopSelf() }
            } finally { sending = false }
        }
    }
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Android legacy callback") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onBind(intent: Intent?) = null
    override fun onDestroy() { manager.removeUpdates(this); scope.cancel(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy() }
}
