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

    static final String CHANNEL = "reminders_lad";

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Нагадування", NotificationManager.IMPORTANCE_DEFAULT);
            android.net.Uri snd = android.net.Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.lad_notify);
            ch.setSound(snd, new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        nm.deleteNotificationChannel("reminders");
        nm.deleteNotificationChannel("prices");
    }

    private static PendingIntent pi(Context c, int code, String title, String text) { return pi(c, code, title, text, null); }

    private static PendingIntent pi(Context c, int code, String title, String text, String page) { return pi(c, code, title, text, page, null); }

    private static PendingIntent pi(Context c, int code, String title, String text, String page, JSONObject o) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.putExtra("title", title);
        i.putExtra("text", text);
        if (page != null && !page.isEmpty()) i.putExtra("page", page);
        i.putExtra("nid", code);
        if (o != null && !o.optString("goal").isEmpty()) {
            i.putExtra("goal", o.optString("goal"));
            i.putExtra("gdate", o.optString("date"));
            i.putExtra("a1", o.optString("a1"));
            i.putExtra("a2", o.optString("a2"));
        }
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static final String ACTION_GOAL = "com.fredkv.planner.GOAL_ACTION";

    /** «✓ Відмітити» / «Зірвався» pressed in a notification: queue it for the app (like widget taps) and drop the rest of today's nags. */
    static void goalAction(Context c, Intent i) {
        String gid = i.getStringExtra("goal"), d = i.getStringExtra("gdate"), op = i.getStringExtra("op");
        if (gid == null || d == null) return;
        try {
            JSONArray q = new JSONArray(Store.get(c, "w_toggles", "[]"));
            JSONObject e = new JSONObject().put("id", gid).put("date", d).put("on", true);
            if ("slip".equals(op)) e.put("slip", true);
            q.put(e);
            Store.put(c, "w_toggles", q.toString());
        } catch (Exception ignored) {}
        AlarmManager am = c.getSystemService(AlarmManager.class);
        try {
            JSONArray old = new JSONArray(Store.get(c, "reminders", "[]")), keep = new JSONArray();
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                if (am != null && gid.equals(o.optString("goal")) && d.equals(o.optString("date"))) am.cancel(pi(c, o.optInt("code"), o.optString("title"), o.optString("text")));
                else keep.put(o);
            }
            Store.put(c, "reminders", keep.toString());
        } catch (Exception ignored) {}
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(i.getIntExtra("nid", 0));
        android.widget.Toast.makeText(c, "slip".equals(op) ? "Зрив відмічено. Завтра новий день 💚" : "Відмічено ✓", android.widget.Toast.LENGTH_SHORT).show();
    }

    private static android.app.Notification.Action goalBtn(Context c, int nid, String label, String op, Intent src) {
        Intent a = new Intent(c, ReminderReceiver.class).setAction(ACTION_GOAL);
        a.putExtra("goal", src.getStringExtra("goal")); a.putExtra("gdate", src.getStringExtra("gdate"));
        a.putExtra("op", op); a.putExtra("nid", nid);
        PendingIntent p = PendingIntent.getBroadcast(c, nid * 2 + ("slip".equals(op) ? 1 : 0), a, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new android.app.Notification.Action.Builder(null, label, p).build();
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
                schedule(am, at, pi(c, code, o.optString("title"), o.optString("text"), o.optString("page", ""), o));
                saved.put(o);
            }
        } catch (Exception ignored) {}
        Store.put(c, "reminders", saved.toString());
    }

    static void restore(Context c) { setAll(c, Store.get(c, "reminders", "[]")); }

    static void show(Context c, int id, String channel, String title, String text) { show(c, id, channel, title, text, null); }

    static void show(Context c, int id, String channel, String title, String text, String page) { show(c, id, channel, title, text, page, null); }

    static void show(Context c, int id, String channel, String title, String text, String page, Intent src) {
        ensureChannels(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (page != null && !page.isEmpty()) open.putExtra("page", page);
        PendingIntent p = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification.Builder nb = new android.app.Notification.Builder(c, channel);
        if (title != null && !title.trim().isEmpty()) nb.setContentTitle(title);
        if (src != null && src.getStringExtra("goal") != null) {
            String a1 = src.getStringExtra("a1"), a2 = src.getStringExtra("a2");
            if (a1 != null && !a1.isEmpty()) nb.addAction(goalBtn(c, id, a1, "check", src));
            if (a2 != null && !a2.isEmpty()) nb.addAction(goalBtn(c, id, a2, "slip", src));
        }
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
