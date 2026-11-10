-- Amenity section + admin_apply_changes v2 (amenity admin, step 1)
--
-- Adds nullable amenities.section (FK sections.id, ON UPDATE CASCADE, so section
-- renames follow) and replaces admin_apply_changes(jsonb) with the version from
-- 20261110000100_sections.sql plus a top-level "amenities" block. A follow-up
-- migration sets section NOT NULL once the existing amenities are placed.
-- Everything else about the function (input shape, order, return value) is
-- unchanged; see 20261110000100_sections.sql for the full documentation.
--
-- Added input key (optional; omitted = nothing to do):
--
--   "amenities": {
--     "upsert": [                                      -- by id (client-generated UUID)
--       {
--         "id": "<uuid>",                              -- REQUIRED. Not in table => insert
--         "name": "...",                               -- required when inserting
--         "type": "washroom|ticketing|food|gate|leisure",   -- required when inserting
--         "description": "..."|null,
--         "gps_lat": 17.38, "gps_lng": 78.19,          -- required when inserting
--         "section": "G"|null
--       }
--     ],
--     "delete": [ "<amenity uuid>" ]
--   }
--
-- Existing row: PARTIAL update — only keys present are written (an explicit null
-- clears a nullable column). amenities.photos is never touched.
--
-- Order: 1. sections.rename  2. sections.upsert  3. exhibits  3b. amenities
--        4. audio  5. photos  6. sections.delete  7. unique check
-- (amenity deletes run before section deletes, so a section can be emptied and
-- removed in one call; a section that still holds an amenity fails the FK.)

ALTER TABLE amenities
  ADD COLUMN section TEXT REFERENCES sections(id) ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.admin_apply_changes(changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r       jsonb;
  ex_id   uuid;
  am_id   uuid;
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

  -- 3b. amenities: partial update when the id exists, else insert; then deletes.
  -- photos are never written. Deletes run here, before section deletes (step 6).
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{amenities,upsert}', '[]'))
  LOOP
    am_id := (r->>'id')::uuid;
    IF am_id IS NULL THEN
      RAISE EXCEPTION 'amenity is missing id: %', r;
    END IF;

    IF EXISTS (SELECT 1 FROM amenities WHERE id = am_id) THEN
      UPDATE amenities SET
        name        = CASE WHEN r ? 'name'        THEN r->>'name'        ELSE name        END,
        type        = CASE WHEN r ? 'type'        THEN r->>'type'        ELSE type        END,
        description = CASE WHEN r ? 'description' THEN r->>'description' ELSE description END,
        gps_lat     = CASE WHEN r ? 'gps_lat'     THEN (r->>'gps_lat')::float8 ELSE gps_lat END,
        gps_lng     = CASE WHEN r ? 'gps_lng'     THEN (r->>'gps_lng')::float8 ELSE gps_lng END,
        section     = CASE WHEN r ? 'section'     THEN r->>'section'     ELSE section     END
      WHERE id = am_id;
    ELSE
      IF r->>'name' IS NULL OR r->>'type' IS NULL OR r->>'gps_lat' IS NULL OR r->>'gps_lng' IS NULL THEN
        RAISE EXCEPTION 'new amenity % needs name, type, gps_lat and gps_lng', am_id;
      END IF;
      INSERT INTO amenities (id, name, type, description, gps_lat, gps_lng, section)
      VALUES (
        am_id, r->>'name', r->>'type', r->>'description',
        (r->>'gps_lat')::float8, (r->>'gps_lng')::float8, r->>'section'
      );
    END IF;
  END LOOP;

  DELETE FROM amenities
  WHERE id IN (
    SELECT (j #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(changes #> '{amenities,delete}', '[]')) j
  );

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
