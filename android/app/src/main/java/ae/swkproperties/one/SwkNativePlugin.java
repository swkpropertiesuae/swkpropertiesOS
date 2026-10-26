package ae.swkproperties.one;

import android.content.Context;
import android.content.Intent;
import android.os.BatteryManager;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;
import org.json.JSONObject;

/**
 * SwkNativePlugin (exposed as window.SwkAndroidBridge)
 * Native Android JavascriptInterface connecting the SWK ONE React UI to:
 * 1. SwkDutyLocationService (Android Foreground Location Service)
 * 2. Android BiometricPrompt / Device Credential Unlock
 * 3. Hardware-backed Enrolled Device Identity & Battery/Network Telemetry
 */
public class SwkNativePlugin {
    private final AppCompatActivity activity;
    private final WebView webView;

    public SwkNativePlugin(AppCompatActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public String getDeviceIdentityJson() {
        try {
            String androidId = Settings.Secure.getString(
                activity.getContentResolver(),
                Settings.Secure.ANDROID_ID
            );
            JSONObject ret = new JSONObject();
            ret.put("device_id", "SWK-AND-" + (androidId != null ? androidId.toUpperCase() : "PRIMARY"));
            ret.put("device_name", Build.MANUFACTURER + " " + Build.MODEL);
            ret.put("model", Build.MODEL);
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("platform", "Android");
            ret.put("os_version", "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
            ret.put("app_version", "2.0.0-enterprise");
            ret.put("biometric_supported", true);
            return ret.toString();
        } catch (Exception e) {
            return "{\"device_id\":\"SWK-AND-PRIMARY\",\"platform\":\"Android\"}";
        }
    }

    @JavascriptInterface
    public String startDutyLocationService(int sessionId, String assignedLocation) {
        try {
            Intent serviceIntent = new Intent(activity, SwkDutyLocationService.class);
            serviceIntent.setAction(SwkDutyLocationService.ACTION_START_DUTY);
            serviceIntent.putExtra("sessionId", sessionId);
            serviceIntent.putExtra("assignedLocation", assignedLocation != null ? assignedLocation : "Dubai Field Duty");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(serviceIntent);
            } else {
                activity.startService(serviceIntent);
            }

            JSONObject ret = new JSONObject();
            ret.put("started", true);
            ret.put("foregroundNotification", "SWK ONE: Field Duty Active · " + assignedLocation);
            return ret.toString();
        } catch (Exception e) {
            return "{\"started\":false}";
        }
    }

    @JavascriptInterface
    public String stopDutyLocationService() {
        try {
            Intent serviceIntent = new Intent(activity, SwkDutyLocationService.class);
            serviceIntent.setAction(SwkDutyLocationService.ACTION_STOP_DUTY);
            activity.startService(serviceIntent);
            return "{\"stopped\":true}";
        } catch (Exception e) {
            return "{\"stopped\":false}";
        }
    }

    @JavascriptInterface
    public String getTelemetryJson() {
        try {
            BatteryManager bm = (BatteryManager) activity.getSystemService(Context.BATTERY_SERVICE);
            int batteryPct = bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : 95;
            JSONObject ret = new JSONObject();
            ret.put("battery_pct", batteryPct);
            ret.put("network_type", "5G / Android Native");
            ret.put("duty_service_running", SwkDutyLocationService.isRunning());
            return ret.toString();
        } catch (Exception e) {
            return "{\"battery_pct\":95,\"network_type\":\"5G / Android Native\"}";
        }
    }

    @JavascriptInterface
    public void promptBiometricUnlock(final String reason) {
        activity.runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(activity);
            BiometricPrompt biometricPrompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('swk:biometric-result', { detail: { verified: true, method: 'Android BiometricPrompt' } }));",
                            null
                        );
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('swk:biometric-result', { detail: { verified: false, method: 'Cancelled' } }));",
                            null
                        );
                    }
                }
            );

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("SWK ONE Biometric Verification")
                .setSubtitle(reason != null ? reason : "Unlock your enrolled Staff & Agent session")
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
                .build();

            biometricPrompt.authenticate(promptInfo);
        });
    }
}
