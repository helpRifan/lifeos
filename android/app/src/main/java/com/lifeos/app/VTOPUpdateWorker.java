package com.lifeos.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class VTOPUpdateWorker extends Worker {
    public static final String PREFS_NAME = "VTOPBackgroundPrefs";
    private static final String CHANNEL_ID = "vtop_sync_channel";

    public VTOPUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        boolean success = performSync(getApplicationContext());
        return success ? Result.success() : Result.retry();
    }

    /**
     * Performs the actual sync, fetches VTOP data, saves to prefs, and sends alerts if data changed.
     */
    public static boolean performSync(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String username = prefs.getString("username", null);
        String password = prefs.getString("password", null);
        String semesterId = prefs.getString("semesterId", "CH20252605");

        if (username == null || password == null) {
            return false;
        }

        try {
            // 1. Login
            String loginUrl = "https://api.uni-cc.site/api/login";
            String loginBody = new JSONObject()
                .put("username", username)
                .put("password", password)
                .toString();

            String loginResStr = httpPost(loginUrl, loginBody);
            JSONObject loginJson = new JSONObject(loginResStr);

            if (!loginJson.optBoolean("success", false)) {
                return false;
            }

            String cookies = loginJson.getString("cookies");
            String csrf = loginJson.getString("csrf");
            String authorizedID = loginJson.getString("authorizedID");

            // 2. Fetch data (Attendance, Grades, Schedule, All Grades)
            String payload = new JSONObject()
                .put("cookies", cookies)
                .put("csrf", csrf)
                .put("authorizedID", authorizedID)
                .put("semesterId", semesterId)
                .toString();

            String attUrl = "https://api.uni-cc.site/api/attendance";
            String gradesUrl = "https://api.uni-cc.site/api/grades";
            String schedUrl = "https://api.uni-cc.site/api/schedule";
            String allGradesUrl = "https://api.uni-cc.site/api/all-grades";

            String attRes = httpPost(attUrl, payload);
            String gradesRes = httpPost(gradesUrl, payload);
            String schedRes = httpPost(schedUrl, payload);
            String allGradesRes = httpPost(allGradesUrl, payload);

            // Compare CGPA or attendance to send notification if changed
            String oldGrades = prefs.getString("unicc_grades", null);
            checkAndNotifyChanges(ctx, oldGrades, gradesRes);

            // Save to prefs
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("unicc_attendance", attRes);
            editor.putString("unicc_grades", gradesRes);
            editor.putString("unicc_schedule", schedRes);
            editor.putString("unicc_allGrades", allGradesRes);
            editor.putLong("last_sync_time", System.currentTimeMillis());
            editor.apply();

            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static String httpPost(String urlStr, String jsonBody) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; utf-8");
        conn.setRequestProperty("Accept", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(20000);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int code = conn.getResponseCode();
        if (code >= 200 && code < 300) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line.trim());
                }
                return response.toString();
            }
        } else {
            throw new Exception("HTTP error: " + code);
        }
    }

    private static void checkAndNotifyChanges(Context ctx, String oldGradesStr, String newGradesStr) {
        try {
            if (oldGradesStr == null) return;
            JSONObject oldGrades = new JSONObject(oldGradesStr);
            JSONObject newGrades = new JSONObject(newGradesStr);

            // Compare CGPA
            String oldCgpa = oldGrades.optString("cgpa", "");
            String newCgpa = newGrades.optString("cgpa", "");

            if (!newCgpa.isEmpty() && !newCgpa.equals(oldCgpa)) {
                sendNotification(ctx, "VTOP CGPA Updated! 🎉", "Your new CGPA is " + newCgpa + " (was " + oldCgpa + ")");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void sendNotification(Context ctx, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "VTOP Sync Status",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Notifications about background VTOP data syncs");
            nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            ctx,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        nm.notify((int) System.currentTimeMillis(), builder.build());
    }
}
