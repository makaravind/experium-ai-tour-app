-- Virtual tour (m9a): tour_nodes, tour_edges, exhibit tour columns, panoramas bucket

CREATE TABLE tour_nodes (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT     NOT NULL,          -- shown in the node pill; e.g. 'Park Entrance', 'Node 14'
  pano_ref    TEXT     NOT NULL UNIQUE,   -- capture-spot label from the PDF: '1'…'40', '37A', 'lobby'
  tiles_url   TEXT     NOT NULL,          -- manifest.json URL in the `panoramas` bucket
  preview_url TEXT     NOT NULL,          -- 1024x512 preview.jpg URL
  lat         FLOAT8   NULL,              -- NULL until placed in /admin/tour (m9b); lobby seeded manually
  lng         FLOAT8   NULL,
  is_lobby    BOOLEAN  NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX tour_nodes_one_lobby ON tour_nodes (is_lobby) WHERE is_lobby;

CREATE TABLE tour_edges (
  from_node_id UUID     NOT NULL REFERENCES tour_nodes(id) ON DELETE CASCADE,
  to_node_id   UUID     NOT NULL REFERENCES tour_nodes(id) ON DELETE CASCADE,
  bearing      SMALLINT NOT NULL CHECK (bearing BETWEEN 0 AND 359),   -- yaw in from_node's pano, degrees
  pitch        SMALLINT NOT NULL DEFAULT -15 CHECK (pitch BETWEEN -90 AND 90),
  PRIMARY KEY (from_node_id, to_node_id)
);

ALTER TABLE exhibits
  ADD COLUMN tour_node_id UUID     NULL REFERENCES tour_nodes(id) ON DELETE SET NULL,
  ADD COLUMN tour_heading SMALLINT NULL CHECK (tour_heading BETWEEN 0 AND 359),
  ADD COLUMN tour_pitch   SMALLINT NULL CHECK (tour_pitch BETWEEN -90 AND 90);

ALTER TABLE tour_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_edges ENABLE ROW LEVEL SECURITY;

-- tour_nodes: anon SELECT, admin ALL
CREATE POLICY "anon_select_tour_nodes" ON tour_nodes
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_tour_nodes" ON tour_nodes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tour_edges: anon SELECT, admin ALL
CREATE POLICY "anon_select_tour_edges" ON tour_edges
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_tour_edges" ON tour_edges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- panoramas storage bucket: public read (uploads use the service-role key)
INSERT INTO storage.buckets (id, name, public)
VALUES ('panoramas', 'panoramas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read panoramas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'panoramas');
