# TLBC

The frontend brand mark and welcome slideshow are bundled from
`frontend/public/images/logo/` and `frontend/public/images/slideshow/`. To update
the slideshow, add or replace static files in that folder and register them in
`frontend/src/utils/localSlideshow.js`; the changes are included in the next
frontend build.

The public website includes an upcoming-events calendar at `/events` and a
church ministries page at `/ministries`. Administrators manage public events
and edit ministry descriptions from the Admin dashboard. Active registered
users receive an in-app event reminder at 9:00 AM (church timezone) on the day
before a published event; opted-in devices also receive a push notification.
The calendar also lists the recurring Sunday Worship Celebration at 8:30 AM
onwards.

## Quality and operating requirements

- Run `npm run check` and `npm run audit` from the repository root before
  merging. GitHub Actions runs both on pushes and pull requests using Node 22.
- Run `npm run test:e2e` for Playwright checks of public pages, connectivity
  feedback, calendar export, and a mocked authenticated member flow. These
  browser checks use test-only Firebase/API responses rather than live
  credentials.
- The frontend supports current and previous major releases of Chrome, Edge,
  Firefox, and Safari. Test public pages and authenticated dashboards at mobile
  and desktop widths; target WCAG 2.2 AA for keyboard access, focus visibility,
  readable contrast, and reduced-motion preferences.
- Church-local date-only values must use the same zone in the API and frontend.
  Keep backend `CHURCH_TIME_ZONE` and frontend `VITE_CHURCH_TIME_ZONE` aligned;
  both default to `Asia/Manila`.
- Dependency updates must pass tests, production builds, and `npm audit` in both
  packages. Resolve advisories without accepting breaking upgrades blindly.
- MongoDB backups, restoration tests, uptime targets, monitoring, and personal
  data retention/deletion periods require an approved operational policy. The
  application does not automatically delete member, attendance, or comment
  records; do not assume a retention period until the church approves one.

## Android app (Capacitor)

The Android project wraps the Vite frontend; it continues to call the Render
API. `frontend/.env.capacitor` sets the API origin used by Android builds.
Configure the other `VITE_FIREBASE_*` client values in `frontend/.env.local`
before building. These are client-side settings, not Firebase Admin credentials.

The Android launcher icon and splash screens are generated from
`frontend/assets/logo.png`, converted from
`frontend/public/images/logo/Logo.jpg`. Regenerate the Android assets with:

```powershell
npm --prefix frontend run assets:android
```

After installing Android Studio and its Android SDK, run this from the
repository root. Capacitor 8's CLI requires Node.js 22 or later:

```powershell
npm --prefix frontend run build:android
```

In Firebase Console, register an Android app with package ID
`com.onrender.tlbcfrontend`, download its `google-services.json`, and put the
file at `frontend/android/app/google-services.json`. It must belong to the same
Firebase project as the frontend configuration. Enable Firebase Cloud
Messaging and the Google and Facebook Authentication providers. Add the
Android signing certificate's SHA-1 fingerprint to Firebase for Google sign-in.
Facebook sign-in also needs a Facebook App ID and Client Token in the Android
project's `local.properties` as `facebookAppId` and `facebookClientToken`, and
the Facebook OAuth redirect URI configured in Facebook and Firebase. The
Facebook App Secret belongs only in Firebase Authentication provider settings.
Do not put it or Firebase Admin credentials in the app.

Native push registration uses the authenticated `/api/notifications/push-token`
endpoint. Google and Facebook sign-in use their native provider flows and then
Firebase web authentication, preserving the existing account/profile flow.
Test these features on an Android device after setting up the Firebase and
Facebook app configurations.

To distribute a signed APK, open `frontend/android` in Android Studio and use
**Build → Generate Signed Bundle / APK → APK**. Create and securely back up the
release signing key; do not commit it. The generated APK can be installed
directly, and future updates must use the same application ID and signing key.

## Deploying to Render

Create the Web Service and Static Site from the root `render.yaml` Blueprint.
The API listens on Render's `PORT`, allows the local Vite origin and the
configured frontend origin, and the static site rewrites client-side routes to
`index.html`.

Set the prompted values in the Render dashboard:

- Backend: `MONGODB_URI`, `FIREBASE_PROJECT_ID`, Cloudinary credentials, and
  SMTP settings as needed. For Firebase Admin, add a Render secret file named
  `firebase-admin.json`; the Blueprint points
  `GOOGLE_APPLICATION_CREDENTIALS` to `/etc/secrets/firebase-admin.json`.
- Frontend: the `VITE_FIREBASE_*` values for the deployed Firebase web app.
  Keep `VITE_CHURCH_TIME_ZONE` aligned with the API's `CHURCH_TIME_ZONE`.
  To enable NKJV, NLT, and NIV in the Bible reader, also set
  `VITE_API_BIBLE_KEY` on the frontend static site to an API.Bible key with
  access to each version.
- If the frontend uses a custom domain, update `FRONTEND_URL` on the API service
  to that site's origin.

The static site rewrites all unknown paths to `index.html` so client-side routes
load on refresh. The frontend build also publishes `404.html` as a fallback for
routes if the rewrite rule has not been applied to the Render service. For
guaranteed `200` responses on refreshed client-side routes, manage the static
site through the Blueprint or add the `/*` → `/index.html` rewrite in the Render
Dashboard.

The static site's `VITE_API_URL` is linked to the API service by the Blueprint.
For local development, the frontend defaults to Vite's `/api` proxy at
`http://localhost:5000`; set `VITE_API_URL` to use a different API host.
For local frontend configuration, copy `frontend/.env.example` to
`frontend/.env.local` and supply the Firebase values for the intended project.