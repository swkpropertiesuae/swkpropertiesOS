package ae.swkproperties.one;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Foreground service for SWK ONE field-duty location sharing.
 *
 * - Runs only between an explicit "start duty" from the app and "end duty" (app button, notification action,
 *   server rejecting the session, or the session expiring). No background-location permission is requested.
 * - Collects fixes natively (so sharing keeps working with the screen off or the app in the background) and posts
 *   them in batches to /api/swk-one/field-duty/{id}/location-batch with the staff session token.
 * - Fixes that fail to upload stay in a bounded in-memory buffer and are retried with the next batch.
 */
public class SwkDutyLocationService extends Service {
    public static final String CHANNEL_ID = "swk_one_field_duty_channel";
    public static final int NOTIFICATION_ID = 4401;
    public static final String ACTION_START_DUTY = "ae.swkproperties.one.ACTION_START_DUTY";
    /** Stop sharing locally (the web app ends the session on the server itself). */
    public static final String ACTION_STOP_DUTY = "ae.swkproperties.one.ACTION_STOP_DUTY";
    /** Notification button: stop sharing and end the duty session on the server. */
    public static final String ACTION_END_DUTY = "ae.swkproperties.one.ACTION_END_DUTY";
    /** Broadcast (package-internal) telling the UI the duty is over. */
    public static final String ACTION_DUTY_ENDED = "ae.swkproperties.one.ACTION_DUTY_ENDED";

    public static final String EXTRA_SESSION_ID = "sessionId";
    public static final String EXTRA_LOCATION = "assignedLocation";
    public static final String EXTRA_SERVER_URL = "serverUrl";
    public static final String EXTRA_TOKEN = "sessionToken";
    public static final String EXTRA_DEVICE_ID = "deviceId";

    private static final long UPDATE_INTERVAL_MS = 30_000L;
    private static final long FASTEST_INTERVAL_MS = 15_000L;
    private static final long MAX_BATCH_DELAY_MS = 90_000L;
    private static final int MAX_BUFFERED_POINTS = 500;
    private static final int BATCH_LIMIT = 50;

    private static volatile boolean dutyActive = false;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final List<JSONObject> pending = new ArrayList<>();
    private FusedLocationProviderClient fused;
    private LocationCallback callback;
    private int sessionId = -1;
    private String assignedLocation = "";
    private String serverUrl = "";
    private String sessionToken = "";
    private String deviceId = "";

    public static boolean isRunning() {
        return dutyActive;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            // Process was recreated without the duty credentials: never keep a notification up without sharing.
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP_DUTY.equals(action)) {
            finishDuty(false);
            return START_NOT_STICKY;
        }
        if (ACTION_END_DUTY.equals(action)) {
            finishDuty(true);
            return START_NOT_STICKY;
        }

        sessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1);
        String loc = intent.getStringExtra(EXTRA_LOCATION);
        assignedLocation = loc == null || loc.isEmpty() ? "Field duty" : loc;
        serverUrl = trimTrailingSlash(intent.getStringExtra(EXTRA_SERVER_URL));
        sessionToken = orEmpty(intent.getStringExtra(EXTRA_TOKEN));
        deviceId = orEmpty(intent.getStringExtra(EXTRA_DEVICE_ID));

        if (sessionId <= 0 || !hasFineLocation()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException e) {
            stopSelf();
            return START_NOT_STICKY;
        }

        dutyActive = true;
        startLocationUpdates();
        return START_NOT_STICKY;
    }

    private boolean hasFineLocation() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressWarnings("MissingPermission") // checked in hasFineLocation()
    private void startLocationUpdates() {
        if (callback != null) return;
        fused = LocationServices.getFusedLocationProviderClient(this);
        callback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                for (Location l : result.getLocations()) {
                    synchronized (pending) {
                        pending.add(toPoint(l));
                        while (pending.size() > MAX_BUFFERED_POINTS) pending.remove(0);
                    }
                }
                io.execute(SwkDutyLocationService.this::flush);
            }
        };
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            .setMaxUpdateDelayMillis(MAX_BATCH_DELAY_MS)
            .build();
        fused.requestLocationUpdates(request, callback, Looper.getMainLooper());
    }

    private JSONObject toPoint(Location l) {
        JSONObject p = new JSONObject();
        try {
            p.put("lat", l.getLatitude());
            p.put("lng", l.getLongitude());
            p.put("accuracy_m", Math.round(l.getAccuracy()));
            p.put("timestamp", iso(l.getTime()));
            boolean mock = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? l.isMock() : l.isFromMockProvider();
            p.put("mock", mock);
        } catch (Exception ignored) {
            // JSONObject.put only throws for non-finite numbers, which a Location cannot hold.
        }
        return p;
    }

    /** Uploads buffered fixes. Runs on the single io thread. */
    private void flush() {
        List<JSONObject> batch;
        synchronized (pending) {
            if (pending.isEmpty()) return;
            batch = new ArrayList<>(pending.subList(0, Math.min(BATCH_LIMIT, pending.size())));
        }
        if (!isAllowedServer(serverUrl) || sessionToken.isEmpty()) return;
        try {
            JSONObject body = new JSONObject();
            body.put("device_id", deviceId);
            body.put("battery_pct", DeviceTelemetry.batteryPercent(this));
            body.put("network_type", DeviceTelemetry.networkType(this));
            body.put("points", new JSONArray(batch));
            int status = post("/api/swk-one/field-duty/" + sessionId + "/location-batch", body);
            if (status >= 200 && status < 300) {
                synchronized (pending) {
                    pending.removeAll(batch);
                }
            } else if (status == 400 || status == 401 || status == 403 || status == 404) {
                // Session ended / expired / not ours: stop collecting instead of retrying forever.
                finishDuty(false);
            }
        } catch (Exception ignored) {
            // Offline or server unreachable: keep the points and retry with the next fix.
        }
    }

    private int post(String path, JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(serverUrl + path).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(15_000);
            c.setReadTimeout(15_000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("x-swk-client", "android");
            c.setRequestProperty("x-swk-session", sessionToken);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = c.getOutputStream()) {
                out.write(bytes);
            }
            return c.getResponseCode();
        } finally {
            c.disconnect();
        }
    }

    /** Stops location collection and the notification. With notifyServer the duty session is also ended server-side. */
    private void finishDuty(boolean notifyServer) {
        if (!dutyActive && callback == null) {
            stopSelf();
            return;
        }
        dutyActive = false;
        if (fused != null && callback != null) {
            fused.removeLocationUpdates(callback);
            callback = null;
        }
        final int endedSession = sessionId;
        final boolean canNotify = notifyServer && endedSession > 0 && isAllowedServer(serverUrl) && !sessionToken.isEmpty();
        io.execute(() -> {
            if (canNotify) {
                try {
                    flush();
                    JSONObject body = new JSONObject();
                    body.put("notes", "Duty ended from the SWK ONE notification.");
                    post("/api/swk-one/field-duty/" + endedSession + "/end", body);
                } catch (Exception ignored) {
                    // Server will auto-expire the session at its scheduled end.
                }
            }
            synchronized (pending) {
                pending.clear();
            }
        });
        stopForeground(true);
        sendBroadcast(new Intent(ACTION_DUTY_ENDED).setPackage(getPackageName()));
        stopSelf();
    }

    private Notification buildNotification() {
        PendingIntent open = PendingIntent.getActivity(
            this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent endIntent = new Intent(this, SwkDutyLocationService.class).setAction(ACTION_END_DUTY);
        PendingIntent end = PendingIntent.getService(
            this, 1, endIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.duty_notification_title))
            .setContentText(assignedLocation)
            .setSmallIcon(R.drawable.ic_stat_swk)
            .setColor(ContextCompat.getColor(this, R.color.swk_champagne))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(open)
            .addAction(0, getString(R.string.duty_notification_stop), end)
            .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, getString(R.string.duty_channel_name), NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.duty_channel_description));
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        dutyActive = false;
        if (fused != null && callback != null) fused.removeLocationUpdates(callback);
        io.shutdown(); // lets a queued "end duty" request finish
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /** HTTPS only; plain HTTP is accepted for the emulator host used in development. */
    static boolean isAllowedServer(String url) {
        return url != null && (url.startsWith("https://") || url.startsWith("http://10.0.2.2"));
    }

    private static String iso(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(millis));
    }

    private static String trimTrailingSlash(String s) {
        String v = orEmpty(s).trim();
        while (v.endsWith("/")) v = v.substring(0, v.length() - 1);
        return v;
    }

    private static String orEmpty(String s) {
        return s == null ? "" : s;
    }
}
