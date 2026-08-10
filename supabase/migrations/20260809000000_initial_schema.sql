-- ============================================================
-- Experium Nature Audio Tour — initial schema
-- m1-foundation / Issue #16
-- ============================================================

-- ------------------------------------------------------------
-- 0. Drop existing tables (clean slate)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS reports          CASCADE;
DROP TABLE IF EXISTS scans            CASCADE;
DROP TABLE IF EXISTS ads              CASCADE;
DROP TABLE IF EXISTS ad_sponsors      CASCADE;
DROP TABLE IF EXISTS exhibit_qr_codes CASCADE;
DROP TABLE IF EXISTS exhibit_photos   CASCADE;
DROP TABLE IF EXISTS exhibit_audio    CASCADE;
DROP TABLE IF EXISTS users            CASCADE;
DROP TABLE IF EXISTS exhibits         CASCADE;

-- ------------------------------------------------------------
-- 1. updated_at trigger function (shared)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. Tables (dependency order)
-- ------------------------------------------------------------

-- exhibits
CREATE TABLE exhibits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('plant','structure','water_body','landmark')),
  tier        TEXT NOT NULL DEFAULT 'silver' CHECK (tier IN ('gold','silver','bronze')),
  description TEXT,
  facts       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_exhibits_updated_at
  BEFORE UPDATE ON exhibits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- exhibit_audio
CREATE TABLE exhibit_audio (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
  language    TEXT NOT NULL CHECK (language IN ('en','hi','te')),
  script      TEXT,
  audio_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exhibit_id, language)
);
CREATE TRIGGER trg_exhibit_audio_updated_at
  BEFORE UPDATE ON exhibit_audio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- exhibit_photos
CREATE TABLE exhibit_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,
  is_hero     BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0
);

-- exhibit_qr_codes
CREATE TABLE exhibit_qr_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  exhibit_id   UUID REFERENCES exhibits(id) ON DELETE SET NULL,
  gps_lat      FLOAT8,
  gps_lng      FLOAT8,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_attention','inactive')),
  install_date DATE,
  last_checked DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_exhibit_qr_codes_updated_at
  BEFORE UPDATE ON exhibit_qr_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ad_sponsors
CREATE TABLE ad_sponsors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  logo_url     TEXT,
  contact_info TEXT
);

-- users
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id TEXT UNIQUE,
  type           TEXT NOT NULL DEFAULT 'visitor' CHECK (type IN ('visitor','maintainer')),
  name           TEXT,
  phone          TEXT,
  email          TEXT,
  language_pref  TEXT NOT NULL DEFAULT 'en' CHECK (language_pref IN ('en','hi','te')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- scans
CREATE TABLE scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id          UUID NOT NULL REFERENCES exhibit_qr_codes(id),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  scanned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_info         JSONB,
  listened            BOOLEAN NOT NULL DEFAULT false,
  listen_duration_sec INT,
  ad_clicked          BOOLEAN NOT NULL DEFAULT false,
  discovered          BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ads
CREATE TABLE ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  sponsor_id  UUID NOT NULL REFERENCES ad_sponsors(id),
  image_url   TEXT,
  click_url   TEXT,
  placement   TEXT NOT NULL CHECK (placement IN ('splash','banner','post_audio')),
  tier_target TEXT NOT NULL CHECK (tier_target IN ('gold','silver','bronze','all')),
  active      BOOLEAN NOT NULL DEFAULT false,
  start_date  DATE,
  end_date    DATE
);

-- reports
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id  UUID NOT NULL REFERENCES exhibit_qr_codes(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  issue_type  TEXT NOT NULL CHECK (issue_type IN ('wrong_info','damaged','audio_broken','other')),
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 3. Enable RLS on all tables
-- ------------------------------------------------------------
ALTER TABLE exhibits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibit_audio     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibit_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibit_qr_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sponsors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. RLS policies
-- ------------------------------------------------------------

-- exhibits: anon SELECT, admin ALL
CREATE POLICY "anon_select_exhibits" ON exhibits
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_exhibits" ON exhibits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exhibit_audio: anon SELECT, admin ALL
CREATE POLICY "anon_select_exhibit_audio" ON exhibit_audio
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_exhibit_audio" ON exhibit_audio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exhibit_photos: anon SELECT, admin ALL
CREATE POLICY "anon_select_exhibit_photos" ON exhibit_photos
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_exhibit_photos" ON exhibit_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exhibit_qr_codes: anon SELECT (needed for /s/[code]), admin ALL
CREATE POLICY "anon_select_exhibit_qr_codes" ON exhibit_qr_codes
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_exhibit_qr_codes" ON exhibit_qr_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ad_sponsors: anon blocked, admin ALL
CREATE POLICY "admin_all_ad_sponsors" ON ad_sponsors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- users: anon INSERT only, admin ALL
CREATE POLICY "anon_insert_users" ON users
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_all_users" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- scans: anon INSERT only, admin ALL
CREATE POLICY "anon_insert_scans" ON scans
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_all_scans" ON scans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ads: anon SELECT active only, admin ALL
CREATE POLICY "anon_select_active_ads" ON ads
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "admin_all_ads" ON ads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- reports: anon INSERT only, admin ALL
CREATE POLICY "anon_insert_reports" ON reports
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_all_reports" ON reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
