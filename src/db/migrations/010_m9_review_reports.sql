-- M6 ingestion remains disabled. Existing fixtures can be reviewed by a human.
UPDATE ocr_review_queue SET status='pending_review' WHERE status='pending';
ALTER TABLE ocr_review_queue ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE ocr_review_queue ADD COLUMN approved_price INTEGER CHECK(approved_price BETWEEN 0 AND 100000000);
ALTER TABLE ocr_review_queue ADD COLUMN reviewed_by VARCHAR(40);
ALTER TABLE ocr_review_queue ADD COLUMN reviewed_at TIMESTAMPTZ;
CREATE TABLE menu_revisions (
  id TEXT PRIMARY KEY,
  ocr_id VARCHAR(32) NOT NULL REFERENCES ocr_review_queue(id),
  place_id VARCHAR(32) NOT NULL REFERENCES places(id),
  before_menu JSONB NOT NULL,
  after_menu JSONB NOT NULL,
  actor_id VARCHAR(40),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX menu_revisions_place ON menu_revisions(place_id,created_at DESC);
CREATE FUNCTION protect_menu_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'menu revision is append-only';
END $$;
CREATE TRIGGER protect_menu_revision BEFORE UPDATE OR DELETE ON menu_revisions
FOR EACH ROW EXECUTE FUNCTION protect_menu_revision();
-- Resolution can append its outcome; original evidence cannot be erased/rewritten.
-- user_id may be unlinked by account deletion; the stable HMAC dedupe key stays.
CREATE FUNCTION protect_report_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'reports cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - 'user_id' - 'status' - 'resolution_reason' - 'resolved_by' - 'resolved_at' - 'report_count')
     IS DISTINCT FROM
     (to_jsonb(NEW) - 'user_id' - 'status' - 'resolution_reason' - 'resolved_by' - 'resolved_at' - 'report_count') THEN
    RAISE EXCEPTION 'report evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_report_evidence BEFORE UPDATE OR DELETE ON place_reports
FOR EACH ROW EXECUTE FUNCTION protect_report_evidence();
