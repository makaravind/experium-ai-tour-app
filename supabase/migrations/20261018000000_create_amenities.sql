-- Amenities layer: washrooms, ticketing, food, gates (m3-amenities)

CREATE TABLE amenities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('washroom','ticketing','food','gate')),
  description TEXT,
  photos      TEXT[] NOT NULL DEFAULT '{}',
  gps_lat     FLOAT8 NOT NULL,
  gps_lng     FLOAT8 NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

-- amenities: anon SELECT, admin ALL
CREATE POLICY "anon_select_amenities" ON amenities
  FOR SELECT TO anon USING (true);
CREATE POLICY "admin_all_amenities" ON amenities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
