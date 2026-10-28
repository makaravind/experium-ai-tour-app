-- Split scans / playbacks (step 2): upsert functions.
--
-- upsert_scan: physical QR scans only (discovery + scan count). Audio params
-- and device_info are gone — those columns were dropped from scans in the
-- previous migration. Audio engagement goes through upsert_playback.
--
-- Drop first: CREATE OR REPLACE with a different signature creates an
-- overload, and PostgREST can't pick between overloads.

DROP FUNCTION IF EXISTS public.upsert_scan(uuid, uuid, boolean, integer, integer, boolean, text, boolean, jsonb, timestamptz);

CREATE FUNCTION public.upsert_scan(
  p_user_id uuid,
  p_qr_code_id uuid,
  p_is_qr_scan boolean,
  p_scan_src text,
  p_discovered boolean,
  p_scanned_at timestamptz
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO scans (user_id, qr_code_id, discovered, scanned_count, scan_src, scanned_at)
  VALUES (
    p_user_id, p_qr_code_id, p_discovered,
    CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    -- scan_src is part of the unique key; NULL would never conflict.
    COALESCE(p_scan_src, 'unknown'),
    -- Cap at now() so a client clock set in the future can't write future rows.
    LEAST(COALESCE(p_scanned_at, now()), now())
  )
  ON CONFLICT (user_id, qr_code_id, scan_src) DO UPDATE SET
    discovered    = scans.discovered OR EXCLUDED.discovered,
    scanned_count = scans.scanned_count + CASE WHEN p_is_qr_scan THEN 1 ELSE 0 END,
    updated_at    = now();
$function$;

-- upsert_playback: audio engagement per (user, exhibit, language), no QR
-- dependency. Keeps the best state across replays. updated_at is set here
-- because the playbacks table has no updated_at trigger.
CREATE FUNCTION public.upsert_playback(
  p_user_id uuid,
  p_exhibit_id uuid,
  p_language text,
  p_listened boolean,
  p_listen_duration_sec integer,
  p_listen_quartile integer,
  p_played_at timestamptz
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO playbacks (user_id, exhibit_id, language, listened, listen_duration_sec, listen_quartile, played_at, updated_at)
  VALUES (
    p_user_id, p_exhibit_id, COALESCE(p_language, 'en'), p_listened,
    p_listen_duration_sec, p_listen_quartile,
    LEAST(COALESCE(p_played_at, now()), now()),
    now()
  )
  ON CONFLICT (user_id, exhibit_id, language) DO UPDATE SET
    listened            = playbacks.listened OR EXCLUDED.listened,
    listen_duration_sec = GREATEST(playbacks.listen_duration_sec, EXCLUDED.listen_duration_sec),
    listen_quartile     = GREATEST(playbacks.listen_quartile, EXCLUDED.listen_quartile),
    updated_at          = now();
$function$;
