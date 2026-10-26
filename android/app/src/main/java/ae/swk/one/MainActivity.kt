package ae.swk.one

import android.app.KeyguardManager
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.*
import android.os.*
import android.view.WindowManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.time.Instant

class MainActivity : FragmentActivity() {
    private val model: WorkspaceModel by viewModels()
    private var afterLocation: (() -> Unit)? = null
    private var currentListener: LocationListener? = null
    private var backgrounded = false
    private var locked by androidx.compose.runtime.mutableStateOf(false)
    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true) afterLocation?.invoke()
        else model.error("Precise location permission is required for this action. You can still use other workspaces.")
        afterLocation = null
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent { SwkApp(model, locked, ::unlock, ::clock, ::startDuty, ::stopDuty) }
    }
    override fun onStop() { super.onStop(); backgrounded = true }
    override fun onStart() {
        super.onStart()
        if ((backgrounded || model.api.vault.get("session") != null) && model.api.vault.get("biometric") == "true") locked = true
        backgrounded = false
    }
    private val deviceUnlock = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) locked = false
    }
    private fun unlock() {
        if (Build.VERSION.SDK_INT < 30) {
            val keyguard = getSystemService(KeyguardManager::class.java)
            @Suppress("DEPRECATION")
            val intent = keyguard.createConfirmDeviceCredentialIntent("Unlock SWK ONE", "Access your company workspace")
            if (intent != null) deviceUnlock.launch(intent) else model.error("Set a device PIN or password first. You can sign out to use your account password.")
            return
        }
        if (BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL) != BiometricManager.BIOMETRIC_SUCCESS) {
            model.error("Device unlock is unavailable. Sign out and sign in using your password."); return
        }
        BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { locked = false }
        }).authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Unlock SWK ONE").setSubtitle("Access your company workspace")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL).build())
    }
    private fun withLocation(block: () -> Unit) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) block()
        else { afterLocation = block; permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }
    }
    private fun clock(action: String) = withLocation {
        val manager = getSystemService(LocationManager::class.java)
        if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) { model.error("Enable phone location, then try again."); return@withLocation }
        currentListener?.let { manager.removeUpdates(it) }
        model.notice("Acquiring a fresh GPS fix…")
        var finished = false
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (finished) return
                finished = true; manager.removeUpdates(this); currentListener = null
                model.action {
                    model.api.obj("/api/mobile/attendance", "POST", location.evidence().put("action", action))
                    model.refreshHome(); model.notice(if (action == "in") "Office proximity check-in recorded" else "Checked out")
                }
            }
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
            @Deprecated("Android legacy callback") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        currentListener = listener
        try { manager.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper()) }
        catch (_: SecurityException) { model.error("Location permission was removed") }
        Handler(Looper.getMainLooper()).postDelayed({ if (!finished) { finished = true; manager.removeUpdates(listener); currentListener = null; model.error("Could not obtain a GPS fix. Move to a clearer area and retry.") } }, 30_000)
    }
    private fun startDuty(id: Int, end: String) = withLocation {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            // Notification permission is requested before beginning; duty remains an explicit second tap.
            registerNotification.launch(Manifest.permission.POST_NOTIFICATIONS); return@withLocation
        }
        model.action {
            val deadline = DutyWindow.endMillis(end)
            model.api.obj("/api/mobile/field/$id/start", "POST")
            try { ContextCompat.startForegroundService(this, Intent(this, DutyService::class.java).putExtra("session", id).putExtra("deadline", deadline)) }
            catch (e: Exception) { runCatching { model.api.obj("/api/mobile/field/$id/end", "POST") }; throw e }
            model.refreshHome(); model.notice("Field duty started. Stop sharing from the notification at any time.")
        }
    }
    private val registerNotification = registerForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        if (allowed) model.notice("Notifications enabled. Tap Start sharing to begin duty.") else model.error("Enable notifications to keep field sharing visible.")
    }
    private fun stopDuty(id: Int) {
        stopService(Intent(this, DutyService::class.java))
        model.recordAction("/api/mobile/field/$id/end")
    }
    override fun onDestroy() { currentListener?.let { getSystemService(LocationManager::class.java).removeUpdates(it) }; super.onDestroy() }
}
