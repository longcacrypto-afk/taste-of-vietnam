-- Existing account roles remain compatible, but legacy 'admin' is NOT an RBAC grant.
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
-- Legacy verified OTP accounts already have a trusted root phone (not editable profile.phone).
UPDATE users SET identity_verified = TRUE WHERE NOT is_guest AND phone IS NOT NULL;
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS after_data JSONB;
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE place_reports ADD COLUMN IF NOT EXISTS reporter_key VARCHAR(64);
ALTER TABLE place_reports ADD COLUMN IF NOT EXISTS evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE place_reports ADD COLUMN IF NOT EXISTS resolution_reason TEXT;
ALTER TABLE place_reports ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(40);
ALTER TABLE place_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS report_dedupe (
  place_id VARCHAR(32) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  reporter_key VARCHAR(64) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  report_id VARCHAR(64) NOT NULL REFERENCES place_reports(id),
  last_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(place_id, reporter_key, reason)
);
CREATE INDEX IF NOT EXISTS idx_reports_closure_window ON place_reports(place_id, created_at DESC)
  WHERE reason = 'closed' AND reporter_key IS NOT NULL;
-- Old counters count repeated/guest/wrong-reason reports; cannot use them as closure votes.
-- Preserve manual/previous pauses until a human reviews them.
UPDATE places SET report_count = 0;
-- Append-only audit at DB level too (a DB owner/superuser can still disable triggers).
CREATE FUNCTION protect_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Sole privacy exception: unlink a deleted actor, never alter business evidence.
  IF TG_OP = 'UPDATE' AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
     AND NEW.actor_email = 'deleted-user'
     AND (to_jsonb(OLD) - 'actor_id' - 'actor_email') = (to_jsonb(NEW) - 'actor_id' - 'actor_email') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'admin audit is append-only';
END $$;
CREATE TRIGGER protect_admin_audit BEFORE UPDATE OR DELETE ON rbac_audit_logs
FOR EACH ROW EXECUTE FUNCTION protect_admin_audit();
