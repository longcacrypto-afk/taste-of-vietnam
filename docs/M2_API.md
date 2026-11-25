# M2 món, khẩu phần và bộ sưu tập — backend contract

Base `main 9adf9e0`. No UI changes, migrations, new providers or environment variables.
`npm ci`, `npm test`; disposable PostgreSQL/PostGIS:
`TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_test npm run test:db`.
The DB suite destroys the named database's public schema. Never use a production URL.

## Catalogue search

`GET /api/v1/dishes` returns `{total,page,limit,total_pages,items}`.
`total` is after all filters, before pagination; empty results/beyond last page are
200 with `items:[]`. Missing/blank `q` browses the catalogue; unmatched text returns
zero, not a fallback dish. Search is case/accent insensitive, token-order independent,
across name, description and tags (Vietnamese `đ` and decomposed Unicode supported).

| Query | Accepted values / default |
| --- | --- |
| q | text, max 200 characters |
| region | bac / trung / nam; omitted = all |
| meal_slot | breakfast / lunch / dinner / snack; omitted = all |
| diet | balanced / vegetarian / vegan / low_carb / eat_clean; omitted = all |
| budget_min, budget_max | nonnegative integer VND, inclusive range on `ref_price`; min <= max |
| safe_only | true (default) / false; applies caller's allergies and disliked IDs |
| page | integer >=1; default 1 |
| limit | integer 1–100; default 20 |

Invalid recognized filter values return 400 (no silent clamping or ignored typo).
All specified filters combine with AND. `balanced` imposes no extra diet restriction;
vegetarian includes vegan. Other diets require explicit catalogue `diet_flags`, not
an inference from a dish name or missing data. Most current seed dishes have no flags;
zero diet results are honest until verified content is entered.

Ordering preserves the existing repository order (newest catalogue entries first;
PostgreSQL ties use ID ascending). Page navigation is deterministic for an unchanged
catalogue, not a snapshot across admin updates. The current small launch catalogue
is loaded from the repository and filtered once per request; no second count query
can disagree with that response. SQL-side filtering/keyset paging is future scale work.

`GET /api/v1/dishes/categories` accepts the same filters, returns `total`,
`categories:[{id,name,color,count}]`, existing `regions` labels plus
`region_options:[{id,name}]`. Counts use the filtered real repository catalogue,
not the old constants. Counts overlap when a dish covers multiple meals.
Legacy category ID `snacks` maps to query `meal_slot=snack`; `vegan` maps to `diet=vegan`.

## Dish and recipe

`GET /api/v1/dishes/:dishId?servings=1` and the existing screen's advertised
`GET /api/v1/dishes/:dishId/ingredients?servings=1` return the same detail contract.
Missing dish IDs return 404 for detail, ingredients, story (both aliases), similar,
and regional-variants. Existing story/variant content generation is unchanged.

`servings` must be canonical decimal integer 1–10. Omitted defaults to base_servings
(normally 2). Empty/0/negative/decimal/abc/1e9/11/02 return 400. Ingredients and recipe
market cost scale by requested/base; original ingredients, steps and their dish ID
remain intact. Ingredient `amount` is the base-recipe amount; use `scaled_amount`.
g/ml round to 2 decimals; litres/kg/spoons/counts to 3; very small positive quantities
retain 3 significant digits instead of rounding to zero. No unit conversion is done.
Whole-piece units may be fractional (e.g. half an egg); presentation is a UI concern.
VND rounds to integers.

Nutrition is **per serving**, consistent with TECHNICAL_HANDOFF_SPEC's
`calories_per_serving`: `calories` and `macros` remain unchanged;
`nutrition_basis:'per_serving'`, `calories_per_serving`, `macros_per_serving`,
`scaled_calories_total` (=calories*requested), `scaled_macros_total` are explicit.
This fixes the old test/implementation that treated 480 kcal as a whole 2-person
recipe. Values are still seed estimates, not independently verified nutrition.

## Collections — Bearer required, guest tokens supported

All collection IDs are opaque server-generated `col-UUID`. Names: 1–80 characters,
sanitized as plain text. Supplied IDs, owners and replacement dish_ids are never used.
Unknown/other-user IDs both return 404; unauthenticated access returns 401.

| Method/path (under /api/v1) | Body / result |
| --- | --- |
| GET /me/collections | `{collections}` (own only) |
| POST /me/collections | `{name}` -> 201 `{collection,collections}` |
| GET /me/collections/:id | 200 `{collection}` |
| PATCH /me/collections/:id | `{name}` -> rename |
| DELETE /me/collections/:id | delete collection, not dishes |
| POST /me/collections/:id/dishes | `{dish_id}` -> add once, 404 if missing dish |
| DELETE /me/collections/:id/dishes/:dishId | remove, idempotent while collection exists |

Compatibility for existing UI:
`POST /me/collections {dish_id}` saves into the first collection or creates `col-1`;
it does not create a separate favorites group when custom groups already exist.
`DELETE /me/collections/DISH-xxx` removes that dish from every own group.
The alias is unambiguous because new group IDs start `col-`, legacy dishes `DISH-`.
Non-legacy dish IDs can always be removed through the collection-ID route.

Commands read the latest state inside one transaction. Different tabs adding
different dishes preserve both; duplicate saves produce one membership. Renames
are last-committed-wins. Deletes racing adds serialize: add may succeed then be
deleted, or return 404 if deletion won. No client snapshot overwrites membership.

PostgreSQL uses a per-account `FOR UPDATE` lock, including the first ever save.
A shared advisory transaction lock on `hashtext('m2-collections-catalogue')` is acquired
BEFORE the account lock; dish deletion takes it exclusively before deleting and
cleaning every user's arrays in the same transaction. This also prevents a save of
dish B from copying a stale reference to concurrently removed dish A. Different
users' saves run concurrently. In memory, synchronous read/modify/write (no await)
provides the same atomicity for one Node process. No new migration is necessary.
Trusted `saveCollections` imports participate in the barrier, but remain whole-snapshot
helpers; untrusted API clients cannot reach them. Direct SQL writes must follow this
contract or validate their own data; no database trigger is installed.

## Existing UI hook points — not modified in this PR

- M2-S01/S02/S03: feed real list/category responses to existing renderers;
  map Vietnamese region labels to bac/trung/nam and snack category as above;
  use total/page/limit, handle empty and HTTP 400.
- M2-S04/S05: keep dish ID throughout detail, story, similar and variants;
  handle 404 rather than opening first dish. Nutrition labels use per-serving fields.
- M2-S06: cap existing servings control at 10 (PR #3 runtime still permits 20);
  render scaled_amount with decimals, never parseInt/round it again.
- M2-S07: continue using dish-specific steps; pause/resume/local timer persistence
  belongs to the existing UI and is not changed or verified by backend tests.
- M2-S08: existing save/remove calls still work. Named groups can use the CRUD
  endpoints above when the existing screen's controls are wired; no new screen added.

## Pending PR integration

#3 UI, #5 roles and #6 Google are not part of this branch. Repository/router hunks
may need a rebase; retain `handleDishRoutes` after authentication/access checks.
No migration 003/004 is modified. #6 `loginGoogle()` writes collections directly:
when combined, acquire the same shared catalogue advisory lock at the START of its
transaction (before account locks) and filter merged IDs against existing dishes
before insertion. Add a Google-merge vs dish-delete concurrency test then.
Live Google, provider calls, production, UI timers and browser paths are unverified.
