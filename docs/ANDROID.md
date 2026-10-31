# SWK ONE for Android (`v1.0.0`)

`ae.swkproperties.one` is the native Android field & attendance application for **SWK Properties LLC (Dubai, UAE)** (`src/web/mobile/SwkOneApp.tsx` + `android/`). The bundled UI is served from `https://localhost` inside a WebView and connects to `https://os.swkpropertiesuae.com` by default.

## Core UAE Real Estate Field Capabilities

1. **Official Working Hours & 10:05 AM Grace Period (`Asia/Dubai`)**:
   - **Monday – Friday**: `10:00 AM – 7:00 PM` (`19:00`)
   - **Saturday**: `10:00 AM – 4:00 PM` (`16:00`)
   - **Sunday**: Official Holiday (supports logging client-based variable hours when a Sales Advisor attends scheduled Sunday viewings/meetings)
   - **Grace Window**: Check-in up to **10:05 AM** is recorded as **On-Time**; **10:06 AM+** is marked **Late** with exact late minutes.
   - **Continuous Contemptor Detection**: 3 or more late check-ins (`>10:05 AM`) within 7 rolling days automatically alerts Owner **Shabib Siraj** and Manager **Mohammad Haseeb**.

2. **Dual Check-In Modes**:
   - **In-Office Reception QR Scan**: Scans the rotating 15-second QR / 6-digit code displayed on the Reception terminal (`/swk/reception-qr` → `POST /api/swk-one/attendance/qr-check-in`).
   - **Out-of-Office Site Visit (Live GPS Check-In)**: When a Sales Advisor is outside the office for a scheduled site visit, checking in via live GPS on `/api/swk-one/viewings/:id/arrive` or starting a field session automatically registers their attendance check-in (`Field Site Visit Live GPS`) and links it to the viewing schedule.

3. **Mandatory Checkout Gate (`GET /api/swk-one/checkout-gate`)**:
   - A Sales Advisor **cannot check out** (from office or field) until:
     1. Every scheduled site visit (`viewings`) for today has its arrival and client outcome recorded, **AND**
     2. Today's **Daily Report (`daily_reports`)** has been submitted (`POST /api/swk-one/daily-reports`).

4. **Site-Visit Area Companion & UAE Mortgage Calculator**:
   - Gives the Sales Advisor live stock-style area metrics (price/sqft, YoY change, rental yield), nearby landmarks & metro connectivity, ongoing developments, a **15-year future outlook (2026–2041)**, and **top closing pitch keywords** to excite the client during the viewing.

## Build Commands

```bash
npm ci
npm run android:sync          # builds the web app and copies it into android/app/src/main/assets/public
cd android && ./gradlew assembleDebug   # outputs app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 17+ and Android SDK (platform 34). GitHub Actions (`.github/workflows/android-apk.yml`) automatically runs `npm run typecheck`, `tests/swk-one-android.ts`, `tests/mobile.ts`, `lintDebug`, and `assembleDebug` on every push and uploads the `swk-one-android-debug-apk` artifact.
