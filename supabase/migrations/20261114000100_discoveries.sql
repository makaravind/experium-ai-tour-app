-- Discovery rules & campaigns (#133, step 1): `discoveries` fact table behind
-- the trail count. `scans` stays "a visitor scanned a physical marker" and
-- `playbacks` is unchanged. No backfill: nothing is read from or truncated in
-- scans; discoveries starts empty.

CREATE TABLE discoveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exhibit_id    UUID NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
  campaign_id   TEXT NOT NULL,
  via           TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exhibit_id, campaign_id)
);

CREATE INDEX discoveries_user_campaign ON discoveries (user_id, campaign_id);

-- Written only via the service-role client; no anon policies.
ALTER TABLE discoveries ENABLE ROW LEVEL SECURITY;

-- record_discovery: true only when the row is new (first discovery of this
-- exhibit in this campaign). Re-discoveries are no-ops and keep the first
-- discovered_at / via.
CREATE FUNCTION public.record_discovery(
  p_user_id uuid,
  p_exhibit_id uuid,
  p_campaign_id text,
  p_via text,
  p_at timestamptz
) RETURNS boolean LANGUAGE sql AS $function$
  WITH ins AS (
    INSERT INTO discoveries (user_id, exhibit_id, campaign_id, via, discovered_at)
    VALUES (
      p_user_id, p_exhibit_id, p_campaign_id, p_via,
      -- Cap at now() so a client clock set in the future can't write future rows.
      LEAST(COALESCE(p_at, now()), now())
    )
    ON CONFLICT (user_id, exhibit_id, campaign_id) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins);
$function$;

-- total_discovered gains a campaign. Drop first: CREATE OR REPLACE with a
-- different signature creates an overload, and PostgREST can't pick between
-- overloads. The default on p_campaign_id keeps 1-arg RPC calls working.
DROP FUNCTION IF EXISTS public.total_discovered(uuid);

CREATE FUNCTION public.total_discovered(
  p_user_id uuid,
  p_campaign_id text DEFAULT 'default'
) RETURNS integer LANGUAGE sql AS $function$
  SELECT COUNT(*)::int FROM discoveries WHERE user_id = p_user_id AND campaign_id = p_campaign_id;
$function$;
