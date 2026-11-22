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
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.CancellationSignal;
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
    private static final int REQ_VOICE = 44;
    private static final int REQ_MIC = 47;
    private android.speech.SpeechRecognizer recognizer;
    private static final int REQ_BK_CREATE = 45;
    private static final int REQ_BK_OPEN = 46;

    private WebView web;
    private FrameLayout root;
    private int insetTop = 0, insetBottom = 0;
    private boolean pageReady = false;
    /** Solid cover shown over the WebView until the JS lock screen is drawn. */
    private View cover;
    private long stoppedAt = 0;
    private static final long LOCK_AFTER_MS = 60000;
    private static final String ICON_PKG = "com.fredkv.planner"; // manifest namespace of the aliases
    private static final String[] ICONS = {"black", "olive", "terra", "yellow", "white"};

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
        cover = new View(this);
        cover.setBackgroundColor(prefs().getInt("bg_color", 0xFFE6F0FB));
        cover.setClickable(true);
        cover.setVisibility(prefs().getBoolean("lock_on", false) ? View.VISIBLE : View.GONE);
        root.addView(cover, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setBackgroundColor(prefs().getInt("bg_color", 0xFFE6F0FB));
        setContentView(root);
        takePage(getIntent());
        if (cover.getVisibility() == View.VISIBLE) cover.postDelayed(this::hideCover, 5000);

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
                openPendingPage();
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
                        cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/LAD");
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
        if (requestCode == REQ_VOICE) {
            String text = "";
            if (resultCode == RESULT_OK && data != null) {
                java.util.ArrayList<String> r = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
                if (r != null && !r.isEmpty()) text = r.get(0);
            }
            js("window.__voiceCb&&window.__voiceCb(" + JSONObject.quote(text) + ")");
            return;
        }
        if (requestCode == REQ_BK_CREATE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri u = data.getData();
                try { getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception ignored) {}
                Store.put(this, "backup_uri", u.toString());
                ok = true;
            }
            js("window.__bkPicked&&window.__bkPicked(" + ok + ")");
            return;
        }
        if (requestCode == REQ_BK_OPEN) {
            String text = "";
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (java.io.InputStream in = getContentResolver().openInputStream(data.getData())) {
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
                    while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                    text = bo.toString("UTF-8");
                } catch (Exception ignored) {}
            }
            js("window.__bkOpened&&window.__bkOpened(" + JSONObject.quote(text) + ")");
            return;
        }
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

    private android.content.SharedPreferences prefs() {
        return getSharedPreferences("lad_ui", MODE_PRIVATE);
    }

    private void hideCover() {
        if (cover != null) cover.setVisibility(View.GONE);
    }

    /** In-app speech recognition (own UI): partial text, sound level and final text go to JS. */
    private void startListening() {
        try {
            if (!android.speech.SpeechRecognizer.isRecognitionAvailable(this)) { js("window.__voiceCb&&window.__voiceCb('',true,'na')"); return; }
            if (recognizer != null) recognizer.destroy();
            recognizer = android.speech.SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new android.speech.RecognitionListener() {
                public void onReadyForSpeech(Bundle b) { js("window.__voiceReady&&window.__voiceReady()"); }
                public void onBeginningOfSpeech() {}
                public void onRmsChanged(float db) { js("window.__voiceRms&&window.__voiceRms(" + db + ")"); }
                public void onBufferReceived(byte[] b) {}
                public void onEndOfSpeech() {}
                public void onError(int code) { js("window.__voiceCb&&window.__voiceCb('',true,'e" + code + "')"); }
                public void onResults(Bundle b) {
                    java.util.ArrayList<String> r = b.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION);
                    js("window.__voiceCb&&window.__voiceCb(" + JSONObject.quote(r != null && !r.isEmpty() ? r.get(0) : "") + ")");
                }
                public void onPartialResults(Bundle b) {
                    java.util.ArrayList<String> r = b.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION);
                    if (r != null && !r.isEmpty()) js("window.__voicePartial&&window.__voicePartial(" + JSONObject.quote(r.get(0)) + ")");
                }
                public void onEvent(int t, Bundle b) {}
            });
            Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "uk-UA");
            i.putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            recognizer.startListening(i);
        } catch (Exception e) { js("window.__voiceCb&&window.__voiceCb('',true,'x')"); }
    }

    private String pendingPage = null;

    private void takePage(Intent i) {
        if (i == null) return;
        String p = i.getStringExtra("page");
        if (p != null && p.matches("[a-zA-Z]{1,20}")) pendingPage = p;
        i.removeExtra("page");
    }

    private void openPendingPage() {
        if (pendingPage == null || !pageReady) return;
        final String p = pendingPage; pendingPage = null;
        web.evaluateJavascript("window.__openPage&&window.__openPage('" + p + "')", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        takePage(intent);
        openPendingPage();
    }

    @Override
    protected void onStop() {
        super.onStop();
        stoppedAt = System.currentTimeMillis();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (stoppedAt > 0 && prefs().getBoolean("lock_on", false)
                && System.currentTimeMillis() - stoppedAt > LOCK_AFTER_MS && cover != null) {
            cover.setBackgroundColor(prefs().getInt("bg_color", 0xFFE6F0FB));
            cover.setVisibility(View.VISIBLE);
            cover.postDelayed(this::hideCover, 5000);
        }
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
        if (requestCode == REQ_MIC) { if (granted) startListening(); else js("window.__voiceCb&&window.__voiceCb('',true,'mic')"); }
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

        private JSONObject geminiHeaders(String key) {
            JSONObject h = new JSONObject();
            try { h.put("x-goog-api-key", key); } catch (Exception ignored) {}
            return h;
        }

        /** Gemini request: the API key is added here and never exposed to web code. */
        @JavascriptInterface
        public void gemini(final String model, final String body, final String id) {
            new Thread(() -> {
                String key = Store.get(MainActivity.this, "gemini_key", "");
                Net.Res r = key.isEmpty()
                        ? new Net.Res(401, "{\"error\":{\"message\":\"API key not set\"}}")
                        : Net.request("POST", Net.geminiUrl(model), body, geminiHeaders(key));
                js("window.__httpCb(" + JSONObject.quote(id) + "," + r.code + "," + JSONObject.quote(r.text) + ")");
            }).start();
        }

        /** Background removal: JPEG/PNG data URL in, transparent PNG data URL out via window.__cutCb(id, png, err). */
        @JavascriptInterface
        public void cutout(final String dataUrl, final String id) {
            Cutout.run(dataUrl, (png, err) -> js("window.__cutCb(" + JSONObject.quote(id) + ","
                    + (png == null ? "null" : JSONObject.quote(png)) + "," + (err == null ? "null" : JSONObject.quote(err)) + ")"));
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
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
            android.app.NotificationManager nm = getSystemService(android.app.NotificationManager.class);
            return nm == null || nm.areNotificationsEnabled();
        }

        /** Speech → text (Google voice input, Ukrainian); result via window.__voiceCb(text). */
        @JavascriptInterface
        public void voice() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "uk-UA");
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Скажіть, що додати");
                    startActivityForResult(i, REQ_VOICE);
                } catch (Exception e) {
                    js("window.__voiceCb&&window.__voiceCb('',true)");
                }
            });
        }

        /** Own-UI listening (needs the microphone permission once). */
        @JavascriptInterface
        public void listenStart() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startListening();
                else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            });
        }

        @JavascriptInterface
        public void listenStop(boolean cancel) {
            runOnUiThread(() -> { if (recognizer == null) return; if (cancel) { recognizer.cancel(); } else recognizer.stopListening(); });
        }

        /** Auto-backup: choose where the copy lives (any folder or Google Drive). */
        @JavascriptInterface
        public void pickBackup() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json");
                    i.putExtra(Intent.EXTRA_TITLE, "LAD-backup.json");
                    startActivityForResult(i, REQ_BK_CREATE);
                } catch (Exception e) { js("window.__bkPicked&&window.__bkPicked(false)"); }
            });
        }

        @JavascriptInterface
        public boolean hasBackup() { return !Store.get(MainActivity.this, "backup_uri", "").isEmpty(); }

        @JavascriptInterface
        public String backupName() {
            String u = Store.get(MainActivity.this, "backup_uri", "");
            if (u.isEmpty()) return "";
            try (android.database.Cursor c = getContentResolver().query(Uri.parse(u), new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) return c.getString(0);
            } catch (Exception ignored) {}
            return "LAD-backup.json";
        }

        /** Overwrites the chosen backup file; returns true on success. */
        @JavascriptInterface
        public boolean writeBackup(String json) {
            String u = Store.get(MainActivity.this, "backup_uri", "");
            if (u.isEmpty()) return false;
            try (java.io.OutputStream o = getContentResolver().openOutputStream(Uri.parse(u), "wt")) {
                if (o == null) return false;
                o.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void forgetBackup() { Store.put(MainActivity.this, "backup_uri", null); }

        /** Pick a backup file to restore; text via window.__bkOpened(text). */
        @JavascriptInterface
        public void openBackup() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
                    startActivityForResult(i, REQ_BK_OPEN);
                } catch (Exception e) { js("window.__bkOpened&&window.__bkOpened('')"); }
            });
        }

        /** Home-screen widget data (today/tomorrow items, weather, goals). */
        @JavascriptInterface
        public void setWidget(String json) { TodayWidget.save(MainActivity.this, json); }

        /** Goal ticks made on the widget since the app was last opened; cleared on read. */
        @JavascriptInterface
        public String takeWidgetToggles() {
            String q = Store.get(MainActivity.this, "w_toggles", "[]");
            Store.put(MainActivity.this, "w_toggles", null);
            return q;
        }

        /** Short haptic feedback: tick | heavy | success */
        @JavascriptInterface
        public void vibrate(String kind) {
            try {
                android.os.Vibrator v;
                if (Build.VERSION.SDK_INT >= 31) v = ((android.os.VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator();
                else v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                android.os.VibrationEffect e;
                if ("success".equals(kind)) e = android.os.VibrationEffect.createWaveform(new long[]{0, 18, 70, 30}, -1);
                else if ("heavy".equals(kind)) e = android.os.VibrationEffect.createPredefined(android.os.VibrationEffect.EFFECT_HEAVY_CLICK);
                else e = android.os.VibrationEffect.createPredefined(android.os.VibrationEffect.EFFECT_TICK);
                v.vibrate(e);
            } catch (Exception ignored) {}
        }

        /** Schedules a test reminder in `sec` seconds (checks the alarm path, not only notifications). */
        @JavascriptInterface
        public void testAlarm(int sec) {
            Reminders.test(MainActivity.this, Math.max(10, Math.min(sec, 600)));
        }

        /** Shows a notification right now (Settings → «Перевірити сповіщення»). */
        @JavascriptInterface
        public void notifyNow(String title, String text) {
            Reminders.show(MainActivity.this, 999, Reminders.CHANNEL, title, text);
        }

        /** Opens the system notification settings of the app. */
        @JavascriptInterface
        public void openNotifSettings() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(i);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Відкрийте налаштування телефона → Програми → ЛАД → Сповіщення", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
            } else {
                js("window.__notifPerm&&window.__notifPerm(true)");
            }
        }

        /** Launcher icon chosen in Settings (activity-alias .Icon_<id>). */
        @JavascriptInterface
        public String getIcon() {
            PackageManager pm = getPackageManager();
            for (String id : ICONS) {
                int st = pm.getComponentEnabledSetting(new android.content.ComponentName(MainActivity.this, ICON_PKG + ".Icon_" + id));
                if (st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return id;
            }
            return "black";
        }

        @JavascriptInterface
        public void setIcon(final String id) {
            boolean known = false;
            for (String x : ICONS) if (x.equals(id)) known = true;
            if (!known) return;
            PackageManager pm = getPackageManager();
            // enable the new one first so the app never has zero launcher entries
            pm.setComponentEnabledSetting(new android.content.ComponentName(MainActivity.this, ICON_PKG + ".Icon_" + id),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String x : ICONS) if (!x.equals(id)) pm.setComponentEnabledSetting(new android.content.ComponentName(MainActivity.this, ICON_PKG + ".Icon_" + x),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }

        /** JS tells whether a PIN lock is on, so the next start can cover the content natively. */
        @JavascriptInterface
        public void setLock(boolean on) {
            prefs().edit().putBoolean("lock_on", on).apply();
        }

        /** The JS lock screen (or the app itself, when no lock is needed) has been drawn. */
        @JavascriptInterface
        public void lockReady() {
            runOnUiThread(() -> { if (cover != null) cover.postDelayed(MainActivity.this::hideCover, 60); });
        }

        /** Fingerprint / face unlock is available and enrolled on this device. */
        @JavascriptInterface
        public boolean canBiometric() {
            try {
                if (Build.VERSION.SDK_INT >= 30) {
                    BiometricManager bm = getSystemService(BiometricManager.class);
                    return bm != null && bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS;
                }
                if (Build.VERSION.SDK_INT >= 29) {
                    BiometricManager bm = getSystemService(BiometricManager.class);
                    return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
                }
                return Build.VERSION.SDK_INT >= 28 && getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
            } catch (Exception e) {
                return false;
            }
        }

        /** Shows the system biometric prompt; result goes to window.__bioCb(ok, cancelled). */
        @JavascriptInterface
        public void biometric(final String title) {
            if (Build.VERSION.SDK_INT < 28) { js("window.__bioCb&&window.__bioCb(false,true)"); return; }
            runOnUiThread(() -> {
                try {
                    BiometricPrompt.Builder b = new BiometricPrompt.Builder(MainActivity.this)
                            .setTitle(title == null || title.isEmpty() ? "ЛАД" : title)
                            .setSubtitle("Прикладіть палець або подивіться в камеру")
                            .setNegativeButton("Ввести PIN-код", getMainExecutor(), (d, w) -> js("window.__bioCb&&window.__bioCb(false,true)"));
                    if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK);
                    b.build().authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            js("window.__bioCb&&window.__bioCb(true,false)");
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence msg) {
                            js("window.__bioCb&&window.__bioCb(false,true)");
                        }
                    });
                } catch (Exception e) {
                    js("window.__bioCb&&window.__bioCb(false,true)");
                }
            });
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
                prefs().edit().putInt("bg_color", color).apply();
                if (cover != null) cover.setBackgroundColor(color);
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
