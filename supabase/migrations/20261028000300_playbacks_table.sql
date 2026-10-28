-- Split scans / playbacks: `scans` = physical QR discovery only,
-- `playbacks` = audio engagement per exhibit (no QR dependency).
-- device_info moves from scans to users (written on handshake).
--
-- NOTE: the currently deployed upsert_scan still references the dropped
-- columns; it is replaced in the next migration (upsert functions).

ALTER TABLE scans
  DROP COLUMN IF EXISTS listened,
  DROP COLUMN IF EXISTS listen_duration_sec,
  DROP COLUMN IF EXISTS listen_quartile,
  DROP COLUMN IF EXISTS ad_clicked,
  DROP COLUMN IF EXISTS device_info;

ALTER TABLE users ADD COLUMN IF NOT EXISTS device_info JSONB;

CREATE TABLE playbacks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id          UUID NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  language            TEXT NOT NULL DEFAULT 'en',
  listened            BOOLEAN NOT NULL DEFAULT false,
  listen_duration_sec INT,
  listen_quartile     INT,
  played_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX playbacks_user_exhibit_lang ON playbacks (user_id, exhibit_id, language);

-- Written only via the service-role client (/api/scan); no anon policies.
ALTER TABLE playbacks ENABLE ROW LEVEL SECURITY;
