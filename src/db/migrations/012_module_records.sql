-- Generic persistent storage for the modules opened after launch (M6–M8, M10–M20, W).
-- Each module keeps its records as JSON documents keyed by (module, kind).
-- is_demo marks the demo dataset so the data-loading phase can replace it cleanly:
--   DELETE FROM module_records WHERE is_demo;
CREATE TABLE IF NOT EXISTS module_records (
  id          TEXT PRIMARY KEY,
  module      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  owner_id    TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_module_records_kind ON module_records (module, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_module_records_owner ON module_records (module, kind, owner_id);
