# Core filters + real weather (feat/core-filters-weather-2)

## Filters (server-side; the UI only maps chips to query params)
| Screen | Chip | Endpoint param | Rule |
|---|---|---|---|
| M2-S02 | Dưới 55k | `GET /dishes?budget_max=55000` | ref_price ≤ 55.000đ (existing param) |
| M2-S02 | Món nước | `GET /dishes?soup=true` | `dishes.is_soup === true`; NULL (not entered) never matches. `soup=false` = recorded not-soup |
| M2-S02 | 🚫 Ẩn Hải sản | `GET /dishes?exclude_seafood=true` | hides allergen tags shrimp / shrimp_paste / shellfish / fish, tag "Hải sản", and dishes with no allergen data. Hard allergy filter still applies first |
| M4-S01 | Dưới 50k | `GET /places?max_price=50000` | price of the `dish_id` menu row (available) ≤ N; without dish_id any available row |
| M4-S01 | Máy lạnh | `GET /places?has_ac=true` | `places.has_ac === true`; NULL / false = not matching |
| M4-S01 | Giao hàng | `GET /places?delivery=true` | a GrabFood/ShopeeFood link the order redirect accepts (same allowlist as M5-S02) |

`/places` also returns `filters` (applied) and `filtered_out` (places the same search returns without them).
Invalid values → 400. Verified / not-paused / open rules are unchanged (filters run after them, before the 100 limit).

Migration `013_core_filters.sql`: `dishes.is_soup BOOLEAN NULL` (backfilled for the repo's seed ids only;
DISH-108 and DISH-111 left NULL as ambiguous), `places.has_ac` now nullable without default (existing values kept).

## M2-S08 collection chip
`GET /me/collections` adds `dish_count` per collection (dishes still in the catalogue). Each saved-dish card shows
"<tên bộ sưu tập> · N món" (+k when the dish is in more collections).

## Weather (`/suggestions/today`, spin/game/fortune/blind-box)
Open-Meteo `current=temperature_2m,weather_code` at the user's chosen/GPS location, else the default area
Biên Hòa (10.957, 106.843). Reading carries `location {lat,lng,source:'profile'|'default',name}`; the UI adds
"· Biên Hòa" for the default. Cache 30 min (`WEATHER_CACHE_SECONDS`, failures 60 s), timeout 2 s (`WEATHER_TIMEOUT_MS`),
`WEATHER_PROVIDER=off` disables. Failure → `live_weather: null` and the chip stays "sắp có".
Node's fetch does not use HTTP(S)_PROXY by itself: behind a proxy start with `NODE_USE_ENV_PROXY=1`.
