-- No backfill of demo hours or verification dates: unknown is safer than "open".
ALTER TABLE places ADD COLUMN opening_hours JSONB;
ALTER TABLE places ADD COLUMN verified_at TIMESTAMPTZ;
ALTER TABLE places ADD CONSTRAINT places_hours_object
  CHECK (opening_hours IS NULL OR jsonb_typeof(opening_hours) = 'object');
-- A place with an unknown location must not silently become (0,0).
ALTER TABLE places ALTER COLUMN geom DROP NOT NULL;
