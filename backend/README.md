# Backend configuration

## Local API and Cloudinary uploads

Start the API from this directory with `npm start` (or `npm run dev`). The
server loads `backend/.env` by file path, requires a valid `MONGODB_URI`, and
listens on port 5000 by default. It does not print connection strings or
Cloudinary credentials. Cloudinary is optional for starting the API, but the
upload routes return HTTP 503 when any of these settings is missing:
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Restart the API after changing `.env`.

Vite proxies `/api` and `/socket.io` to `http://127.0.0.1:5000` by default.
Set `VITE_API_PROXY_TARGET` in the shell before starting Vite only when the API
uses another host or port. Check `http://127.0.0.1:5000/api/health` directly:
an HTTP response confirms the API listener is reachable. If that check fails,
read the backend terminal first; a failed MongoDB connection prevents the API
from listening and makes Vite report a proxy error before any upload route runs.
Vite logs proxy connection errors with the upstream host and error code.

An HTTP 502 returned by the upload route after the API receives the request is a
different failure: it means the API could not complete its Cloudinary request.
The backend logs the Cloudinary HTTP status and request ID, when provided, but
never the configured credentials. Check that the local Cloudinary variables
belong to the same active Cloudinary account. For Render, set the three
variables in the service Environment settings; local `.env` files are not
deployed.

Manual Gmail registration stores a pending MongoDB profile and a bcrypt-hashed
password/OTP, then sends a six-digit code through the Brevo transactional email
API over HTTPS (port 443). Firebase Authentication account creation and account
activation happen only after the code is verified. Configure this environment
variable for the API process:

| Variable | Purpose |
| --- | --- |
| `BREVO_API_KEY` | Brevo API key; required to send registration emails |

Create an API key in the [Brevo API settings](https://app.brevo.com/settings/keys/api),
then set `BREVO_API_KEY` in `backend/.env` for local development and in the
Render API service's Environment settings for deployment. Do not commit the
key. Registration verification emails use the sender
`The Life Builder Church <thelifebuilderchurch@gmail.com>`. Verify that sender
in Brevo before sending; Brevo rejects unverified senders. Email requests use a
30-second timeout without SDK retries to avoid long waits and duplicate sends.
The API reports a delivery error if Brevo rejects or cannot complete the email.
Enable the Email/Password sign-in provider in Firebase Authentication so
members can sign in with the password they set during registration.

Password reset emails currently use Firebase Authentication's
`sendPasswordResetEmail`, and notifications are delivered in-app and by push;
neither currently sends through this Brevo service.

## Attendance and account access

Attendance dates and evaluations use `CHURCH_TIME_ZONE` (default
`Asia/Manila`). Sunday check-ins before 8:30 AM are Present; check-ins from
8:30 AM until before 11:00 AM are Late. The API records Absent for active group
members without a check-in once the Sunday 11:00 AM cutoff passes.

Secondary designations create ministry teams automatically: for example,
`KSP Leader` maps to the `KSP` team, `Youth Leader` to `Youth`, and both
`Worship Leader` and `Worship Team Member` to `Worship Team`. A member's multiple
designations can enroll them in multiple teams. Designated members can view
their teams and the active member directory through `GET /api/groups/my-teams`.
Leaders can add a registered active member with `POST /api/groups/team-members`
using `teamId` and `userId`, or remove a team assignment with
`DELETE /api/groups/team-members/:teamId/:userId`. KSP leaders can remove a
member from their numbered group with `DELETE /api/groups/members/:userId`;
these actions remove assignments, not user accounts. Ministry teams are separate
from the three numbered KSP attendance groups. The QR scanner check-in endpoint
accepts attendance only on Sunday in `CHURCH_TIME_ZONE` (Render is configured
for `Asia/Manila`). The scanner and attendance endpoints require the KSP Leader
secondary designation. Google and Facebook users can set an email/password credential in
account settings; the authenticated `POST /api/auth/set-password` endpoint
updates Firebase Authentication and stores a bcrypt hash in MongoDB. Firebase
requires recent authentication before a password can be set or changed.

Codes expire after 10 minutes, can be resent after a 60-second cooldown, and are
invalidated after five incorrect attempts. The API endpoints are
`POST /api/auth/register`, `POST /api/auth/verify-otp`, and
`POST /api/auth/resend-otp`.

KSP Leaders can create custom events at `POST /api/custom-events` with category
`KSP Gathering`, `Seminars`, or `Other` (the last requires `customName`). Select
an event and scan member QR IDs at `POST /api/custom-events/:eventId/scans`.
Custom event scans are written to the dedicated MongoDB collection
`custom_event_attendance_scans`, separately from Sunday attendance, with one
scan per member per event.

## Local admin testing

The fixed test account is available only through the local Firebase Authentication
Emulator. It is not created in a live Firebase project:

1. Start the Firebase Auth Emulator using `firebase emulators:start --only auth --project demo-tlbc`.
2. Set `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and
   `FIREBASE_PROJECT_ID=demo-tlbc` for the backend. Configure `MONGODB_URI` as
   usual.
3. Configure the frontend Firebase app with project ID `demo-tlbc` and set
   `VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.
4. From `backend`, run `npm run seed:admin`.

The seed command refuses to run outside a local emulator or in production. Its
local-only credentials are `admin.test@tlbc.local` /
`TLBC-Local-Admin-2026!`. Do not reuse these credentials or point the app at a
production Firebase project while emulator mode is enabled. Admin access for
slideshow management is still enforced by the API.

## Welcome slideshow

Configure the existing Cloudinary environment variables to allow slideshow
image uploads. Administrators can select up to 20 JPEG, PNG, WebP, or GIF images
(maximum 5 MB each) in one upload action from the Admin dashboard. Slide titles
are initialized from image filenames and can be edited or reordered afterward.
Uploaded images and slide order are stored in Cloudinary and MongoDB
respectively; the dashboard fetches the active slides after sign-in.

The built-in Bible reader offers the public translations provided by
bible-api.com (WEB, KJV, ASV, BBE, Darby, YLT, and OEB-US). NKJV, NLT, and NIV
are served by API.Bible. Configure `VITE_API_BIBLE_KEY` in the frontend build
environment and enable access to each version for that key. For Render, set it
in the frontend static site's Environment settings (not the backend service),
then redeploy the frontend so Vite includes it in the build. The reader reports
a setup or access error when a selected API.Bible version is unavailable.

## Live reactions and notifications

Authenticated dashboard clients connect to the API's Socket.IO endpoint for
live verse, announcement, birthday, comment-reaction, and notification updates.
When the frontend and API are on different origins, set `FRONTEND_ORIGIN` to a
comma-separated allowlist of frontend origins and set `VITE_SOCKET_URL` in the
frontend to the API origin. Same-origin deployments need neither setting.

In-app notifications and unread state are stored in MongoDB. Publishing an
announcement creates notifications for active accounts; reacting to another
member's announcement or birthday comment notifies that comment's author.

Push alerts are opt-in from the dashboard notification menu. Configure
`VITE_FIREBASE_MESSAGING_SENDER_ID` and `VITE_FIREBASE_VAPID_KEY` in the
frontend from the Firebase project's Cloud Messaging web-push configuration.
The site must be served over HTTPS (localhost is allowed for development), and
the Firebase project must have Cloud Messaging enabled. Set `PUBLIC_APP_URL` in
the backend to the absolute public HTTPS application URL so notification taps
open the relevant dashboard section. Push delivery uses the Firebase Admin
credentials already configured for the API. Signing out removes that device's
registered token; native Android clients can register their FCM token using
the same authenticated `/api/notifications/push-token` endpoint.
