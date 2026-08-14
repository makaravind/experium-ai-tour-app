-- Unique constraint to support ON CONFLICT upsert in upsert_scan

CREATE UNIQUE INDEX IF NOT EXISTS scans_user_qr_unique ON scans (user_id, qr_code_id);
