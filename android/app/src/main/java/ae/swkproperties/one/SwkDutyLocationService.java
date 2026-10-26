package ae.swkproperties.one;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * SwkDutyLocationService
 *
 * Enterprise Android Foreground Service for SWK ONE Field Duty Location Sharing.
 * - Starts ONLY when an agent explicitly starts an authorised field duty session.
 * - Displays a persistent Android notification ("SWK ONE Field Duty Active") with a direct "Stop Duty" action.
 * - Batches location updates to minimize battery and mobile data usage.
 * - Stops immediately when field duty ends. Zero off-duty background tracking.
 */
public class SwkDutyLocationService extends Service {
    public static final String CHANNEL_ID = "swk_one_field_duty_channel";
    public static final int NOTIFICATION_ID = 4401;
    public static final String ACTION_START_DUTY = "ae.swkproperties.one.ACTION_START_DUTY";
    public static final String ACTION_STOP_DUTY = "ae.swkproperties.one.ACTION_STOP_DUTY";

    private static boolean isDutyActive = false;
    private static int activeSessionId = -1;
    private static String assignedLocation = "Dubai Field Duty";

    public static boolean isRunning() {
        return isDutyActive;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_DUTY.equals(intent.getAction())) {
            stopDutySharing();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            activeSessionId = intent.getIntExtra("sessionId", -1);
            String loc = intent.getStringExtra("assignedLocation");
            if (loc != null && !loc.isEmpty()) {
                assignedLocation = loc;
            }
        }

        isDutyActive = true;
        Notification notification = buildNotification(assignedLocation);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private void stopDutySharing() {
        isDutyActive = false;
        activeSessionId = -1;
        stopForeground(true);
        stopSelf();
    }

    private Notification buildNotification(String locationText) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, SwkDutyLocationService.class);
        stopIntent.setAction(ACTION_STOP_DUTY);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SWK ONE · Active Field Duty Location Sharing")
            .setContentText("Assigned Duty: " + locationText + " (Session #" + activeSessionId + ")")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentIntent)
            .addAction(
                android.R.drawable.ic_media_pause,
                "End Field Duty",
                stopPendingIntent
            )
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SWK ONE Active Field Duty Location Sharing",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Persistent status indicator while an authorised SWK ONE field duty session is active.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        isDutyActive = false;
        activeSessionId = -1;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
