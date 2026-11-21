package com.fredkv.planner;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URI;
import java.util.HashSet;
import java.util.Set;

/**
 * Background price tracking. The web layer stores the watch list (with the full Gemini request body)
 * via the bridge; this job re-runs each search, keeps only offers confirmed by Google Search sources,
 * stores the raw result for the app and notifies when the best price reaches the target.
 */
public class PriceJobService extends JobService {
    static final int JOB_ID = 7001;

    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null) return;
        boolean any;
        try { any = new JSONArray(Store.get(c, "price_watch", "[]")).length() > 0; } catch (Exception e) { any = false; }
        if (!any) { js.cancel(JOB_ID); return; }
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(c, PriceJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(12L * 60 * 60 * 1000)
                .setPersisted(true)
                .build();
        js.schedule(info);
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(() -> {
            try { runChecks(getApplicationContext()); } catch (Exception ignored) {}
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }

    static void runChecks(Context c) throws Exception {
        String key = Store.get(c, "gemini_key", "");
        if (key.isEmpty()) return;
        JSONArray watches = new JSONArray(Store.get(c, "price_watch", "[]"));
        JSONObject results = new JSONObject(Store.get(c, "price_results", "{}"));
        for (int k = 0; k < watches.length(); k++) {
            JSONObject w = watches.getJSONObject(k);
            String id = w.optString("id");
            Net.Res r = Net.request("POST", Net.geminiUrl(w.optString("model", "gemini-2.5-flash"), key), w.optString("body"));
            if (r.code != 200) continue;
            JSONObject res = new JSONObject();
            res.put("ts", System.currentTimeMillis());
            res.put("raw", r.text);
            results.put(id, res);
            double best = bestVerified(r.text);
            double target = w.optDouble("target", 0);
            double lastNotified = w.optDouble("notified", -1);
            if (best > 0 && target > 0 && best <= target && best != lastNotified) {
                Reminders.show(c, 5000 + Math.abs(id.hashCode() % 10000), Reminders.CHANNEL_PRICE,
                        "Ціна знизилась: " + w.optString("title"),
                        "Знайдено за " + Math.round(best) + " ₴ (ваша ціль — " + Math.round(target) + " ₴). Відкрийте «Пошук цін», щоб переглянути пропозицію.");
                w.put("notified", best);
            }
        }
        Store.put(c, "price_results", results.toString());
        Store.put(c, "price_watch", watches.toString());
    }

    static String host(String url) {
        try {
            String h = new URI(url.trim()).getHost();
            if (h == null) return "";
            h = h.toLowerCase();
            return h.startsWith("www.") ? h.substring(4) : h;
        } catch (Exception e) { return ""; }
    }

    /** Lowest total (price + delivery) among offers whose shop domain appears in grounding sources. */
    static double bestVerified(String raw) {
        try {
            JSONObject cand = new JSONObject(raw).getJSONArray("candidates").getJSONObject(0);
            Set<String> domains = new HashSet<>();
            JSONObject gm = cand.optJSONObject("groundingMetadata");
            if (gm != null && gm.optJSONArray("groundingChunks") != null) {
                JSONArray ch = gm.getJSONArray("groundingChunks");
                for (int i = 0; i < ch.length(); i++) {
                    JSONObject web = ch.getJSONObject(i).optJSONObject("web");
                    if (web == null) continue;
                    String t = web.optString("title").toLowerCase().trim();
                    if (t.startsWith("www.")) t = t.substring(4);
                    if (!t.isEmpty()) domains.add(t);
                }
            }
            StringBuilder sb = new StringBuilder();
            JSONArray parts = cand.getJSONObject("content").getJSONArray("parts");
            for (int i = 0; i < parts.length(); i++) sb.append(parts.getJSONObject(i).optString("text"));
            String t = sb.toString();
            int a = t.indexOf('{'), b = t.lastIndexOf('}');
            if (a < 0 || b < a) return -1;
            JSONArray offers = new JSONObject(t.substring(a, b + 1)).optJSONArray("offers");
            if (offers == null) return -1;
            double best = -1;
            for (int i = 0; i < offers.length(); i++) {
                JSONObject o = offers.getJSONObject(i);
                String h = host(o.optString("url"));
                if (h.isEmpty()) continue;
                boolean ok = false;
                for (String d : domains) if (h.equals(d) || h.endsWith("." + d) || d.endsWith("." + h)) { ok = true; break; }
                if (!ok) continue;
                double p = o.optDouble("price", 0);
                if (p <= 0) continue;
                double total = p + Math.max(0, o.optDouble("delivery", 0));
                if (best < 0 || total < best) best = total;
            }
            return best;
        } catch (Exception e) { return -1; }
    }
}
