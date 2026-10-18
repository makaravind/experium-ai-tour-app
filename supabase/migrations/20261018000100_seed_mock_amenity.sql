-- Mock amenity ~39 m from Baobab Forest; the real-data migration (after m2c) deletes it by id

INSERT INTO amenities (id, name, type, description, photos, gps_lat, gps_lng)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Main Washroom',
  'washroom',
  'Near Gate 2 · Token ₹5',
  '{}',
  17.937684,
  78.461197
);
