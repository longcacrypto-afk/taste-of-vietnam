-- =============================================================================
-- POSTGRESQL + POSTGIS + PGVECTOR SCHEMA
-- Hôm nay ăn gì · Taste of Vietnam (Phase E Production Database Specification)
-- Tuân thủ PDPD Nghị định 13/2023/NĐ-CP & Quy tắc nghiệp vụ Non-Negotiable
-- =============================================================================

-- 1. KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. BẢNG MÓN ĂN & CÔNG THỨC (M2 DISH LIBRARY)
CREATE TABLE IF NOT EXISTS dishes (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unaccented_name VARCHAR(255) NOT NULL,
    region VARCHAR(64) NOT NULL, -- 'Bắc', 'Trung', 'Nam', 'Toàn quốc'
    meal_slots TEXT[] NOT NULL DEFAULT '{"lunch", "dinner"}', -- breakfast, lunch, dinner, snack, late_night
    diet_flags TEXT[] NOT NULL DEFAULT '{}', -- vegan, vegetarian, halal, keto, low_carb
    allergen_flags TEXT[] NOT NULL DEFAULT '{}', -- peanuts, seafood, shellfish, gluten, dairy, egg, soy
    spice_level INT NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
    calories INT NOT NULL DEFAULT 400,
    prep_time_minutes INT NOT NULL DEFAULT 25,
    estimated_price_vnd INT NOT NULL DEFAULT 50000,
    ingredients JSONB NOT NULL DEFAULT '[]', -- [{name, amount, unit, is_allergen}]
    recipe_steps JSONB NOT NULL DEFAULT '[]', -- [{step, instruction, duration_min}]
    embedding vector(768), -- pgvector embedding for semantic dish search (Gemini 768-dim)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tìm kiếm & bộ lọc
CREATE INDEX IF NOT EXISTS idx_dishes_unaccented ON dishes USING gin(unaccented_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dishes_allergen_flags ON dishes USING gin(allergen_flags);
CREATE INDEX IF NOT EXISTS idx_dishes_diet_flags ON dishes USING gin(diet_flags);
CREATE INDEX IF NOT EXISTS idx_dishes_meal_slots ON dishes USING gin(meal_slots);

-- 3. BẢNG QUÁN ĂN & ĐỊA ĐIỂM (M4 POSTGIS SPATIAL)
CREATE TABLE IF NOT EXISTS places (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    geom GEOGRAPHY(Point, 4326) NOT NULL, -- Tọa độ WGS84 PostGIS
    open_time TIME NOT NULL DEFAULT '06:00:00',
    close_time TIME NOT NULL DEFAULT '22:00:00',
    rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
    review_count INT NOT NULL DEFAULT 0,
    report_count INT NOT NULL DEFAULT 0,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE, -- Auto-pause khi report_count >= 3
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING gist(geom);
CREATE INDEX IF NOT EXISTS idx_places_paused ON places (is_paused);

-- 4. BẢNG MÓN BÁN TẠI QUÁN (M4 MENU RELATIONS)
CREATE TABLE IF NOT EXISTS place_dishes (
    place_id VARCHAR(32) REFERENCES places(id) ON DELETE CASCADE,
    dish_id VARCHAR(32) REFERENCES dishes(id) ON DELETE CASCADE,
    price_vnd INT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (place_id, dish_id)
);

-- 5. BẢNG HỒ SƠ NGƯỜI DÙNG & PDPD (M1 AUTH & PRIVACY)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_hash VARCHAR(64) UNIQUE, -- SHA-256 hash của số điện thoại
    spice_tolerance INT NOT NULL DEFAULT 1 CHECK (spice_tolerance BETWEEN 0 AND 3),
    diet_mode VARCHAR(32) NOT NULL DEFAULT 'normal', -- normal, vegan, vegetarian, keto
    hard_allergies TEXT[] NOT NULL DEFAULT '{}', -- BẮT BUỘC CHẶN 100%
    disliked_ingredients TEXT[] NOT NULL DEFAULT '{}',
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    max_daily_push_notifications INT NOT NULL DEFAULT 2, -- Giới hạn <= 2 push/ngày (M8)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. BẢNG LỊCH SỬ ĂN UỐNG (M3 3-DAY COOLDOWN & M5 LOOPBACK)
CREATE TABLE IF NOT EXISTS eaten_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    dish_id VARCHAR(32) REFERENCES dishes(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL DEFAULT 'manual', -- manual, grab_redirect, loopback
    eaten_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eaten_logs_user_dish ON eaten_logs (user_id, dish_id, eaten_at DESC);

-- 7. BẢNG QUẢNG CÁO & TÀI TRỢ (M7 SPONSORED ADS)
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id VARCHAR(32) PRIMARY KEY,
    place_id VARCHAR(32) REFERENCES places(id) ON DELETE CASCADE,
    dish_id VARCHAR(32) REFERENCES dishes(id) ON DELETE CASCADE,
    cpc_vnd INT NOT NULL DEFAULT 4000,
    balance_vnd INT NOT NULL DEFAULT 1000000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BẢNG CLICK QUẢNG CÁO & CHỐNG CLICK TẶC (M7 ANTI-FRAUD 60S GUARD)
CREATE TABLE IF NOT EXISTS ad_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(32) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    ip_hash VARCHAR(64) NOT NULL,
    user_id UUID,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE nếu click lặp lại trong vòng 60s
    dedup_window_seconds INT NOT NULL DEFAULT 60,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_dedup ON ad_clicks (campaign_id, ip_hash, clicked_at DESC);

-- 9. BẢNG ĐÁNH GIÁ XÁC MINH GPS (M12 GPS ≤ 500M REVIEW GUARD)
CREATE TABLE IF NOT EXISTS place_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id VARCHAR(32) REFERENCES places(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    gps_distance_meters INT NOT NULL,
    is_gps_verified BOOLEAN NOT NULL, -- TRUE nếu gps_distance_meters <= 500
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. BẢNG HÀNG ĐỢI OCR REVIEW (M6/M9 OCR QUEUE)
CREATE TABLE IF NOT EXISTS ocr_review_queue (
    id VARCHAR(32) PRIMARY KEY,
    place_id VARCHAR(32) REFERENCES places(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    extracted_dish_name VARCHAR(255) NOT NULL,
    extracted_price_vnd INT NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. BẢNG ĐẶT BÀN (M13 TABLE BOOKINGS)
CREATE TABLE IF NOT EXISTS table_bookings (
    id VARCHAR(32) PRIMARY KEY,
    place_id VARCHAR(32) REFERENCES places(id) ON DELETE CASCADE,
    user_id UUID,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    guests_count INT NOT NULL DEFAULT 2,
    special_note TEXT,
    voucher_code VARCHAR(32) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled, completed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. BẢNG AUDIT LOG BẤT BIẾN (M9 IMMUTABLE AUDIT LOG)
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL, -- SuperAdmin, ContentMod, AdMod, MerchantOps, DataAnalyst, SupportAgent
    action TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PHASE 2 SCALE & EXPANSION TABLES (M11–M17)
-- =============================================================================

-- 13. BẢNG KẾ HOẠCH THỰC ĐƠN TUẦN & GIỎ ĐI CHỢ (M11 WEEKLY MEAL PLANS)
CREATE TABLE IF NOT EXISTS weekly_meal_plans (
    id VARCHAR(32) PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    plan_slots JSONB NOT NULL DEFAULT '[]', -- [{day, dish_id, calories, cost_vnd}]
    consolidated_groceries JSONB NOT NULL DEFAULT '[]', -- [{name, amount, unit, in_fridge}]
    total_budget_vnd INT NOT NULL DEFAULT 450000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. BẢNG BÌNH CHỌN ĂN NHÓM & VOTE (M12 GROUP POLLS)
CREATE TABLE IF NOT EXISTS group_polls (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    creator_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    member_allergies_union TEXT[] NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '[]', -- [{dish_id, name, votes}]
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. BẢNG CÂU CHUYỆN DI SẢN ẨM THỰC & BẢN ĐỒ BIẾN THỂ (M14 CULTURAL STORIES)
CREATE TABLE IF NOT EXISTS cultural_stories (
    id VARCHAR(32) PRIMARY KEY,
    dish_id VARCHAR(32) REFERENCES dishes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    history_summary TEXT NOT NULL,
    regional_variants JSONB NOT NULL DEFAULT '[]', -- [{region, broth, noodles, herbs}]
    audio_guide_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. BẢNG FOOD TRAIL & HỘ CHIẾU ẨM THỰC QR (M15 FOOD TRAILS)
CREATE TABLE IF NOT EXISTS food_trails (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    city VARCHAR(64) NOT NULL DEFAULT 'Hà Nội',
    stops JSONB NOT NULL DEFAULT '[]', -- [{order, place_id, dish_name, story}]
    passport_badge VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. BẢNG BÁO CÁO DU LỊCH B2G & K-ANONYMITY (M17 TOURISM INSIGHTS)
CREATE TABLE IF NOT EXISTS b2g_tourism_reports (
    id VARCHAR(32) PRIMARY KEY,
    report_period VARCHAR(32) NOT NULL, -- '7d', '30d', 'quarter'
    k_anonymity_min_group INT NOT NULL DEFAULT 50, -- k >= 50
    specialty_search_count INT NOT NULL,
    international_tourist_count INT NOT NULL,
    trending_dishes JSONB NOT NULL DEFAULT '[]',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
