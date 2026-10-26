# SWK ONE for Android

`ae.swkproperties.one` is a native Android shell around the SWK ONE web app (`src/web/mobile`). The bundled UI is served from
`https://localhost` inside a WebView and talks to the company server (`https://os.swkpropertiesuae.com` by default, changeable at
sign-in). Native code only does what a browser cannot: the foreground duty-location service, biometric unlock and device identity.

## Build

```bash
npm ci
npm run android:sync          # builds the web app and copies it into android/app/src/main/assets/public
cd android && gradle assembleDebug     # app/build/outputs/apk/debug/app-debug.apk (id ae.swkproperties.one.debug)
```

Requires JDK 17+ and the Android SDK (platform 34). CI (`.github/workflows/android-apk.yml`) also runs typecheck, the SWK ONE and
mobile API tests and `lintDebug`. A signed release APK (`ae.swkproperties.one`, R8-minified) is built when the repository secrets
`SWK_KEYSTORE_B64`, `SWK_KEYSTORE_PASSWORD`, `SWK_KEY_ALIAS` and `SWK_KEY_PASSWORD` exist; locally set `SWK_KEYSTORE_FILE` and the
same variables, then `gradle assembleRelease`.

## Icons

Everything comes from `assets-src/swk-logo.png` (the official white mark) through `python3 tools/android/generate-icons.py`
(needs Pillow). It resizes with Lanczos and writes exact Android density sizes (everything is a down-scale except the splash icon
on xxhdpi/xxxhdpi screens, up to 1.4x):

* adaptive launcher icon (foreground inside the 66 dp safe zone, navy `#0B1A33` background, Android 13 themed monochrome layer),
* status-bar glyph (`ic_stat_swk`), Android 12 splash icon, Play Store icon
  (`android/app/src/main/ic_launcher-playstore.png`, 512x512),
* the web app's PWA icons and favicons in `public/`.

`npm run android:sync` does **not** touch icons. To change the brand colour edit `BACKGROUND` in the script and re-run it.
The source mark is 339x275 px, so a vector (SVG) master would be the next step if icons larger than 512 px are ever needed.

## Duty location sharing

Starting a duty creates the session on the server, then `SwkDutyLocationService` (foreground service, `location` type, persistent
notification with an *End field duty* button) collects fixes and posts them in batches to
`/api/swk-one/field-duty/{id}/location-batch` with the staff session token. Nothing is collected before a duty starts or after it
ends, and the app never asks for background-location permission. The server rejects batches for sessions that are not the caller's,
that have ended or whose scheduled window has passed, and any fix flagged as coming from a mock provider.

## Check-in, arrival and offline rules (server)

* The reception QR / 6-digit code is only visible to HR/reception users (`GET /api/swk-one/reception-qr/current`); staff phones scan it
  with the camera. A missing, unknown or expired (>15 s) code is never `Verified`.
* If `SWK_OFFICE_LAT`, `SWK_OFFICE_LNG` and `SWK_OFFICE_RADIUS_M` are set, a check-in is `Verified` only when the GPS fix is inside that
  area. The Wi-Fi name is a client claim and can only make a check-in doubtful, never verified.
* Viewing arrival needs a real fix and is `Verified` only within 300 m of the property; otherwise it is queued for manager review.
* Offline items are replayed through the endpoint they were created for (allow-listed), once per idempotency key; items the server
  rejects stay in the queue.
* Sample HR/agent/compliance records and the "Initialize SWK ONE" demo data are created only outside production or inside the demo
  workspace. A real workspace needs the user linked to a real employee record by HR.

## Before publishing to Google Play

Target SDK is 34. Google Play currently requires a newer target; moving to 35/36 also means handling edge-to-edge insets in
`MainActivity` and AGP/Gradle upgrades. Sideloaded/enterprise APKs are not affected.
