# Backend configuration

Manual Gmail registration stores a pending MongoDB profile and a bcrypt-hashed
password/OTP, then emails a six-digit code. Firebase Authentication account
creation and account activation happen only after the code is verified. Configure
these environment variables for the API process:

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (`465` for implicit TLS, commonly `587` for STARTTLS) |
| `SMTP_USER` | SMTP account username |
| `SMTP_PASS` | SMTP account password or provider app password (`SMTP_PASSWORD` is also accepted) |
| `SMTP_FROM` | Optional verified sender address; defaults to `SMTP_USER` |

For Gmail SMTP, use a Google app password rather than the account's normal
password. On startup the API runs `transporter.verify()` and logs whether SMTP
connection verification succeeded. Email registration returns a configuration
error until the required SMTP settings are present. Enable the Email/Password
sign-in provider in Firebase Authentication so members can sign in with the
password they set during registration.

Codes expire after 10 minutes, can be resent after a 60-second cooldown, and are
invalidated after five incorrect attempts. The API endpoints are
`POST /api/auth/register`, `POST /api/auth/verify-otp`, and
`POST /api/auth/resend-otp`.

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
bible-api.com (WEB, KJV, ASV, BBE, Darby, YLT, and OEB-US). NKJV is served by
API.Bible because it is a licensed translation. Configure
`VITE_API_BIBLE_KEY` in the frontend build environment and enable NKJV for that
API.Bible key; without this configuration, the reader displays a clear setup
error when NKJV is selected.

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
