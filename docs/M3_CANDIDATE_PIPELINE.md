# M3-1 — shared candidate contract

Backend-only change, base `main` 9adf9e0. No new UI; no provider, Render or production calls.

## Entry points

`src/services/candidatePipeline.js` owns `buildCandidates(view, opts, dependencies)`.
Today, chat and GET `/suggestions/{spin,game,fortune,blind-box}` all call it.
Today/chat return up to three; decision endpoints return a random single `picked_dish`
(or **200 with null**, not a made-up fallback). `total_safe_candidates` is the eligible
pool size; the game endpoints also return `candidates` (`dish_id`, `name` of that same pool, in score order) so the M3-S03 wheel labels show real dishes. `reasons` contains aggregate exclusion counts and an insufficient-candidates
message when fewer than three qualify. Codes describe the first failed gate, not every
possible failure; do not display these as catalogue statistics.

GET selection parameters: `mode=both|cook|eat_out`, `meal_slot=breakfast|lunch|dinner|snack`,
`radius_m`, `budget_min`, `budget_max`, `diet_mode`, `spice_max`. Defaults come from the
profile (meal defaults lunch, mode both). Invalid contexts return 400 with no candidates.
Diet flags are catalogue codes, not inferred from names; vegan qualifies for vegetarian,
not the converse. Profile diet remains in force even if a request asks for balanced.
Profile `spice_level` is a preference; explicit `spice_max` is a hard cap. Budget is a
strict per-person inclusive interval; cook cost = market_cost_base/base_servings.
The chat parser divides total budget by party size (floor, never rounds up), applies
profile ceiling, and emits options/intent/text from that same local parse. Chat never
calls Gemini, even when a key exists. Provider wording/model work belongs to M3-3.

## Gate order

Safety approval / known allergy metadata → allergy → disliked → diet → meal → explicit
spice cap → eaten history within 72 hours → available mode → exact budget.
An eaten entry at exactly 72 hours no longer blocks. Invalid dates do not block forever.
No safety condition is relaxed to fill slots. Missing/malformed allergen metadata is
excluded for users with allergies. Rejected content is always excluded.

Eat-out needs a verified, not paused place under the user's radius, with an available
menu row and known price. It picks the nearest affordable place, not an expensive nearest
place plus a hidden budget tolerance. Cook needs nonempty ingredients and steps, known
recipe cost and positive servings. Both may choose an affordable recipe if no eligible
restaurant fits. Sponsored slots come only from this same pool, exact campaign place,
and min(user radius,campaign radius); at most one sponsored item and only with three
actual results. Campaigns/ads remain frozen; this does not add campaign functionality.

## Safety approval rollout (migration 007)

`REQUIRE_SAFETY_APPROVAL` is server-controlled, defaults **false**, and cannot be disabled
by request parameters. Compatibility mode keeps the existing labelled catalogue usable;
it is **not a claim that the demo catalogue was reviewed**. Set true only after M9 has
an audited review workflow and real entries are approved. Then only `safety_status =
'approved'` qualifies. New and migrated entries default pending, never auto-approved.
M3 does not add a review screen or grant a public API permission to approve entries.
The repository supports the status for the future M9 workflow. Allergy/diet/ingredient/
step edits revoke review; a DB trigger protects direct SQL imports/seed refresh too.
Approving and changing ingredients in one call leaves pending: review in a later step.
Memory legacy seed may omit the field; this is treated as pending by the strict gate.

Today cache hashes profile, context, catalogue, places/menus, campaigns, weather, history,
approval configuration and currently active eaten IDs. Revocation/menu/profile changes
and the exact 72h boundary cannot replay old candidate results; per-user key prefixes
remain compatible with existing invalidation. This loads a view before hashing; no
performance improvement claim is made.

## Integration boundaries

- M4 merge hook: `placeEligibility(place, now)` is injectable as `placePredicate` in the
  shared gate. Replace its implementation with `getPlaceOpenStatus` from
  `src/services/placeHours.js`. M4 contract: `{status:'open'|'closed'|'unknown'|'stale',
  is_currently_open, reason}`. `REQUIRE_VERIFIED_HOURS=false`: reject closed, retain
  unknown/stale only as unconfirmed; true: only open. Do not label unknown/stale open.
  This branch deliberately retains main's verified/not-paused predicate until M4 merges;
  it does **not** prove actual opening hours or 90-day freshness.
- PR #3 UI must use the shared game responses; its existing local fortunes/blind-box
  results are not fixed by this backend-only stream. Empty game response must stop
  animation; missing screen/form work is reported, never designed here.
- Expect router conflicts with #3/#5/#6/#7/#8/M4 and mapper/updateDish conflicts with
  #5/#6/#7/M4. Keep all branches' behavior, route all M3 candidates through this gate,
  preserve M9 audited authorization/transactions and M2 collection locks. Re-run matrix
  after each rebase. Migration 007 is reserved for M3; M4 uses 008. Migration expectation
  lists in existing PostgreSQL tests must include all merged migrations in order.
- M3-2 full feedback validation/history pagination, M3-3 provider adapter, weather,
  approved operational data and actual UI/game integration remain separate tasks.

## Proof

Base: `npm test` **69/69**; PostgreSQL/PostGIS `npm run test:db` **13/13**, zero skips.
Head: run both suites; same 32 allergy×vegetarian×budget×meal×eaten contexts exercise
all three modes, Today/chat/spin/game/fortune/blind-box with memory and real SQL data.
Extra tests cover 0/1/2/3 candidates, no allergy override, approval on/off, SQL persistence,
review invalidation, strict budget boundaries, no unknown recipe fallback, malformed
metadata, expired cooldown, cache revocation, and no provider calls with a fake key.
No lint/typecheck scripts exist. `npm run build:ui` must leave UI sources/bundle unchanged.
Flutter is frozen; its pre-existing CI failure is not changed by this branch.
