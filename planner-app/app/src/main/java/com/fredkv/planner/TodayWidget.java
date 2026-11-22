package com.fredkv.planner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.text.SpannableString;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Home-screen widget «Сьогодні»: date + weather, today's events/plans, goals with a tap-to-check box.
 * The web layer pushes the data (Bridge.setWidget); taps on goals are queued here and applied
 * by the app on its next start (Bridge.takeWidgetToggles), while the widget shows them at once.
 */
public class TodayWidget extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "com.fredkv.planner.WIDGET_TOGGLE";
    private static final String[] WD = {"Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"};
    private static final String[] MON = {"січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"};
    private static final int[] ITEMS = {R.id.w_item1, R.id.w_item2, R.id.w_item3};
    private static final int[] GOALS = {R.id.w_goal1, R.id.w_goal2, R.id.w_goal3};

    static String today() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static void save(Context c, String json) {
        Store.put(c, "w_data", json);
        updateAll(c);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TodayWidget.class));
        for (int id : ids) m.updateAppWidget(id, build(c));
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
    }

    @Override
    public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (!ACTION_TOGGLE.equals(i.getAction())) return;
        String gid = i.getStringExtra("gid");
        if (gid == null) return;
        String d = today();
        try {
            JSONObject data = new JSONObject(Store.get(c, "w_data", "{}"));
            JSONArray goals = data.optJSONArray("goals");
            boolean on = true;
            if (goals != null) for (int k = 0; k < goals.length(); k++) {
                JSONObject g = goals.getJSONObject(k);
                if (!gid.equals(g.optString("id"))) continue;
                JSONArray log = g.optJSONArray("log"); if (log == null) { log = new JSONArray(); g.put("log", log); }
                int at = -1; for (int x = 0; x < log.length(); x++) if (d.equals(log.optString(x))) at = x;
                if (at >= 0) { log.remove(at); on = false; } else log.put(d);
            }
            Store.put(c, "w_data", data.toString());
            JSONArray q = new JSONArray(Store.get(c, "w_toggles", "[]"));
            q.put(new JSONObject().put("id", gid).put("date", d).put("on", on));
            Store.put(c, "w_toggles", q.toString());
        } catch (Exception ignored) {}
        updateAll(c);
    }

    private static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_today);
        Calendar cal = Calendar.getInstance();
        String d = today();
        v.setTextViewText(R.id.w_date, WD[cal.get(Calendar.DAY_OF_WEEK) - 1] + ", " + cal.get(Calendar.DAY_OF_MONTH) + " " + MON[cal.get(Calendar.MONTH)]);

        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent po = PendingIntent.getActivity(c, 7001, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_head, po);

        JSONObject data;
        try { data = new JSONObject(Store.get(c, "w_data", "{}")); } catch (Exception e) { data = new JSONObject(); }
        JSONObject day = data.optJSONObject("days") != null ? data.optJSONObject("days").optJSONObject(d) : null;
        JSONArray items = day != null ? day.optJSONArray("items") : null;
        v.setTextViewText(R.id.w_weather, day != null ? day.optString("weather", "") : "");
        int n = items == null ? 0 : items.length();
        for (int k = 0; k < ITEMS.length; k++) {
            if (k < n) {
                String t = items.optString(k);
                if (k == ITEMS.length - 1 && n > ITEMS.length) t += "  +" + (n - ITEMS.length);
                v.setTextViewText(ITEMS[k], t);
                v.setViewVisibility(ITEMS[k], View.VISIBLE);
                v.setOnClickPendingIntent(ITEMS[k], po);
            } else v.setViewVisibility(ITEMS[k], View.GONE);
        }
        v.setViewVisibility(R.id.w_empty, n == 0 ? View.VISIBLE : View.GONE);
        if (day == null && !data.has("days")) v.setTextViewText(R.id.w_empty, "Відкрийте ЛАД, щоб показати день");

        JSONArray goals = data.optJSONArray("goals");
        int gn = goals == null ? 0 : goals.length();
        v.setViewVisibility(R.id.w_goals_h, gn > 0 ? View.VISIBLE : View.GONE);
        int done = c.getResources().getColor(R.color.w_done, null);
        for (int k = 0; k < GOALS.length; k++) {
            if (k >= gn) { v.setViewVisibility(GOALS[k], View.GONE); continue; }
            JSONObject g = goals.optJSONObject(k);
            JSONArray log = g.optJSONArray("log");
            boolean on = false;
            if (log != null) for (int x = 0; x < log.length(); x++) if (d.equals(log.optString(x))) on = true;
            String extra = "";
            if ("week".equals(g.optString("per")) || "month".equals(g.optString("per"))) {
                int cnt = 0; String from = "week".equals(g.optString("per")) ? mondayOf(cal) : d.substring(0, 8) + "01";
                if (log != null) for (int x = 0; x < log.length(); x++) { String s = log.optString(x); if (s.compareTo(from) >= 0 && s.compareTo(d) <= 0) cnt++; }
                extra = "  " + cnt + "/" + g.optInt("times");
            }
            SpannableString s = new SpannableString((on ? "✓  " : "○  ") + g.optString("title") + extra);
            if (on) s.setSpan(new ForegroundColorSpan(done), 0, 1, 0);
            v.setTextViewText(GOALS[k], s);
            v.setViewVisibility(GOALS[k], View.VISIBLE);
            Intent t = new Intent(c, TodayWidget.class).setAction(ACTION_TOGGLE).putExtra("gid", g.optString("id"));
            v.setOnClickPendingIntent(GOALS[k], PendingIntent.getBroadcast(c, 7100 + k, t, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        return v;
    }

    private static String mondayOf(Calendar now) {
        Calendar c = (Calendar) now.clone();
        int dow = c.get(Calendar.DAY_OF_WEEK); int back = (dow + 5) % 7; c.add(Calendar.DAY_OF_MONTH, -back);
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }
}
