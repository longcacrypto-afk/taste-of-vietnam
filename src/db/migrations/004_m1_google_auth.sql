-- Google identity is unique by provider subject, never by caller-provided email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
