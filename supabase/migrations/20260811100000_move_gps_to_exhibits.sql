-- Move gps_lat/gps_lng from exhibit_qr_codes to exhibits
-- 1 exhibit = 1 location; QR codes are scan entry points only

ALTER TABLE exhibits
  ADD COLUMN gps_lat FLOAT8,
  ADD COLUMN gps_lng FLOAT8;

ALTER TABLE exhibit_qr_codes
  DROP COLUMN gps_lat,
  DROP COLUMN gps_lng;
