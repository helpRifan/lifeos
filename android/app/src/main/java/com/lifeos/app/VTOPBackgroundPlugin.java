package com.lifeos.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;
import android.content.Intent;
import android.provider.Settings;
import android.os.Build;
import android.net.Uri;
import android.os.PowerManager;
@CapacitorPlugin(name = "VTOPBackground")
public class VTOPBackgroundPlugin extends Plugin {
    private static final String WORK_NAME = "VTOPUpdateWork";

    @PluginMethod
    public void setCredentials(PluginCall call) {
        String username = call.getString("username");
        String password = call.getString("password");
        String semesterId = call.getString("semesterId");
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(VTOPUpdateWorker.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (username == null || password == null || username.trim().isEmpty() || password.trim().isEmpty()) {
            // Cancel background worker
            WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME);
            
            editor.remove("username");
            editor.remove("password");
            editor.remove("semesterId");
            editor.remove("unicc_attendance");
            editor.remove("unicc_grades");
            editor.remove("unicc_schedule");
            editor.remove("unicc_allGrades");
            editor.apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "sync_disabled");
            call.resolve(ret);
            return;
        }
        editor.putString("username", username);
        editor.putString("password", password);
        editor.putString("semesterId", semesterId != null ? semesterId : "CH20252605");
        editor.apply();

        // Setup daily background sync (runs every 24 hours to keep updates daily)
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
            VTOPUpdateWorker.class,
            24, TimeUnit.HOURS
        )
            .setConstraints(constraints)
            .build();

        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            workRequest
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getBackgroundCachedData(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(VTOPUpdateWorker.PREFS_NAME, Context.MODE_PRIVATE);

        JSObject ret = new JSObject();
        ret.put("attendance", prefs.getString("unicc_attendance", null));
        ret.put("grades", prefs.getString("unicc_grades", null));
        ret.put("schedule", prefs.getString("unicc_schedule", null));
        ret.put("allGrades", prefs.getString("unicc_allGrades", null));
        ret.put("lastSyncTime", prefs.getLong("last_sync_time", 0));
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerSyncNow(PluginCall call) {
        // Run sync in background thread and resolve call on finish
        new Thread(() -> {
            boolean success = VTOPUpdateWorker.performSync(getContext());
            if (success) {
                JSObject ret = new JSObject();
                ret.put("status", "success");
                call.resolve(ret);
            } else {
                call.reject("Sync failed");
            }
        }).start();
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context ctx = getContext();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("requested", true);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", false);
        call.resolve(ret);
    }
}
