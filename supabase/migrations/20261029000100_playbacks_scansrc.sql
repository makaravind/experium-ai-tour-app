-- Add scansrc to playbacks so each source (onsite, app, camera, unknown) gets
-- its own row. Raw event log per source; reads aggregate with EXISTS/OR.

ALTER TABLE playbacks
  ADD COLUMN IF NOT EXISTS scansrc TEXT NOT NULL DEFAULT 'unknown';

-- Drop old unique index and recreate with scansrc included.
DROP INDEX IF EXISTS playbacks_user_exhibit_lang;
CREATE UNIQUE INDEX playbacks_user_exhibit_lang_src
  ON playbacks (user_id, exhibit_id, language, scansrc);

-- Recreate upsert_playback with p_scan_src parameter.
DROP FUNCTION IF EXISTS public.upsert_playback(uuid, uuid, text, boolean, integer, integer, timestamptz);

CREATE FUNCTION public.upsert_playback(
  p_user_id             uuid,
  p_exhibit_id          uuid,
  p_language            text,
  p_listened            boolean,
  p_listen_duration_sec integer,
  p_listen_quartile     integer,
  p_played_at           timestamptz,
  p_scan_src            text DEFAULT NULL
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO playbacks (user_id, exhibit_id, language, scansrc, listened, listen_duration_sec, listen_quartile, played_at, updated_at)
  VALUES (
    p_user_id, p_exhibit_id,
    COALESCE(p_language, 'en'),
    COALESCE(p_scan_src, 'unknown'),
    p_listened,
    p_listen_duration_sec, p_listen_quartile,
    LEAST(COALESCE(p_played_at, now()), now()),
    now()
  )
  ON CONFLICT (user_id, exhibit_id, language, scansrc) DO UPDATE SET
    listened            = playbacks.listened OR EXCLUDED.listened,
    listen_duration_sec = GREATEST(playbacks.listen_duration_sec, EXCLUDED.listen_duration_sec),
    listen_quartile     = GREATEST(playbacks.listen_quartile, EXCLUDED.listen_quartile),
    updated_at          = now();
$function$;
