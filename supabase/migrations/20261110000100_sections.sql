-- Sections + display IDs (exhibit admin tool, step 1)
--
-- Adds `sections` (letter-named polygons over the park), nullable
-- exhibits.section / exhibits.number (display ID = section || number, e.g. A3),
-- and admin_apply_changes(jsonb): one transactional write used by the dev-only
-- admin tool (POST /api/admin/save). exhibits.code is untouched (permanent QR id).
-- A follow-up migration sets section/number NOT NULL once data is placed.
--
-- ------------------------------------------------------------
-- admin_apply_changes(changes jsonb) — input shape
-- ------------------------------------------------------------
-- Every top-level key is optional; omitted = nothing to do. Applied in this
-- order, all in one transaction (any error rolls everything back):
--   1. sections.rename  2. sections.upsert  3. exhibits  4. audio
--   5. photos.delete/update/insert  6. sections.delete  7. unique check
--
-- {
--   "sections": {
--     "rename": [ { "from": "A", "to": "B" } ],        -- applied in array order;
--                                                      -- exhibits.section follows via
--                                                      -- ON UPDATE CASCADE; "to" must not exist
--                                                      -- (no swaps — chain via a spare letter)
--     "upsert": [ { "id": "B", "polygon": [[lng,lat], ...] } ],
--                                                      -- use the NEW id after a rename;
--                                                      -- id is letters A-Z only; polygon >= 3 points
--     "delete": [ "C" ]                                -- fails if any exhibit still has it
--   },
--   "exhibits": [                                      -- upsert by id (client-generated UUID)
--     {
--       "id": "<uuid>",                                -- REQUIRED. Not in table => insert
--       "name": "...",                                 -- required when inserting
--       "type": "flora|structure|water_body|landmark|null",
--       "tier": "gold|silver|bronze",                  -- insert default: silver
--       "status": "live|coming_soon",                  -- insert default: live
--       "description": "..."|null,
--       "facts": [ ... ]|null,
--       "gps_lat": 17.38, "gps_lng": 78.19,
--       "section": "B"|null, "number": 3|null          -- both set or both null
--     }
--   ],
--   -- Existing row: PARTIAL update — only keys present are written (an explicit
--   -- null clears a nullable column). New row: code = max(code)+1, never sent.
--   "audio": [                                         -- upsert by (exhibit_id, language)
--     { "exhibit_id": "<uuid>", "language": "en|hi|te",
--       "script": "..."|null, "status": "draft|ready|published",   -- insert default: draft
--       "url": "..."|null }                            -- stored in exhibit_audio.audio_url
--   ],                                                 -- partial on update, same as exhibits
--   "photos": {
--     "insert": [ { "id": "<uuid>"?, "exhibit_id": "<uuid>", "url": "...",
--                   "caption": "..."|null, "is_hero": false, "sort_order": 0 } ],
--     "update": [ { "id": "<uuid>", "url"?, "caption"?, "is_hero"?, "sort_order"? } ],
--                                                      -- partial, by id
--     "delete": [ "<photo uuid>" ]
--   }
-- }
--
-- Returns: { "exhibits_created": [ { "id": "<uuid>", "code": 12 } ] }
-- so the caller can show the codes assigned to new exhibits.
--
-- (section, number) uniqueness is DEFERRABLE INITIALLY DEFERRED so numbers can
-- be swapped/shifted within one call; the function forces the check at the end
-- so a violation surfaces as this function's error, not at commit.

-- ------------------------------------------------------------
-- 1. sections
-- ------------------------------------------------------------
CREATE TABLE sections (
  id         TEXT PRIMARY KEY CHECK (id ~ '^[A-Z]+$'),
  polygon    JSONB NOT NULL
             CHECK (jsonb_typeof(polygon) = 'array' AND jsonb_array_length(polygon) >= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- sections: anon SELECT, admin ALL (writes go through service role)
CREATE POLICY "anon_select_sections" ON sections
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_sections" ON sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 2. exhibits.section / exhibits.number (nullable until migration 2)
-- ------------------------------------------------------------
ALTER TABLE exhibits
  ADD COLUMN section TEXT REFERENCES sections(id) ON UPDATE CASCADE,
  ADD COLUMN number  SMALLINT CHECK (number > 0),
  ADD CONSTRAINT exhibits_section_number_both CHECK ((section IS NULL) = (number IS NULL)),
  ADD CONSTRAINT exhibits_section_number_key UNIQUE (section, number)
    DEFERRABLE INITIALLY DEFERRED;

-- ------------------------------------------------------------
-- 3. admin_apply_changes
-- ------------------------------------------------------------
CREATE FUNCTION public.admin_apply_changes(changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r       jsonb;
  ex_id   uuid;
  created jsonb := '[]'::jsonb;
  new_code smallint;
BEGIN
  IF changes IS NULL OR jsonb_typeof(changes) <> 'object' THEN
    RAISE EXCEPTION 'changes must be a JSON object';
  END IF;

  -- 1. section renames (exhibits.section follows via ON UPDATE CASCADE)
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{sections,rename}', '[]'))
  LOOP
    UPDATE sections SET id = r->>'to' WHERE id = r->>'from';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot rename section %: not found', r->>'from';
    END IF;
  END LOOP;

  -- 2. section upserts
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{sections,upsert}', '[]'))
  LOOP
    INSERT INTO sections (id, polygon)
    VALUES (r->>'id', r->'polygon')
    ON CONFLICT (id) DO UPDATE SET polygon = EXCLUDED.polygon;
  END LOOP;

  -- 3. exhibits: partial update when the id exists, else insert with next code
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes->'exhibits', '[]'))
  LOOP
    ex_id := (r->>'id')::uuid;
    IF ex_id IS NULL THEN
      RAISE EXCEPTION 'exhibit is missing id: %', r;
    END IF;

    IF EXISTS (SELECT 1 FROM exhibits WHERE id = ex_id) THEN
      UPDATE exhibits SET
        name        = CASE WHEN r ? 'name'        THEN r->>'name'        ELSE name        END,
        type        = CASE WHEN r ? 'type'        THEN r->>'type'        ELSE type        END,
        tier        = CASE WHEN r ? 'tier'        THEN r->>'tier'        ELSE tier        END,
        status      = CASE WHEN r ? 'status'      THEN r->>'status'      ELSE status      END,
        description = CASE WHEN r ? 'description' THEN r->>'description' ELSE description END,
        facts       = CASE WHEN r ? 'facts'       THEN NULLIF(r->'facts', 'null'::jsonb) ELSE facts END,
        gps_lat     = CASE WHEN r ? 'gps_lat'     THEN (r->>'gps_lat')::float8 ELSE gps_lat END,
        gps_lng     = CASE WHEN r ? 'gps_lng'     THEN (r->>'gps_lng')::float8 ELSE gps_lng END,
        section     = CASE WHEN r ? 'section'     THEN r->>'section'     ELSE section     END,
        number      = CASE WHEN r ? 'number'      THEN (r->>'number')::smallint ELSE number END
      WHERE id = ex_id;
    ELSE
      SELECT COALESCE(MAX(code), 0) + 1 INTO new_code FROM exhibits;
      INSERT INTO exhibits (id, code, name, type, tier, status, description, facts, gps_lat, gps_lng, section, number)
      VALUES (
        ex_id, new_code, r->>'name', r->>'type',
        COALESCE(r->>'tier', 'silver'), COALESCE(r->>'status', 'live'),
        r->>'description', NULLIF(r->'facts', 'null'::jsonb),
        (r->>'gps_lat')::float8, (r->>'gps_lng')::float8,
        r->>'section', (r->>'number')::smallint
      );
      created := created || jsonb_build_object('id', ex_id, 'code', new_code);
    END IF;
  END LOOP;

  -- 4. audio: upsert by (exhibit_id, language); partial on update
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes->'audio', '[]'))
  LOOP
    INSERT INTO exhibit_audio (exhibit_id, language, script, status, audio_url)
    VALUES (
      (r->>'exhibit_id')::uuid, r->>'language', r->>'script',
      COALESCE(r->>'status', 'draft'), r->>'url'
    )
    ON CONFLICT (exhibit_id, language) DO UPDATE SET
      script    = CASE WHEN r ? 'script' THEN r->>'script' ELSE exhibit_audio.script    END,
      status    = CASE WHEN r ? 'status' THEN r->>'status' ELSE exhibit_audio.status    END,
      audio_url = CASE WHEN r ? 'url'    THEN r->>'url'    ELSE exhibit_audio.audio_url END;
  END LOOP;

  -- 5. photos: delete, update (partial), insert
  DELETE FROM exhibit_photos
  WHERE id IN (
    SELECT (j #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(changes #> '{photos,delete}', '[]')) j
  );

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{photos,update}', '[]'))
  LOOP
    UPDATE exhibit_photos SET
      url        = CASE WHEN r ? 'url'        THEN r->>'url'                  ELSE url        END,
      caption    = CASE WHEN r ? 'caption'    THEN r->>'caption'              ELSE caption    END,
      is_hero    = CASE WHEN r ? 'is_hero'    THEN (r->>'is_hero')::boolean   ELSE is_hero    END,
      sort_order = CASE WHEN r ? 'sort_order' THEN (r->>'sort_order')::int    ELSE sort_order END
    WHERE id = (r->>'id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot update photo %: not found', r->>'id';
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{photos,insert}', '[]'))
  LOOP
    INSERT INTO exhibit_photos (id, exhibit_id, url, caption, is_hero, sort_order)
    VALUES (
      COALESCE((r->>'id')::uuid, gen_random_uuid()), (r->>'exhibit_id')::uuid, r->>'url',
      r->>'caption', COALESCE((r->>'is_hero')::boolean, false), COALESCE((r->>'sort_order')::int, 0)
    );
  END LOOP;

  -- 6. section deletes last, after exhibits have moved out (FK blocks the rest)
  DELETE FROM sections
  WHERE id IN (
    SELECT j #>> '{}' FROM jsonb_array_elements(COALESCE(changes #> '{sections,delete}', '[]')) j
  );

  -- 7. check deferred (section, number) uniqueness now, inside the function
  SET CONSTRAINTS exhibits_section_number_key IMMEDIATE;

  RETURN jsonb_build_object('exhibits_created', created);
END;
$function$;

-- Service role only: the default Supabase grants give anon/authenticated EXECUTE.
REVOKE ALL ON FUNCTION public.admin_apply_changes(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_changes(jsonb) TO service_role;
