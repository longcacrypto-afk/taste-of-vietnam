-- Demo catalogue (docs/DEMO_CATALOG.md): researched demo dishes/drinks and their menu
-- links are flagged so the real-data load can remove them in one step:
--   DELETE FROM place_dishes WHERE is_demo; DELETE FROM dishes WHERE is_demo;
-- dishes.category: 'dish' | 'drink'; NULL = not entered (the original catalogue and
-- admin dishes are treated as dishes). Drinks are never main-meal suggestions.
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category VARCHAR(16);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dishes_category_check') THEN
    ALTER TABLE dishes ADD CONSTRAINT dishes_category_check CHECK (category IS NULL OR category IN ('dish', 'drink'));
  END IF;
END
$$;
ALTER TABLE place_dishes ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_dishes_is_demo ON dishes (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_place_dishes_is_demo ON place_dishes (is_demo) WHERE is_demo;
