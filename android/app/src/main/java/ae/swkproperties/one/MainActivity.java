package ae.swkproperties.one;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * SWK ONE (ae.swkproperties.one): the bundled SWK ONE workspace served from https://localhost by
 * WebViewAssetLoader, plus the native bridge (duty location service, biometrics, device identity).
 *
 * Security model: the bridge is only reachable by the bundled app. The WebView never navigates to another origin;
 * every other link is handed to the system (browser, dialer, mail, maps), and camera / location grants are given to
 * the app origin only.
 */
public class MainActivity extends AppCompatActivity {
    private static final String APP_HOST = "localhost";
    private static final String START_URL = "https://" + APP_HOST + "/swk-one?platform=android";
    private static final long SPLASH_MAX_MS = 2500L;

    private WebView webView;
    private SwkNativePlugin nativeBridge;
    private boolean pageReady = false;
    private boolean dutyEndedWhileAway = false;

    private ValueCallback<Uri[]> fileCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<String[]> permissionLauncher;

    // Web requests waiting for an Android runtime permission result
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private PermissionRequest pendingWebPermission;

    private final BroadcastReceiver dutyEndedReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (webView != null && !isFinishing()) dispatchToWeb("swk:duty-ended");
            else dutyEndedWhileAway = true;
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final long startedAt = SystemClock.uptimeMillis();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !pageReady && SystemClock.uptimeMillis() - startedAt < SPLASH_MAX_MS);
        super.onCreate(savedInstanceState);

        fileChooserLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
            if (fileCallback == null) return;
            Uri[] uris = null;
            if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                uris = WebChromeClient.FileChooserParams.parseResult(r.getResultCode(), r.getData());
            }
            fileCallback.onReceiveValue(uris);
            fileCallback = null;
        });
        permissionLauncher = registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), this::onPermissionsResult);

        webView = new WebView(this);
        webView.setBackgroundColor(ContextCompat.getColor(this, R.color.swk_midnight));
        setContentView(webView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);

        nativeBridge = new SwkNativePlugin(this, webView);
        webView.addJavascriptInterface(nativeBridge, "SwkAndroidBridge");

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .setDomain(APP_HOST)
            .addPathHandler("/", this::loadBundledAsset)
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost())) return false;
                openExternally(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!isAppOrigin(origin)) {
                    callback.invoke(origin, false, false);
                } else if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    permissionLauncher.launch(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION});
                }
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    fileChooserLauncher.launch(params.createIntent());
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) webView.goBack();
                else finish();
            }
        });

        ContextCompat.registerReceiver(this, dutyEndedReceiver, new IntentFilter(SwkDutyLocationService.ACTION_DUTY_ENDED), ContextCompat.RECEIVER_NOT_EXPORTED);

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        if (webView.getUrl() == null) webView.loadUrl(START_URL);
    }

    /** Called by the bridge before a duty starts: location is required, notifications are advisory (Android 13+). */
    void requestDutyPermissions() {
        List<String> needed = new ArrayList<>();
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!needed.isEmpty()) permissionLauncher.launch(needed.toArray(new String[0]));
    }

    private void onPermissionsResult(java.util.Map<String, Boolean> result) {
        boolean location = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION);
        if (pendingGeoCallback != null) {
            pendingGeoCallback.invoke(pendingGeoOrigin, location, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        }
        if (pendingWebPermission != null) {
            handleWebPermission(pendingWebPermission);
            pendingWebPermission = null;
        }
        dispatchToWeb(location ? "swk:location-permission-granted" : "swk:location-permission-denied");
    }

    private void handleWebPermission(PermissionRequest request) {
        if (!isAppOrigin(request.getOrigin().toString())) {
            request.deny();
            return;
        }
        List<String> grant = new ArrayList<>();
        boolean needCamera = false;
        for (String res : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                if (hasPermission(Manifest.permission.CAMERA)) grant.add(res);
                else needCamera = true;
            }
            // Microphone and DRM are never needed by SWK ONE: not granted.
        }
        if (needCamera && pendingWebPermission == null) {
            pendingWebPermission = request;
            permissionLauncher.launch(new String[] {Manifest.permission.CAMERA});
            return;
        }
        if (grant.isEmpty()) request.deny();
        else request.grant(grant.toArray(new String[0]));
    }

    private boolean hasPermission(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean isAppOrigin(String origin) {
        if (origin == null) return false;
        Uri uri = Uri.parse(origin);
        return "https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost());
    }

    private void openExternally(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        Intent intent;
        switch (scheme) {
            case "http":
            case "https":
            case "geo":
                intent = new Intent(Intent.ACTION_VIEW, uri);
                break;
            case "tel":
                intent = new Intent(Intent.ACTION_DIAL, uri);
                break;
            case "mailto":
                intent = new Intent(Intent.ACTION_SENDTO, uri);
                break;
            case "sms":
            case "smsto":
                intent = new Intent(Intent.ACTION_SENDTO, uri);
                break;
            default:
                return; // unknown schemes (intent:, file:, javascript:, ...) are dropped
        }
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // no app can handle it
        }
    }

    private WebResourceResponse loadBundledAsset(String path) {
        String clean = path == null ? "" : (path.startsWith("/") ? path.substring(1) : path);
        if (clean.isEmpty()) clean = "index.html";
        try {
            InputStream is = getAssets().open("public/" + clean);
            return new WebResourceResponse(mimeType(clean), "UTF-8", is);
        } catch (Exception notAFile) {
            String last = clean.substring(clean.lastIndexOf('/') + 1);
            boolean isRoute = !last.contains(".") && !clean.startsWith("api/");
            if (isRoute) {
                // SPA route (/swk-one, /login, ...) -> index.html
                try {
                    return new WebResourceResponse("text/html", "UTF-8", getAssets().open("public/index.html"));
                } catch (Exception ignored) {
                    // fall through to 404
                }
            }
            // A missing file or an API call that reached the local origin must fail loudly, not return HTML.
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
    }

    @NonNull
    private static String mimeType(@NonNull String path) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(path).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html";
            case "js":
            case "mjs": return "application/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "svg": return "image/svg+xml";
            case "woff2": return "font/woff2";
            case "woff": return "font/woff";
            case "webp": return "image/webp";
            case "ico": return "image/x-icon";
            default:
                String guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return guessed != null ? guessed : "application/octet-stream";
        }
    }

    private void dispatchToWeb(String eventName) {
        if (webView != null) webView.evaluateJavascript("window.dispatchEvent(new Event('" + eventName + "'));", null);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (dutyEndedWhileAway) {
            dutyEndedWhileAway = false;
            dispatchToWeb("swk:duty-ended");
        }
    }

    @Override
    protected void onPause() {
        // While a duty is active the page keeps running so timers and the UI stay in step with the service.
        if (webView != null && !SwkDutyLocationService.isRunning()) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(dutyEndedReceiver);
        } catch (IllegalArgumentException ignored) {
            // not registered
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            if (webView.getParent() instanceof ViewGroup) ((ViewGroup) webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
