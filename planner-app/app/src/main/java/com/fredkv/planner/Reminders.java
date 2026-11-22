package com.fredkv.planner;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules local notifications described by the web layer: [{id, at(ms), title, text}]. */
final class Reminders {
    private Reminders() {}

    static final String CHANNEL = "reminders";

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Нагадування", NotificationManager.IMPORTANCE_DEFAULT));
        nm.deleteNotificationChannel("prices");
    }

    private static PendingIntent pi(Context c, int code, String title, String text) { return pi(c, code, title, text, null); }

    private static PendingIntent pi(Context c, int code, String title, String text, String page) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.putExtra("title", title);
        i.putExtra("text", text);
        if (page != null && !page.isEmpty()) i.putExtra("page", page);
        i.putExtra("nid", code);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Exact alarm when allowed (on time even in Doze), otherwise the best inexact one. */
    static void schedule(AlarmManager am, long at, PendingIntent p) {
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
        }
    }

    /** One-off check: a reminder in `sec` seconds through the same alarm path. */
    static void test(Context c, int sec) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        schedule(am, System.currentTimeMillis() + sec * 1000L, pi(c, 999998, "⏰ Нагадування працюють", "Це перевірка: так приходитимуть нагадування в потрібний час."));
    }

    /** Replaces all scheduled reminders with the given list. */
    static void setAll(Context c, String json) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        try {
            JSONArray old = new JSONArray(Store.get(c, "reminders", "[]"));
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                am.cancel(pi(c, o.optInt("code"), o.optString("title"), o.optString("text")));
            }
        } catch (Exception ignored) {}
        JSONArray saved = new JSONArray();
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            long now = System.currentTimeMillis();
            for (int k = 0; k < arr.length() && k < 300; k++) {
                JSONObject o = arr.getJSONObject(k);
                long at = o.optLong("at");
                if (at <= now) continue;
                int code = 1000 + Math.abs(o.optString("id").hashCode() % 1000000);
                o.put("code", code);
                schedule(am, at, pi(c, code, o.optString("title"), o.optString("text"), o.optString("page", "")));
                saved.put(o);
            }
        } catch (Exception ignored) {}
        Store.put(c, "reminders", saved.toString());
    }

    static void restore(Context c) { setAll(c, Store.get(c, "reminders", "[]")); }

    static void show(Context c, int id, String channel, String title, String text) { show(c, id, channel, title, text, null); }

    static void show(Context c, int id, String channel, String title, String text, String page) {
        ensureChannels(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (page != null && !page.isEmpty()) open.putExtra("page", page);
        PendingIntent p = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification.Builder nb = new android.app.Notification.Builder(c, channel);
        if (title != null && !title.trim().isEmpty()) nb.setContentTitle(title);
        android.app.Notification n = nb
                .setSmallIcon(R.drawable.ic_notif)
                .setContentText(text)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(text))
                .setContentIntent(p)
                .setAutoCancel(true)
                .build();
        try { nm.notify(id, n); } catch (SecurityException ignored) {}
    }
}
