-- admin_apply_tour(changes jsonb): one transactional write used by the dev-only
-- /admin/tour tool (POST /api/admin/tour/save). Mirrors admin_apply_changes.
--
-- Every top-level key is optional; omitted = nothing to do. Applied in this
-- order, all in one transaction (any error rolls everything back):
--   1. nodes  2. edges.delete  3. edges.upsert  4. exhibits  5. one-lobby check
--
-- {
--   "nodes": [                                   -- partial update of EXISTING nodes only
--     { "id": "<uuid>", "label": "...", "lat": 17.4, "lng": 78.4 }
--   ],                                           -- nodes are created by the seed/tiling script
--                                                -- (tiles_url/preview_url/pano_ref are NOT NULL);
--                                                -- send only changed keys; lat/lng null = unplace
--   "edges": {
--     "delete": [ { "from_node_id": "<uuid>", "to_node_id": "<uuid>" } ],
--     "upsert": [ { "from_node_id": "<uuid>", "to_node_id": "<uuid>",
--                   "bearing": 0-359, "pitch": -90..90 } ]   -- full row; insert or update by PK
--   },
--   "exhibits": [                                -- partial update of EXISTING exhibits only
--     { "id": "<uuid>", "tour_node_id": "<uuid>|null",
--       "tour_heading": 0-359|null, "tour_pitch": -90..90|null }
--   ]
-- }
--
-- Returns { nodes, edges_deleted, edges_upserted, exhibits } (rows touched).

CREATE FUNCTION public.admin_apply_tour(changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r          jsonb;
  n_nodes    int := 0;
  n_deleted  int := 0;
  n_upserted int := 0;
  n_exhibits int := 0;
  v_from     uuid;
  v_to       uuid;
  v_bearing  int;
  v_pitch    int;
  v_node     uuid;
  v_heading  int;
BEGIN
  IF changes IS NULL OR jsonb_typeof(changes) <> 'object' THEN
    RAISE EXCEPTION 'changes must be a JSON object';
  END IF;

  -- 1. nodes: partial update of existing rows
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes->'nodes', '[]'))
  LOOP
    IF r ? 'lat' AND (r->>'lat')::float8 NOT BETWEEN -90 AND 90 THEN
      RAISE EXCEPTION 'node %: lat out of range', r->>'id';
    END IF;
    IF r ? 'lng' AND (r->>'lng')::float8 NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'node %: lng out of range', r->>'id';
    END IF;

    UPDATE tour_nodes SET
      label = CASE WHEN r ? 'label' THEN r->>'label'              ELSE label END,
      lat   = CASE WHEN r ? 'lat'   THEN (r->>'lat')::float8      ELSE lat   END,
      lng   = CASE WHEN r ? 'lng'   THEN (r->>'lng')::float8      ELSE lng   END
    WHERE id = (r->>'id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot update node %: not found', r->>'id';
    END IF;
    n_nodes := n_nodes + 1;
  END LOOP;

  -- 2. edge deletes
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{edges,delete}', '[]'))
  LOOP
    DELETE FROM tour_edges
    WHERE from_node_id = (r->>'from_node_id')::uuid AND to_node_id = (r->>'to_node_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot delete edge % -> %: not found', r->>'from_node_id', r->>'to_node_id';
    END IF;
    n_deleted := n_deleted + 1;
  END LOOP;

  -- 3. edge upserts (validated here so errors name the edge, not a constraint)
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes #> '{edges,upsert}', '[]'))
  LOOP
    v_from    := (r->>'from_node_id')::uuid;
    v_to      := (r->>'to_node_id')::uuid;
    v_bearing := (r->>'bearing')::int;
    v_pitch   := (r->>'pitch')::int;

    IF v_from = v_to THEN
      RAISE EXCEPTION 'edge % -> %: from and to must differ', v_from, v_to;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM tour_nodes WHERE id = v_from)
       OR NOT EXISTS (SELECT 1 FROM tour_nodes WHERE id = v_to) THEN
      RAISE EXCEPTION 'edge % -> %: endpoint node not found', v_from, v_to;
    END IF;
    IF v_bearing IS NULL OR v_bearing NOT BETWEEN 0 AND 359 THEN
      RAISE EXCEPTION 'edge % -> %: bearing must be 0-359', v_from, v_to;
    END IF;
    IF v_pitch IS NULL OR v_pitch NOT BETWEEN -90 AND 90 THEN
      RAISE EXCEPTION 'edge % -> %: pitch must be -90..90', v_from, v_to;
    END IF;

    INSERT INTO tour_edges (from_node_id, to_node_id, bearing, pitch)
    VALUES (v_from, v_to, v_bearing, v_pitch)
    ON CONFLICT (from_node_id, to_node_id)
    DO UPDATE SET bearing = EXCLUDED.bearing, pitch = EXCLUDED.pitch;
    n_upserted := n_upserted + 1;
  END LOOP;

  -- 4. exhibit links: partial update of existing rows
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(changes->'exhibits', '[]'))
  LOOP
    v_node    := (r->>'tour_node_id')::uuid;
    v_heading := (r->>'tour_heading')::int;
    v_pitch   := (r->>'tour_pitch')::int;

    IF r ? 'tour_node_id' AND v_node IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM tour_nodes WHERE id = v_node) THEN
      RAISE EXCEPTION 'exhibit %: tour node % not found', r->>'id', v_node;
    END IF;
    IF v_heading IS NOT NULL AND v_heading NOT BETWEEN 0 AND 359 THEN
      RAISE EXCEPTION 'exhibit %: tour_heading must be 0-359', r->>'id';
    END IF;
    IF v_pitch IS NOT NULL AND v_pitch NOT BETWEEN -90 AND 90 THEN
      RAISE EXCEPTION 'exhibit %: tour_pitch must be -90..90', r->>'id';
    END IF;

    UPDATE exhibits SET
      tour_node_id = CASE WHEN r ? 'tour_node_id' THEN v_node    ELSE tour_node_id END,
      tour_heading = CASE WHEN r ? 'tour_heading' THEN v_heading ELSE tour_heading END,
      tour_pitch   = CASE WHEN r ? 'tour_pitch'   THEN v_pitch   ELSE tour_pitch   END
    WHERE id = (r->>'id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot update exhibit %: not found', r->>'id';
    END IF;
    n_exhibits := n_exhibits + 1;
  END LOOP;

  -- 5. at most one lobby (also enforced by the tour_nodes_one_lobby unique index)
  IF (SELECT count(*) FROM tour_nodes WHERE is_lobby) > 1 THEN
    RAISE EXCEPTION 'at most one lobby node is allowed';
  END IF;

  RETURN jsonb_build_object(
    'nodes', n_nodes, 'edges_deleted', n_deleted, 'edges_upserted', n_upserted, 'exhibits', n_exhibits
  );
END;
$function$;

-- Service role only: the default Supabase grants give anon/authenticated EXECUTE.
REVOKE ALL ON FUNCTION public.admin_apply_tour(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_tour(jsonb) TO service_role;
