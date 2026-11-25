-- Legacy rows deliberately retain NULL CMS metadata; no automatic safety blessing.
ALTER TABLE dishes ADD COLUMN cms JSONB;
ALTER TABLE places ADD COLUMN cms JSONB;
ALTER TABLE dishes ADD CONSTRAINT dishes_cms_status CHECK
 (cms IS NULL OR (cms->>'status' IN ('draft','published','archived') AND (cms->>'version')::int > 0));
ALTER TABLE places ADD CONSTRAINT places_cms_status CHECK
 (cms IS NULL OR (cms->>'status' IN ('pending','verified','archived') AND (cms->>'version')::int > 0));
CREATE TABLE content_versions (
  entity TEXT NOT NULL CHECK(entity IN ('dish','place')),
  target VARCHAR(32) NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(entity,target,version)
);
-- Out-of-band edits must revoke previously verified CMS safety too.
CREATE OR REPLACE FUNCTION invalidate_dish_safety_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.allergen_flags IS DISTINCT FROM OLD.allergen_flags
    OR NEW.diet_flags IS DISTINCT FROM OLD.diet_flags
    OR NEW.ingredients IS DISTINCT FROM OLD.ingredients
    OR NEW.recipe_steps IS DISTINCT FROM OLD.recipe_steps THEN
    NEW.safety_status := 'pending';
    IF NEW.cms IS NOT NULL THEN
      NEW.cms := NEW.cms || '{"status":"draft","verified_at":null,"verified_by":null,"evidence":""}'::jsonb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
