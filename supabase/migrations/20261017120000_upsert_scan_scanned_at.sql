-- Offline scan queue (#67): accept the device's scan time so scans replayed
-- after reconnect keep the time the visitor was at the marker.
--
-- Drop first: CREATE OR REPLACE with a different signature creates an
-- overload, and PostgREST can't pick between overloads. The default on
-- p_scanned_at keeps the currently deployed app (which omits it) working.

DROP FUNCTION IF EXISTS public.upsert_scan(uuid, uuid, boolean, integer, integer, boolean, text, boolean, jsonb);

CREATE FUNCTION public.upsert_scan(
  p_user_id uuid,
  p_qr_code_id uuid,
  p_listened boolean,
  p_listen_duration_sec integer,
  p_listen_quartile integer,
  p_is_qr_scan boolean,
  p_scan_src text,
  p_discovered boolean,
  p_device_info jsonb,
  p_scanned_at timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO scans (user_id, qr_code_id, listened, discovered, listen_duration_sec, listen_quartile, scanned_count, scan_src, device_info, scanned_at)
  VALUES (
    p_user_id, p_qr_code_id, p_listened, p_discovered,
    p_listen_duration_sec, p_listen_quartile,
    CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    COALESCE(p_scan_src, 'unknown'), p_device_info,
    -- Cap at now() so a client clock set in the future can't write future rows.
    LEAST(COALESCE(p_scanned_at, now()), now())
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
