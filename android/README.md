# SWK ONE — native Android workspace

SWK ONE is a Kotlin / Jetpack Compose Android application (`ae.swk.one`). It has no WebView, browser shell, PWA dependency or embedded web UI. Android 8+ is supported; the project targets Android 15 (API 35). It uses the existing SWK OS Fastify API and database, including server-side permissions, sessions, TOTP, record validation, report evidence calculations and business workflows.

## What is implemented

- Branded emerald/graphite native interface: Today, Workspaces, Field Duty, Account; light/dark system theme, RTL layout support, touch controls and native back navigation.
- Existing-account sign-in, authenticator challenge, mandatory password change, password changes and logout. Session cookies use Android Keystore AES-GCM encrypted storage. No API key is embedded in the application.
- Permission-filtered metadata-driven native record browsing, search, pagination, details, create/edit forms, selects, reference searches, boolean and numeric fields. Business rules remain on the server. Includes accessible existing records for leads, inventory, NOCs, viewings, leave, commissions, compliance, tasks, training and other modules.
- Explicit native workflow dialogs for reports, inventory approval, NOC stages, transaction exceptions, commission approval, leave decisions, knowledge acknowledgements, authorisations, communication supervision, protected lead reassignment, assigned work, universal approvals, QA and compliance appeals. Server eligibility rules can reject an action; the app displays the error.
- Record comments, private native PDF/image previews and system file-picker uploads of photos/PDFs/text linked to business records (10 MB native limit). The app does not request broad media library access. Record children are displayed, but nested child editing is not implemented.
- Personal workday endpoint derives employee identity from the authenticated session. Daily reports derive system evidence from backend records, submit atomically and freeze. Optional encrypted on-device report drafts; submission requires a connection.
- GPS office proximity attendance with explicit in/out actions, fresh-location validation, accuracy margin, mock flag rejection, server timestamps and duplicate protection. Verified coordinates must be configured first. This is **not proof of indoor office entry**, anti-spoof certification or a dynamic QR system. Records remain unverified for manager review.
- Assigned field-duty sessions: employee starts while app is visible; persistent Android location notification; Stop action; scheduled deadline; own-session-only uploads; off-duty rejection. The service never starts at boot and does not silently resume after process death. Safety assistance flags the shared record for review; it does **not** contact emergency services or deliver guaranteed alerts.
- Screenshot protection, disabled application backup, HTTPS only, no network logging or credentials in notifications, optional biometric/device credential app lock. Server logout revokes the session. Existing SWK OS admin session revocation also applies to native clients.
- Build / unit-test / lint / APK-artifact CI in `.github/workflows/android.yml`; native API isolation test in `tests/mobile.ts`.

## Build and install a test APK

1. Open this `android` folder in Android Studio, with JDK 17 and Android SDK 35 installed.
2. Sync Gradle. Build using `./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` (Windows: `gradlew.bat`).
3. Install `app/build/outputs/apk/debug/app-debug.apk` on a test phone. Allow installation from your chosen trusted file source when Android asks.
4. Deploy the backend changes in the same branch before testing new `/api/mobile/*` features. Existing metadata/record APIs use the current backend as-is.
5. Sign in with the user's existing SWK OS account. HR must link the account to an active Employee record. Roles still determine which workspaces are available.

GitHub Actions also builds a test APK on pushes/PRs affecting Android. Download `SWK-ONE-Android-test-APK` from a successful run. CI-generated debug keys are temporary and are not a controlled upgrade/signing strategy; do not roll this test APK out company-wide as a production release.

The compiled backend URL is `https://os.swkpropertiesuae.com/`. Confirm that this host serves the deployed SWK OS API before installation. The app does not silently switch endpoints or fall back to sample data. For another deployment, change `API_BASE_URL` in `app/build.gradle.kts` and rebuild. Never put secrets in that field.

## Office check-in configuration

Set these environment variables **on the existing API server**:

```dotenv
# Obtain the actual office entrance coordinates; do not copy illustrative map points.
SWK_OFFICE_LAT=
SWK_OFFICE_LNG=
SWK_OFFICE_RADIUS_M=
```

The radius must be 10–500 metres. Check-in fails closed until all three are valid. `distance + reported accuracy` must be inside the radius. A phone's reported mock flag is only one risk signal; it is not hardware attestation. Additional independently verified office-entry evidence is required for stronger attendance assurance. The existing web clock endpoint remains unchanged and is not upgraded to enforce this native geofence.

## Duty location and timestamps

SWK OS entity timestamps currently store workflow UTC wall time at minute precision without an offset. The mobile API explicitly interprets those values as UTC; the phone's timezone cannot extend duty. Native telemetry captures an ISO UTC instant. Field sharing rejects stale, inaccurate and mock-tagged samples. It sends every ~60 seconds / 25 metres while fixes are available, and stops after repeated failures, revocation or deadline. Last-known coordinates are not a guarantee of live presence. Android/OEM power policies may interrupt delivery; test on the actual company phones.

Assignments are created through SWK OS. Native workday refresh expires this user's overdue active assignments. Existing company-wide scheduled expiry/retention behaviour must be assessed separately. This implementation does not add a global retention worker or store historical location tracks. Never infer work performance from GPS distance or connectivity failures.

## Production acceptance still required

This is an initial native implementation, not certification that all 65 proposed features or enterprise release criteria are complete. See [feature coverage](../docs/ANDROID_FEATURE_COVERAGE.md).

Before staff rollout: successful Android CI, physical-device testing (permissions, notification Stop, deadline, process death, offline use, session revocation and screen lock), confirmed production backend URL, staff-role review of the existing generic API row-access policy, accessibility/Arabic copy QA, and stable organisation-owned release signing plus an update/distribution process. Existing module-level access is retained; this change does not redefine staff ownership rules for every generic entity.

Not implemented: push delivery, automatic background offline event sync, native OCR/camera analysis, AI lead briefing/reply/translation UI, routed SOS notifications, device registration/attestation, short-lived mobile token exchange, offline business-record cache, property comparison/alternative recommendation, native WhatsApp message send/thread view, or complete nested record/finance editors. Existing business records for some of these areas can still be managed through native Workspaces.

Release keys and signing passwords must be held by SWK and injected privately by CI/Android Studio; never commit them. Google Play distribution is optional and separate. No production deployment or app-store submission is performed by adding this project.
