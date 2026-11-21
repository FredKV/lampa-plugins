package com.fredkv.planner;

import android.content.Context;
import android.content.SharedPreferences;

/** App-private native storage (not visible to the web layer except via explicit bridge calls). */
final class Store {
    private Store() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("tanichka_native", Context.MODE_PRIVATE);
    }

    static String get(Context c, String k, String def) { return prefs(c).getString(k, def); }

    static void put(Context c, String k, String v) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (v == null) e.remove(k); else e.putString(k, v);
        e.apply();
    }
}
