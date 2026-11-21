package com.fredkv.planner;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class Net {
    private Net() {}

    static final class Res {
        int code; String text;
        Res(int c, String t) { code = c; text = t; }
    }

    static Res request(String method, String url, String body) { return request(method, url, body, null); }

    static Res request(String method, String url, String body, org.json.JSONObject headers) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(20000);
            c.setReadTimeout(45000);
            c.setRequestProperty("Accept", "application/json");
            if (headers != null) {
                java.util.Iterator<String> it = headers.keys();
                while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, headers.optString(k)); }
            }
            if (body != null && !"GET".equals(method)) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            String text = in == null ? "" : readAll(in);
            c.disconnect();
            return new Res(code, text);
        } catch (Exception e) {
            return new Res(0, e.toString());
        }
    }

    static String geminiUrl(String model) {
        try {
            return "https://generativelanguage.googleapis.com/v1beta/models/"
                    + java.net.URLEncoder.encode(model, "UTF-8") + ":generateContent";
        } catch (Exception e) { return ""; }
    }

    static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        return bo.toString("UTF-8");
    }
}
