package ae.swkproperties.one;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * MainActivity for SWK ONE (ae.swkproperties.one)
 * Standalone enterprise Android container hosting the bundled SWK ONE workspace via HTTPS WebViewAssetLoader
 * and exposing native hardware capabilities (Foreground Duty Location Service, BiometricPrompt, Device ID)
 * through window.SwkAndroidBridge.
 */
public class MainActivity extends AppCompatActivity {
    private static final int REQ_RUNTIME_PERMISSIONS = 4001;
    private WebView webView;
    private SwkNativePlugin nativeBridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestRequiredPermissionsIfNeeded();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        nativeBridge = new SwkNativePlugin(this, webView);
        webView.addJavascriptInterface(nativeBridge, "SwkAndroidBridge");

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("localhost")
            .addPathHandler("/", path -> {
                try {
                    String cleanPath = (path == null || path.isEmpty() || path.equals("/"))
                        ? "index.html"
                        : (path.startsWith("/") ? path.substring(1) : path);
                    InputStream is = getAssets().open("public/" + cleanPath);
                    String mime = guessMimeType(cleanPath);
                    return new WebResourceResponse(mime, "UTF-8", is);
                } catch (Exception e) {
                    // SPA route fallback (/swk-one, /login, etc.) -> serve public/index.html
                    try {
                        InputStream indexStream = getAssets().open("public/index.html");
                        return new WebResourceResponse("text/html", "UTF-8", indexStream);
                    } catch (Exception ex) {
                        return null;
                    }
                }
            })
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        webView.loadUrl("https://localhost/swk-one?platform=android");
    }

    private void requestRequiredPermissionsIfNeeded() {
        List<String> needed = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), REQ_RUNTIME_PERMISSIONS);
        }
    }

    @NonNull
    private String guessMimeType(@NonNull String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }
}
