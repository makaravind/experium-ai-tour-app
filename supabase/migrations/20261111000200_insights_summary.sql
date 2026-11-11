-- Insights page (GH-130, step 1): insights_summary(p_since) -> jsonb.
--
-- One round trip for every metric on /insights, called by GET /api/insights
-- with the service-role client. p_since is an absolute timestamp computed by
-- the API (IST midnight / now - 7d); NULL = all time.
--
-- Numbers are approximate by design (no event log):
--   * scans: one row per (user_id, qr_code_id, scan_src); scanned_at is the
--     FIRST scan, so "scans" counts new user/QR/source combinations.
--   * playbacks: one row per (user_id, exhibit_id, language);
--     listen_duration_sec is the longest single listen (GREATEST), not a
--     total, so minutes is a lower bound; played_at is the first play.
--
-- Response shape:
--   { "scans": 0, "visitors": 0, "minutes": 0, "listen_rate": 0,
--     "top_exhibits": [ { "display_id": "K1", "name": "...", "plays": 0 } ],
--     "languages": { "en": 0, "hi": 0, "te": 0 } }
-- Missing languages are 0, never absent. minutes / listen_rate are unrounded;
-- the UI formats them.
--
-- Drop first: CREATE OR REPLACE with a different signature creates an
-- overload, and PostgREST can't pick between overloads.

DROP FUNCTION IF EXISTS public.insights_summary(timestamptz);

CREATE FUNCTION public.insights_summary(p_since timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT jsonb_build_object(
    'scans', (
      SELECT count(*) FROM scans
      WHERE p_since IS NULL OR scanned_at >= p_since
    ),
    -- user_id is nullable (playbacks: ON DELETE SET NULL); count(distinct)
    -- ignores NULLs.
    'visitors', (
      SELECT count(DISTINCT user_id) FROM (
        SELECT user_id FROM scans
        WHERE p_since IS NULL OR scanned_at >= p_since
        UNION ALL
        SELECT user_id FROM playbacks
        WHERE p_since IS NULL OR played_at >= p_since
      ) u
    ),
    'minutes', (
      SELECT COALESCE(sum(listen_duration_sec), 0) / 60.0 FROM playbacks
      WHERE p_since IS NULL OR played_at >= p_since
    ),
    'listen_rate', (
      SELECT COALESCE(count(*) FILTER (WHERE listened)::numeric / NULLIF(count(*), 0), 0)
      FROM playbacks
      WHERE p_since IS NULL OR played_at >= p_since
    ),
    -- Ties broken by display ID so the order is stable between calls.
    'top_exhibits', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.plays DESC, t.display_id), '[]'::jsonb)
      FROM (
        SELECT e.section || e.number AS display_id, e.name, count(*) AS plays
        FROM playbacks p
        JOIN exhibits e ON e.id = p.exhibit_id
        WHERE p_since IS NULL OR p.played_at >= p_since
        GROUP BY e.id, e.section, e.number, e.name
        ORDER BY plays DESC, display_id
        LIMIT 5
      ) t
    ),
    'languages', (
      SELECT jsonb_build_object(
        'en', count(*) FILTER (WHERE language = 'en'),
        'hi', count(*) FILTER (WHERE language = 'hi'),
        'te', count(*) FILTER (WHERE language = 'te')
      )
      FROM playbacks
      WHERE p_since IS NULL OR played_at >= p_since
    )
  );
$function$;

-- Service role only (called from /api/insights behind the key gate).
REVOKE ALL ON FUNCTION public.insights_summary(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insights_summary(timestamptz) TO service_role;
