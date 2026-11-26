# M9-4 / M9-5 — review menu and retain report evidence

Stack: `feat/m9-review-reports` → `feat/m9-data-entry` (#12) → `integration/release-7`.
Apply migration `010_m9_review_reports.sql` after 009. No AI/provider keys.
M6 OCR ingestion (`POST /api/v1/merchant/menu/ocr`) returns **503 M6_INGESTION_DISABLED**.
There is no API for creating the review queue in this release; local seed fixtures suffice.
Historical SQL `pending` rows become `pending_review`, never approved automatically.

## Menu review — S05

`content_moderator` and `super_admin` only:

* `GET /api/v1/admin/ocr-review?status=pending_review&place_id=PLACE-401&limit=50&offset=0`
  → `{total,limit,offset,items}`; supported status: pending_review, approved, rejected.
* `POST /api/v1/admin/ocr-review`
  ```json
  {"ocr_id":"ocr-901","version":1,"decision":"approved","dish_id":"DISH-101","price":57000}
  ```
* Reject:
  ```json
  {"ocr_id":"ocr-901","version":1,"decision":"rejected","reason":"Ảnh không rõ giá"}
  ```
* `GET /api/v1/admin/menu-revisions?place_id=PLACE-401&limit=50&offset=0`
  → immutable before/after full menus, actor, timestamp, source queue id and reason.

Approval **requires** the explicit canonical `dish_id` and integer VND `price` in
0–100,000,000. No fallback to a model's suggestion, dish reference price, or OCR guess.
The dish must exist and be public under the parent CMS publication rules; CMS drafts,
archived and rejected dishes cannot be mapped. Legacy compatibility remains the same
as #12; this does not claim seed dishes are safety-reviewed.
Only `pending_review` items and exact positive integer `version` may be processed.
Missing/invalid version returns 400; stale version or repeat review returns 409.
The successful outcome increments version, records reviewer/time, and is terminal.

Role recheck, current place lock, canonical mapping, menu price, place content snapshot,
menu revision, queue status/version and audit are **one transaction**. A failure at
any step rolls everything back. Two reviewers using the same version produce one
200 and one 409, exactly one revision and audit. Other menu entries are retained;
an existing unavailable dish stays unavailable. New canonical entries default available.
Approval of a human-reviewed menu change preserves the place's current verification,
hours and pause state; it never approves/unpauses an unverified/hidden place.
Archived places cannot receive an approval.
Reject requires a nonblank string reason (≤1000 characters), records the review
but never changes the menu or creates a menu revision. There is no reopen/reprocess API.

## Reports — S06 / M4-5

`content_moderator`, `ops_admin`, `super_admin`:

* `GET /api/v1/admin/reports?status=resolved&reason=closed&place_id=PLACE-401&limit=50&offset=0`
  → `{total,limit,offset,items,reports}`. Omit filters for all history.
  Status: pending_review, auto_paused, resolved, rejected.
  Reason: closed, wrong_price, wrong_location, wrong_menu, other.
* `GET /api/v1/admin/reports/{id}` → `{report}` with original evidence, reason,
  status, resolution reason/reviewer/time; stable HMAC reporter key is not exposed.
* `PATCH /api/v1/admin/reports/{id}`:
  ```json
  {"status":"rejected","reason":"Bằng chứng không khớp địa điểm"}
  ```
  Only pending/auto_paused → resolved/rejected; repeated processing returns 409.
  Resolving/rejecting one report does not implicitly unpause a place.

`ops_admin` or `super_admin` only:

* `POST /api/v1/admin/places/{id}/unpause`
  ```json
  {"reason":"Đã kiểm tra thực tế, quán mở lại"}
  ```
  Required nonblank string reason ≤1000 chars. Resets the pause/count but **does not**
  change verification; resolves still-pending reports with reason/actor/time and
  retains their evidence. An eligible verified/open place is in refreshed M4 results;
  unverified, archived or closed-by-hours places remain excluded.

No report delete endpoint exists. SQL additionally rejects deletion/rewriting original
report evidence and menu-revision updates/deletes. Account deletion can unlink `user_id`
without removing business evidence or the HMAC dedupe key.
The inherited closure guard is unchanged: **three distinct eligible stable identities**
with active `closed` reports in a strict rolling **24h** window hide the place.
Guest/unverified identities cannot vote; repeated/deleted/recreated identities dedupe,
wrong-price/menu/location reasons do not count. Exactly 24h-old or resolved/rejected
votes do not count. Human unpause does not recycle the old reports into a new pause.
One global admin role lock is retained for transaction-safe revocation; public reports
and CMS writes coordinate on the existing place row lock.

## Original UI controls only — known operational gaps

* S05 has **only “Xác nhận ghép”**. It confirms the canonical suggestion and price
  visibly shown, sending the loaded version. It has **no canonical selector, price
  input, reject button or reason field**; those choices are API-only.
* S06 shows original report evidence, human-readable state and resolution history in
  its existing text/badge. Its only original button is **“Cập nhật giờ mở cửa chính thức”**.
  The original screen has no hours form either, so the button stays disabled with
  an explanation. It is **not** relabeled as unpause.
* S06 has **no filters, resolve/reject/unpause buttons or reason input**.
  These actions remain API-only. No new screens/forms/buttons were designed.
* Existing error/retry feedback is reused: 409 explains the conflict and retry
  refreshes the current screen instead of replaying stale approval. Offline retry
  repeats the original write.
* `/app` PWA hides the original admin sidebar. Browser proof initializes the existing
  M9 dashboard and clicks its original S05/S06 cards, then the existing confirm/retry
  controls. It does not certify home→admin discoverability/back-navigation.
  The separate original desktop Live App review helper was updated for the same
  version/dish/price contract; its existing reject prompt now requires explicit text.

## Verification

* Parent `5855692`: Node210/210, PostgreSQL134/134; default main `9adf9e0`: Node69/69,
  PG13/13. New 11-behaviour review/report contract against parent: 3 pass / **8 fail**.
* Head: `npm test` **223/223**; `TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_test npm run test:db`
  **148/148**, zero skips. Shared 11 contracts run on memory + real PostgreSQL;
  extra SQL tests prove new-pool persistence, append-only evidence and real trigger
  audit failure rollback. Two source-function tests cover conflict/offline retry.
* `npm run build:ui` in sync; `git diff --check`. No lint/typecheck scripts exist.
* Chromium 21 checks, 0 JS errors; real local HTTP/memory server and fixture admin
  token; 1440 and360 screenshots, original confirm, two-admin conflict, reload, offline
  retry, retained evidence after API-only unpause, evidence escaping, no added forms.
  Not real Google, production, real restaurant/evidence data, PostgreSQL browser E2E,
  screen-reader testing, or Firefox/WebKit. Flutter is frozen and untouched.
* PostgreSQL test DB is disposable: `test:db` drops its schema. The pre-existing M4
  fixture cleanup now uses `TRUNCATE places CASCADE` (DB-owner fixture reset, not an API).
  The old time-window tests disable/re-enable the new evidence trigger only for test
  time travel. Production report APIs never bypass retention.
