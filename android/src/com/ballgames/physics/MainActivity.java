package com.ballgames.physics;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** Full-screen WebView that runs the game bundled in assets/www. */
public class MainActivity extends Activity implements ValueCallback<String> {
    private static final int REQ_STORAGE = 7;
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFFB9ECFB);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "BGNative");
        setContentView(web);
        hideSystemUi();
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // let the game handle back (pause / close panels); exit only from the main menu
        web.evaluateJavascript("(window.__back && window.__back()) ? 1 : 0", this);
    }

    /** Result of the back-button query above. */
    @Override
    public void onReceiveValue(String value) {
        if (!"1".equals(value)) finish();
    }

    /** Answer to the storage permission asked before saving a highlight video (Android 6 to 9). */
    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code != REQ_STORAGE) return;
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        web.evaluateJavascript("window.__perm && window.__perm(" + ok + ")", null);
    }

    private static byte[] readAll(File f) throws IOException {
        InputStream in = new FileInputStream(f);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) f.length());
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    /**
     * Called from the game (window.BGNative): match highlights kept as files inside the app,
     * and highlight videos saved where the gallery finds them (Movies/Ballgames).
     */
    public class Bridge {
        private OutputStream video;
        private Uri videoUri;
        private File videoFile;

        private File highlightFile(String id) {
            File dir = new File(getFilesDir(), "highlights");
            if (!dir.exists()) dir.mkdirs();
            return new File(dir, id.replaceAll("[^A-Za-z0-9_-]", "_") + ".bgh");
        }

        /** Stores one match's highlight; false when it could not be written (e.g. the phone is full). */
        @JavascriptInterface
        public boolean hlPut(String id, String base64) {
            File f = highlightFile(id), tmp = new File(f.getPath() + ".tmp");
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                OutputStream out = new FileOutputStream(tmp);
                try {
                    out.write(data);
                } finally {
                    out.close();
                }
                if (f.exists()) f.delete();
                return tmp.renameTo(f);
            } catch (Exception e) {
                tmp.delete();
                return false;
            }
        }

        @JavascriptInterface
        public String hlGet(String id) {
            File f = highlightFile(id);
            if (!f.exists()) return null;
            try {
                return Base64.encodeToString(readAll(f), Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public void hlDel(String id) {
            highlightFile(id).delete();
        }

        @JavascriptInterface
        public boolean needsStoragePermission() {
            return Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT < 29
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= 23) {
                        requestPermissions(new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, REQ_STORAGE);
                    } else {
                        web.evaluateJavascript("window.__perm && window.__perm(true)", null);
                    }
                }
            });
        }

        /**
         * Starts a video file; returns where it goes (shown to the player) or "" on failure.
         * Android 10+: Movies/Ballgames through the media store, no permission needed. Older: the same
         * folder with the storage permission, otherwise the app's own Movies folder.
         */
        @JavascriptInterface
        public String videoBegin(String name, boolean publicDir) {
            videoAbort();
            name = name.replaceAll("[^A-Za-z0-9_.-]", "_");
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, "video/webm");
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Ballgames");
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    videoUri = getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, cv);
                    if (videoUri == null) return "";
                    video = getContentResolver().openOutputStream(videoUri);
                    return video == null ? "" : "Movies/Ballgames/" + name;
                }
                File dir;
                String label;
                if (publicDir) {
                    dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "Ballgames");
                    label = "Movies/Ballgames/";
                } else {
                    dir = getExternalFilesDir(Environment.DIRECTORY_MOVIES);
                    label = "Android/data/" + getPackageName() + "/files/Movies/";
                }
                if (dir == null) return "";
                if (!dir.exists()) dir.mkdirs();
                videoFile = new File(dir, name);
                video = new FileOutputStream(videoFile);
                return label + name;
            } catch (Exception e) {
                videoAbort();
                return "";
            }
        }

        @JavascriptInterface
        public boolean videoChunk(String base64) {
            if (video == null) return false;
            try {
                video.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean videoEnd() {
            if (video == null) return false;
            try {
                video.close();
                video = null;
                if (videoUri != null) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(videoUri, cv, null, null);
                    videoUri = null;
                } else if (videoFile != null) {
                    MediaScannerConnection.scanFile(MainActivity.this, new String[] { videoFile.getAbsolutePath() },
                            new String[] { "video/webm" }, null);
                    videoFile = null;
                }
                return true;
            } catch (Exception e) {
                videoAbort();
                return false;
            }
        }

        @JavascriptInterface
        public void videoAbort() {
            try {
                if (video != null) video.close();
            } catch (IOException e) {
                // closing a broken stream: nothing more to do
            }
            video = null;
            if (videoUri != null) {
                try {
                    getContentResolver().delete(videoUri, null, null);
                } catch (Exception e) {
                    // already gone
                }
                videoUri = null;
            }
            if (videoFile != null) {
                videoFile.delete();
                videoFile = null;
            }
        }
    }
}
