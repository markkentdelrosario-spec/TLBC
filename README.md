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