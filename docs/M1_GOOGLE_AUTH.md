# M1 — Google sign-in and account data

Backend only. Existing Live App/M1 screens are unchanged. Google is the primary provider;
phone OTP remains a legacy API path, not a second login button to add to the UI.

## API contract for the existing UI

- `GET /api/v1/auth/google/config`: `{ enabled: boolean, client_id: string|null }`.
  `GOOGLE_CLIENT_ID` unset/blank gives disabled config. This is a public identifier,
  not an OAuth client secret. The secret is not needed by the ID-token flow.
- Existing Google button: initialize Google Identity Services with that client ID.
  Send its `credential` as `POST /api/v1/auth/google`, JSON `{ "id_token": "..." }`.
- Send the current **guest** app JWT in `Authorization: Bearer ...` on this request
  to transfer that guest's saved data. Do not send guest/user IDs in the body.
- On success, replace the guest token with `access_token`. Response shape is the OTP
  shape: `verified`, `access_token`, `token_type`, `expires_in_s`, `role`, `user` (profile).
- Missing token: 400. Invalid signature/issuer/audience/expiry: 401. Config unset or
  Google key service unavailable: 503. Never show a successful login on errors.
- Disabled Google button can use the agreed existing-style “Sắp có” state. Hide unsupported
  providers; do not invent screens or a new layout. Public catalogue GETs need no login.
- Profile PATCH/PUT: use `regions`, `spice_level`, `hard_allergies`, `diet_mode`,
  `budget_min`, `budget_max`, `lat`, `lng`, `radius_m`, `name`, `disliked_dish_ids`,
  `pdpd_consent`, `meal_reminders`. Unknown fields are 400. `id/phone/role` are ignored
  for legacy compatibility, never writable. JSON null/arrays/types/enums/out-of-range
  numbers fail before any profile UPDATE. PUT remains partial, matching the existing API.
- Existing settings export must fetch `GET /api/v1/me/export` with Bearer and download
  the response JSON, not local UI state. Export includes ALL own history (no 50/200 cap),
  collections, redirects, reports, own recipes and payment records. No shared analytics.
- Existing delete button calls `DELETE /api/v1/me`; after success remove JWT and private
  local caches. Old JWTs then get 401. Do not retry a failed write automatically after login.

## Security and merge rules

- Verify RS256 using keys fetched only from Google's pinned HTTPS JWKS endpoint, with
  a 5-second timeout, bounded caching, a 30-second refresh/backoff guard, and request coalescing.
  Validate issuer, audience, authorized party (including multiple audiences), expiry,
  issued-at, not-before and subject. Tests generate temporary RSA keys and mock JWKS;
  no real Google credentials or network calls are used.
- Provider identity is `google_sub`, unique in `users`. Never auto-link by matching email
  or phone. Google email is stored lowercase only when `email_verified` is true.
  An existing phone-only account is NOT automatically linked to a Google account.
- New Google users start as `user`. M9 may provide `bootstrapSuperAdmin(userId)` for its
  explicit one-time `ADMIN_EMAILS` bootstrap policy. M1 never promotes by request body.
- PostgreSQL login runs account creation/update and guest data transfer in ONE transaction.
  Advisory lock serializes a subject; row lock consumes a guest at most once across requests.
  Guest proof is the verified guest Bearer JWT only. A normal user Bearer never transfers
  account data. Replayed/deleted guest tokens cannot duplicate transferred rows.
- New account inherits guest preferences; existing account preferences win. Allergies and
  disliked dishes are unioned conservatively. Consent is not transferred. Collections with
  the same id union dish IDs and preserve the account name/order; history keeps unique event
  IDs. Redirects/reports/recipes move to the account. The guest row is removed; its token dies.
  Suggestion caches for both identities are invalidated. Memory adapter uses a synchronous
  mutation block; PostgreSQL is the durable transactional path.
- New profiles have empty allergies/preferences and no consent. Coordinates are a Biên Hòa
  city default, NOT device/GPS permission. Existing saved profiles are not silently reset.
- Delete cascades profile/history/collections/redirects, deletes own recipes and phone OTP,
  removes Google identity, and unlinks reports/payments/ad clicks/campaign ownership.
  Audit rows are never deleted: call M9's `anonymizeAuditActor(userId, client)` inside the
  deletion transaction when available; pre-M9 fallback anonymizes actor id/email directly.
  Do not claim this feature alone proves legal compliance or purges infrastructure backups.
- Consent purpose/version/timestamp, policy/legal copy, GPS permissions, offline cache cleanup
  and the UI wiring remain outside this backend slice. Legacy phone OTP does not consume
  guest data: only the chosen Google login flow does.

## Owner: create the Google OAuth client ID

No client ID or secret needs to be sent to Viktor or committed to GitHub.

1. Open https://console.cloud.google.com/ in your own Google account. At the top, choose
   **Select a project → New project** (or select the existing app entry). Give it a recognizable
   name such as Taste of Vietnam. No paid Google API is needed for basic sign-in.
2. Open **Google Auth Platform**. If this is the first setup, select **Get started**.
   In older console navigation this is under **APIs & Services → OAuth consent screen**.
3. In **Branding**, set app name **Taste of Vietnam**, your own support email and developer
   contact email. Use real app/home/privacy/terms URLs when they are available; do not claim
   that a policy exists if it does not. Save the configuration.
4. In **Audience**, choose **External** for ordinary Google accounts (Internal only applies
   to accounts in your own Google Workspace organization). During Testing, add the Google
   accounts you will use to **Test users**. Before public launch, review **Publish app** and
   complete any verification the console actually requests.
5. In **Data Access**, request only basic identity: `openid`, email, profile
   (`.../auth/userinfo.email`, `.../auth/userinfo.profile` if the console shows full names).
   Do not enable Gmail, Drive, Maps, paid APIs, or unrelated scopes for this feature.
6. Open **Clients → Create client** (older navigation: **APIs & Services → Credentials →
   Create credentials → OAuth client ID**). Select **Web application**, name it **Taste of Vietnam web**.
7. Under **Authorized JavaScript origins**, add EXACTLY:
   `https://taste-of-vietnam.onrender.com`
   (no path such as `/app`, no wildcard). Add `http://localhost:3000` only if you actually
   use local development. Each future custom domain needs its own exact authorized origin.
8. This implementation uses the GIS JavaScript credential callback, not a redirect/code
   exchange; leave **Authorized redirect URIs** empty. The `/api/v1/auth/google` endpoint
   is a JSON token verifier, not an OAuth redirect callback.
9. Select **Create**. Keep the **Client ID** ending in `.apps.googleusercontent.com` privately
   in your own configuration notes. Do not share the **Client secret**: this flow does not use it.
10. When the code is reviewed and an environment change is approved, set the server's
    `GOOGLE_CLIENT_ID` to that Client ID in Render's Environment settings. Do not put it in a
    source file. This task does NOT change Render or deploy anything. Once deployed with approval,
    check config enabled=true and try sign-in with a test account from the registered origin.

Official reference: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
and https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## Local verification

`npm test` (memory/security) and
`TEST_DATABASE_URL=postgres://<local-disposable-db> npm run test:db` (PostgreSQL/PostGIS).
The DB suite drops the public schema; NEVER point it at production. Tests cover wrong/missing
claims and signatures, JWKS failure/rotation/coalescing, role isolation, invalid profile with zero
writes, guest replay/isolation, a forced late rollback, simultaneous account/guest claims,
all 251 history rows in exports, deletion/token revocation, and same-transaction audit cleanup.
