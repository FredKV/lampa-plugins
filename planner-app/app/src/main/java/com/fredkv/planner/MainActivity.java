package com.fredkv.planner;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final int REQ_FILE = 41;
    private static final int REQ_LOCATION = 42;
    private static final int REQ_NOTIF = 43;

    private WebView web;
    private FrameLayout root;
    private int insetTop = 0, insetBottom = 0;
    private boolean pageReady = false;

    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private String pendingLocationId;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Reminders.ensureChannels(this);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFFE6F0FB);
        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            w.setNavigationBarContrastEnforced(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                root.setPadding(0, 0, 0, Math.max(0, ime.bottom));
                float d = getResources().getDisplayMetrics().density;
                insetTop = Math.round(bars.top / d);
                insetBottom = ime.bottom > 0 ? 0 : Math.round(bars.bottom / d);
                pushInsets();
                return WindowInsets.CONSUMED;
            });
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    openExternal(u.toString());
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                pushInsets();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                Intent chooser = Intent.createChooser(pick, "Оберіть фото");
                cameraUri = null;
                // Camera without extra permissions: write into MediaStore (Android 10+)
                if (Build.VERSION.SDK_INT >= 29) {
                    try {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Images.Media.DISPLAY_NAME, "tanichka_" + System.currentTimeMillis() + ".jpg");
                        cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Tanichka");
                        cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                        if (cameraUri != null) {
                            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                            cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                        }
                    } catch (Exception ignored) { cameraUri = null; }
                }
                try {
                    startActivityForResult(chooser, REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.loadUrl("file:///android_asset/www/index.html");
        // v2 had a background product-price job; it was replaced by dish-based price comparison
        android.app.job.JobScheduler js = getSystemService(android.app.job.JobScheduler.class);
        if (js != null) js.cancel(7001);
        Store.put(this, "price_watch", null);
        Store.put(this, "price_results", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) result = new Uri[]{data.getData()};
            else if (cameraUri != null) result = new Uri[]{cameraUri};
        }
        if (result == null && cameraUri != null) {
            try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) {}
        } else if (result != null && cameraUri != null && !result[0].equals(cameraUri)) {
            try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) {}
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pageReady) web.evaluateJavascript("window.__onResume&&window.__onResume()", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (pageReady) web.evaluateJavascript("window.__onPause&&window.__onPause()", null);
    }

    private void pushInsets() {
        if (!pageReady || web == null) return;
        web.evaluateJavascript("window.__setInsets&&window.__setInsets(" + insetTop + "," + insetBottom + ")", null);
    }

    private void js(final String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Немає застосунку, щоб відкрити посилання", Toast.LENGTH_SHORT).show();
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack&&window.onAndroidBack())?'1':'0'", value -> {
            if (value == null || !value.contains("1")) finish();
        });
    }

    /* ---------------- location ---------------- */

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQ_LOCATION && pendingLocationId != null) {
            String id = pendingLocationId;
            pendingLocationId = null;
            if (granted) fetchLocation(id);
            else locationResult(id, null, "Доступ до геолокації не надано");
        }
        if (requestCode == REQ_NOTIF) js("window.__notifPerm&&window.__notifPerm(" + granted + ")");
    }

    private void locationResult(String id, Location l, String error) {
        if (l == null) {
            js("window.__locCb(" + JSONObject.quote(id) + ",null,null,null," + JSONObject.quote(error) + ")");
            return;
        }
        final double lat = l.getLatitude(), lon = l.getLongitude();
        new Thread(() -> {
            String name = "";
            try {
                if (Geocoder.isPresent()) {
                    @SuppressWarnings("deprecation")
                    List<Address> a = new Geocoder(this, new Locale("uk", "UA")).getFromLocation(lat, lon, 1);
                    if (a != null && !a.isEmpty()) {
                        Address ad = a.get(0);
                        name = ad.getLocality() != null ? ad.getLocality()
                                : ad.getSubAdminArea() != null ? ad.getSubAdminArea()
                                : ad.getAdminArea() != null ? ad.getAdminArea() : "";
                    }
                }
            } catch (Exception ignored) {}
            js("window.__locCb(" + JSONObject.quote(id) + "," + lat + "," + lon + "," + JSONObject.quote(name) + ",null)");
        }).start();
    }

    @SuppressLint("MissingPermission")
    private void fetchLocation(final String id) {
        LocationManager lm = getSystemService(LocationManager.class);
        if (lm == null) { locationResult(id, null, "Геолокація недоступна"); return; }
        String provider = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER
                : lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER : null;
        if (provider == null) { locationResult(id, null, "Увімкніть визначення місцезнаходження в налаштуваннях телефону"); return; }
        if (Build.VERSION.SDK_INT >= 30) {
            lm.getCurrentLocation(provider, null, getMainExecutor(), loc -> {
                if (loc == null) loc = lastKnown(lm);
                locationResult(id, loc, "Не вдалося визначити місцезнаходження");
            });
        } else {
            Location loc = lastKnown(lm);
            locationResult(id, loc, "Не вдалося визначити місцезнаходження");
        }
    }

    @SuppressLint("MissingPermission")
    private Location lastKnown(LocationManager lm) {
        Location best = null;
        for (String p : lm.getProviders(true)) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (Exception ignored) {}
        }
        return best;
    }

    /* ---------------- JS bridge ---------------- */

    private class Bridge {

        /** Generic HTTP for public APIs (weather, shop catalogues). headers: JSON object or "". */
        @JavascriptInterface
        public void http(final String method, final String url, final String body, final String headers, final String id) {
            new Thread(() -> {
                JSONObject h = null;
                try { if (headers != null && !headers.isEmpty()) h = new JSONObject(headers); } catch (Exception ignored) {}
                Net.Res r = Net.request(method, url, body == null || body.isEmpty() ? null : body, h);
                js("window.__httpCb(" + JSONObject.quote(id) + "," + r.code + "," + JSONObject.quote(r.text) + ")");
            }).start();
        }

        /** Gemini request: the API key is added here and never exposed to web code. */
        @JavascriptInterface
        public void gemini(final String model, final String body, final String id) {
            new Thread(() -> {
                String key = Store.get(MainActivity.this, "gemini_key", "");
                Net.Res r = key.isEmpty()
                        ? new Net.Res(401, "{\"error\":{\"message\":\"API key not set\"}}")
                        : Net.request("POST", Net.geminiUrl(model, key), body);
                js("window.__httpCb(" + JSONObject.quote(id) + "," + r.code + "," + JSONObject.quote(r.text) + ")");
            }).start();
        }

        @JavascriptInterface
        public void setApiKey(String key) {
            Store.put(MainActivity.this, "gemini_key", key == null || key.trim().isEmpty() ? null : key.trim());
        }

        @JavascriptInterface
        public boolean hasApiKey() {
            return !Store.get(MainActivity.this, "gemini_key", "").isEmpty();
        }

        @JavascriptInterface
        public String apiKeyHint() {
            String k = Store.get(MainActivity.this, "gemini_key", "");
            return k.length() < 8 ? "" : k.substring(0, 4) + "…" + k.substring(k.length() - 4);
        }

        @JavascriptInterface
        public void setReminders(String json) {
            Reminders.setAll(MainActivity.this, json);
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            if (Build.VERSION.SDK_INT >= 33)
                return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            return true;
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
            } else {
                js("window.__notifPerm&&window.__notifPerm(true)");
            }
        }

        @JavascriptInterface
        public void getLocation(final String id) {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    fetchLocation(id);
                } else {
                    pendingLocationId = id;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                }
            });
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(() -> openExternal(url));
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Поділитися"));
            });
        }

        @JavascriptInterface
        public void toast(final String text) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void setTheme(final boolean dark, final String bg) {
            runOnUiThread(() -> {
                int color;
                try { color = Color.parseColor(bg); } catch (Exception e) { color = dark ? Color.BLACK : Color.WHITE; }
                root.setBackgroundColor(color);
                Window w = getWindow();
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController ic = w.getInsetsController();
                    if (ic != null) {
                        int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        ic.setSystemBarsAppearance(dark ? 0 : mask, mask);
                    }
                } else {
                    w.setStatusBarColor(color);
                    w.setNavigationBarColor(color);
                    View decor = w.getDecorView();
                    int flags = decor.getSystemUiVisibility();
                    if (dark) flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                    else flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    decor.setSystemUiVisibility(flags);
                }
            });
        }
    }
}
