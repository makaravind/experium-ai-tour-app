-- Track QR scan count and scan source (issue #31)

ALTER TABLE scans ADD COLUMN IF NOT EXISTS scanned_count integer NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_src text;

CREATE OR REPLACE FUNCTION public.upsert_scan(
  p_user_id uuid,
  p_qr_code_id uuid,
  p_listened boolean,
  p_listen_duration_sec integer,
  p_listen_quartile integer,
  p_is_qr_scan boolean,
  p_scan_src text,
  p_device_info jsonb
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO scans (user_id, qr_code_id, listened, discovered, listen_duration_sec, listen_quartile, scanned_count, scan_src, device_info)
  VALUES (
    p_user_id, p_qr_code_id, p_listened, true,
    p_listen_duration_sec, p_listen_quartile,
    CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    p_scan_src, p_device_info
  )
  ON CONFLICT (user_id, qr_code_id) DO UPDATE SET
    listened            = scans.listened OR EXCLUDED.listened,
    listen_duration_sec = EXCLUDED.listen_duration_sec,
    listen_quartile     = GREATEST(scans.listen_quartile, EXCLUDED.listen_quartile),
    scanned_count       = scans.scanned_count + CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    scan_src            = COALESCE(EXCLUDED.scan_src, scans.scan_src),
    device_info         = EXCLUDED.device_info,
    updated_at          = now();
$function$;
