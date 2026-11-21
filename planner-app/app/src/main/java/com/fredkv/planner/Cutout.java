package com.fredkv.planner;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions;

import java.io.ByteArrayOutputStream;

/** On-device background removal (ML Kit Subject Segmentation). Result: PNG with transparent background, cropped to the object. */
final class Cutout {
    private Cutout() {}

    interface Callback { void done(String pngDataUrl, String error); }

    private static SubjectSegmenter segmenter;

    private static synchronized SubjectSegmenter client() {
        if (segmenter == null) {
            SubjectSegmenterOptions opts = new SubjectSegmenterOptions.Builder()
                    .enableForegroundBitmap()
                    .build();
            segmenter = SubjectSegmentation.getClient(opts);
        }
        return segmenter;
    }

    static void run(String dataUrl, Callback cb) {
        final Bitmap src;
        try {
            String b64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (b == null) { cb.done(null, "Не вдалося прочитати фото"); return; }
            float k = Math.min(1f, 1280f / Math.max(b.getWidth(), b.getHeight()));
            src = k < 1f ? Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true) : b;
        } catch (Throwable e) { cb.done(null, "Не вдалося прочитати фото"); return; }
        try {
            client().process(InputImage.fromBitmap(src, 0))
                    .addOnSuccessListener(result -> new Thread(() -> {
                        Bitmap fg = result.getForegroundBitmap();
                        if (fg == null) { cb.done(null, "Обʼєкт на фото не знайдено"); return; }
                        Bitmap crop = cropToContent(fg);
                        if (crop == null) { cb.done(null, "Обʼєкт на фото не знайдено"); return; }
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        crop.compress(Bitmap.CompressFormat.PNG, 100, bo);
                        cb.done("data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP), null);
                    }).start())
                    .addOnFailureListener(e -> {
                        String m = String.valueOf(e.getMessage());
                        cb.done(null, m.toLowerCase().contains("download") || m.toLowerCase().contains("waiting")
                                ? "Модуль вирізання фону ще завантажується Google Play. Спробуйте за хвилину."
                                : "Не вдалося вирізати фон: " + m);
                    });
        } catch (Throwable e) {
            cb.done(null, "Вирізання фону недоступне на цьому телефоні (потрібні сервіси Google Play)");
        }
    }

    /** Crops away fully transparent borders (+4% padding). */
    private static Bitmap cropToContent(Bitmap b) {
        int w = b.getWidth(), h = b.getHeight();
        int[] px = new int[w * h];
        b.getPixels(px, 0, w, 0, 0, w, h);
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
            int row = y * w;
            for (int x = 0; x < w; x++) {
                if ((px[row + x] >>> 24) > 16) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0 || (maxX - minX) < 8 || (maxY - minY) < 8) return null;
        int pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04f);
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
        return Bitmap.createBitmap(b, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }
}
