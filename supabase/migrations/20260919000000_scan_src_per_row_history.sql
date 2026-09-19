-- Preserve scan source history: one row per (user, exhibit, source) instead of
-- overwriting scan_src on every re-scan. Analytics needs "which sources has
-- this user/exhibit pair been discovered from", not just the latest one.

-- Backfill legacy NULL scan_src before it becomes part of the unique key —
-- NULL != NULL in a unique index, so leaving it NULL would let repeat
-- no-source visits insert unbounded duplicate rows.
UPDATE scans SET scan_src = 'unknown' WHERE scan_src IS NULL;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_user_qr_unique;
DROP INDEX IF EXISTS scans_user_qr_unique;
CREATE UNIQUE INDEX IF NOT EXISTS scans_user_qr_src_unique ON scans (user_id, qr_code_id, scan_src);

CREATE OR REPLACE FUNCTION public.upsert_scan(
  p_user_id uuid,
  p_qr_code_id uuid,
  p_listened boolean,
  p_listen_duration_sec integer,
  p_listen_quartile integer,
  p_is_qr_scan boolean,
  p_scan_src text,
  p_discovered boolean,
  p_device_info jsonb
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO scans (user_id, qr_code_id, listened, discovered, listen_duration_sec, listen_quartile, scanned_count, scan_src, device_info)
  VALUES (
    p_user_id, p_qr_code_id, p_listened, p_discovered,
    p_listen_duration_sec, p_listen_quartile,
    CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    COALESCE(p_scan_src, 'unknown'), p_device_info
  )
  ON CONFLICT (user_id, qr_code_id, scan_src) DO UPDATE SET
    listened            = scans.listened OR EXCLUDED.listened,
    discovered          = scans.discovered OR EXCLUDED.discovered,
    listen_duration_sec = EXCLUDED.listen_duration_sec,
    listen_quartile     = GREATEST(scans.listen_quartile, EXCLUDED.listen_quartile),
    scanned_count       = scans.scanned_count + CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    device_info         = EXCLUDED.device_info,
    updated_at          = now();
$function$;

-- total_discovered must count distinct exhibits, not distinct scan rows —
-- an exhibit discovered via one source and re-scanned via another must
-- still count once.
CREATE OR REPLACE FUNCTION public.total_discovered(p_user_id uuid)
RETURNS integer LANGUAGE sql AS $function$
  SELECT COUNT(DISTINCT qr_code_id)::int FROM scans WHERE user_id = p_user_id AND discovered = true;
$function$;
