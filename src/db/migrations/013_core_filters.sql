-- Core filters (M2-S02 "Món nước", M4-S01 "Máy lạnh"): make "not entered" representable.
--
-- dishes.is_soup: TRUE = a broth/soup dish ("món nước"), FALSE = not, NULL = not entered.
--   The search filter `soup=true` matches TRUE only; NULL never counts as a match.
-- places.has_ac: was NOT NULL DEFAULT FALSE, so "no AC" and "never entered" looked the
--   same. Now nullable with no default; existing values are kept as they are (FALSE rows
--   stay FALSE — they cannot be told apart retroactively). The `has_ac=true` filter
--   matches TRUE only, so unknown (NULL) and FALSE are both "not matching".
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_soup BOOLEAN;
ALTER TABLE places ALTER COLUMN has_ac DROP NOT NULL;
ALTER TABLE places ALTER COLUMN has_ac DROP DEFAULT;

-- Backfill only the repo's own catalogue (src/data/seed.js), only where still NULL, so an
-- admin entry is never overwritten. Dishes whose form is ambiguous (DISH-108 bò hầm ăn
-- kèm bánh mì, DISH-111 mì Quảng ít nước) are left NULL on purpose.
UPDATE dishes SET is_soup = TRUE  WHERE is_soup IS NULL AND id IN ('DISH-101', 'DISH-103', 'DISH-105', 'DISH-106', 'DISH-110');
UPDATE dishes SET is_soup = FALSE WHERE is_soup IS NULL AND id IN ('DISH-102', 'DISH-104', 'DISH-107', 'DISH-109', 'DISH-112');
