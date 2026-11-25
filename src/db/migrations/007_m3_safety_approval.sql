-- Never silently bless legacy/demo data. Rollout defaults to compatibility mode;
-- REQUIRE_SAFETY_APPROVAL=true activates the approval gate after M9 review exists.
ALTER TABLE dishes ADD COLUMN safety_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (safety_status IN ('pending', 'approved', 'rejected'));

-- Direct imports/seed refreshes must also invalidate an earlier review.
CREATE FUNCTION invalidate_dish_safety_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.allergen_flags IS DISTINCT FROM OLD.allergen_flags
    OR NEW.diet_flags IS DISTINCT FROM OLD.diet_flags
    OR NEW.ingredients IS DISTINCT FROM OLD.ingredients
    OR NEW.recipe_steps IS DISTINCT FROM OLD.recipe_steps THEN
    NEW.safety_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dishes_invalidate_safety_review BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION invalidate_dish_safety_review();
