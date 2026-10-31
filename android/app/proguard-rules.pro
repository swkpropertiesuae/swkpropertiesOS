# SWK ONE: the web UI calls these through window.SwkAndroidBridge; R8 must not rename or strip them.
-keepclassmembers class ae.swkproperties.one.SwkNativePlugin {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
