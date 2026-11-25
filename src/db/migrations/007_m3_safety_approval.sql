-- Never silently bless legacy/demo data. Rollout defaults to compatibility mode;
-- REQUIRE_SAFETY_APPROVAL=true activates the approval gate after M9 review exists.
ALTER TABLE dishes ADD COLUMN safety_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (safety_status IN ('pending', 'approved', 'rejected'));
