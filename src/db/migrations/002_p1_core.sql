-- =============================================================================
-- MIGRATION 002 — P1 CORE: persistent users/OTP, per-user history & collections,
-- full dish/place catalogue fields, campaigns, payments, order redirects,
-- place reports, OCR queue, community recipes and the admin audit log.
--
-- Additive only: new tables, new nullable/defaulted columns, one relaxed
-- default (ad_campaigns.balance_vnd) and one widened type (ad_clicks.user_id
-- UUID -> VARCHAR). Nothing is dropped. Legacy tables that the app does not use
-- yet (user_profiles, eaten_logs, place_reviews, M11–M20 tables) stay as they are.
-- =============================================================================

-- ── M1: accounts, OTP challenges ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(40) PRIMARY KEY,                 -- 'usr-<hex>' / 'gst-<hex>' (same ids as the P0 tokens)
    role VARCHAR(16) NOT NULL DEFAULT 'user',   -- guest, user, merchant, admin
    phone VARCHAR(16),                          -- +84XXXXXXXXX, NULL for guests
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    profile JSONB NOT NULL DEFAULT '{}',        -- taste profile (allergies, budget, location, reminders…)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- one real account per phone number
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE NOT is_guest AND phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_guest_created ON users (created_at) WHERE is_guest;

CREATE TABLE IF NOT EXISTS otp_challenges (
    phone VARCHAR(16) PRIMARY KEY,
    code_hash VARCHAR(128) NOT NULL,            -- HMAC of the code, never the code itself
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ── M3: suggestion history (feedback, eaten → 3-day cooldown) ───────────────
CREATE TABLE IF NOT EXISTS suggestion_history (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dish_id VARCHAR(32),
    dish_name VARCHAR(255),
    place_id VARCHAR(32),
    place_name VARCHAR(255),
    price_vnd INT,
    action VARCHAR(32) NOT NULL DEFAULT 'eaten', -- eaten, liked, skipped
    skip_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suggestion_history_user ON suggestion_history (user_id, created_at DESC);

-- ── M2: saved collections ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_collections (
    user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    dish_ids TEXT[] NOT NULL DEFAULT '{}',
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, id)
);

-- ── M2: dish fields the app uses ────────────────────────────────────────────
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS weather_fit TEXT[] NOT NULL DEFAULT '{any}';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS img_key VARCHAR(32);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS macros JSONB NOT NULL DEFAULT '{}';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS difficulty VARCHAR(64);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS base_servings INT NOT NULL DEFAULT 2;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS market_cost_base INT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sort_order BIGINT NOT NULL DEFAULT 0; -- newest admin dishes first

-- ── M4: place fields the app uses + menu item names ─────────────────────────
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE places ADD COLUMN IF NOT EXISTS img_key VARCHAR(32);
ALTER TABLE places ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}';
ALTER TABLE places ADD COLUMN IF NOT EXISTS has_ac BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE places ADD COLUMN IF NOT EXISTS has_kids_seat BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE place_dishes ADD COLUMN IF NOT EXISTS menu_name VARCHAR(255);

-- crowd reports ("quán đóng cửa"), 3 reports auto-pause a place
CREATE TABLE IF NOT EXISTS place_reports (
    id VARCHAR(64) PRIMARY KEY,
    place_id VARCHAR(32) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    user_id VARCHAR(40) REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    report_count INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review', -- pending_review, auto_paused
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_place_reports_place ON place_reports (place_id);

-- ── M5: order deep-link redirects + loopback "đã ăn" ────────────────────────
CREATE TABLE IF NOT EXISTS order_redirects (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(40) REFERENCES users(id) ON DELETE CASCADE,
    place_id VARCHAR(32),
    place_name VARCHAR(255),
    dish_id VARCHAR(32),
    dish_name VARCHAR(255),
    partner VARCHAR(32) NOT NULL,
    target_deeplink TEXT NOT NULL,
    fallback_web_url TEXT,
    loopback_confirmed_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_redirects_user ON order_redirects (user_id, created_at DESC);

-- ── M7: campaigns as the app models them ────────────────────────────────────
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS package_name VARCHAR(255);
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS badge_label VARCHAR(64) NOT NULL DEFAULT 'Tài trợ';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS radius_m INT NOT NULL DEFAULT 3000;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget_monthly_vnd INT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget_vnd INT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS spent_vnd INT NOT NULL DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS impressions INT NOT NULL DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS clicks INT NOT NULL DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS filtered_fraud_clicks INT NOT NULL DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS conversions INT NOT NULL DEFAULT 0;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS roas NUMERIC(6,2);
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS created_by VARCHAR(40);
-- NULL balance = never topped up (first top-up starts from budget_monthly_vnd, as in memory mode)
ALTER TABLE ad_campaigns ALTER COLUMN balance_vnd DROP NOT NULL;
ALTER TABLE ad_campaigns ALTER COLUMN balance_vnd DROP DEFAULT;

-- the 60-second click guard keys on the device fingerprint; user ids are text now
ALTER TABLE ad_clicks ALTER COLUMN user_id TYPE VARCHAR(40) USING user_id::text;

-- ── M7: VietQR / PayOS payment orders (webhook credits only these) ──────────
CREATE TABLE IF NOT EXISTS payment_orders (
    order_id VARCHAR(64) PRIMARY KEY,
    order_code BIGINT NOT NULL UNIQUE,          -- PayOS orderCode
    campaign_id VARCHAR(32),
    amount_vnd BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT, COMPLETED
    created_by VARCHAR(40) REFERENCES users(id) ON DELETE SET NULL, -- money records are kept, the person is unlinked
    campaign_balance_after BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- ── M9: OCR moderation fields ───────────────────────────────────────────────
ALTER TABLE ocr_review_queue ADD COLUMN IF NOT EXISTS matched_dish_id VARCHAR(32);
ALTER TABLE ocr_review_queue ADD COLUMN IF NOT EXISTS matched_dish_name VARCHAR(255);
ALTER TABLE ocr_review_queue ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ── M9: audit log gets a target and the acting user id ──────────────────────
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS actor_id VARCHAR(40);
ALTER TABLE rbac_audit_logs ADD COLUMN IF NOT EXISTS target VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_logs_created ON rbac_audit_logs (created_at DESC);

-- ── M20: community recipes ──────────────────────────────────────────────────
ALTER TABLE community_recipes ADD COLUMN IF NOT EXISTS author_avatar VARCHAR(16);
CREATE INDEX IF NOT EXISTS idx_community_recipes_author ON community_recipes (author_id);
