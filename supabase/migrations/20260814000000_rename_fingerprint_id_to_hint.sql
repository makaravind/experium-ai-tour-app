ALTER TABLE users RENAME COLUMN fingerprint_id TO fingerprint_hint;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_fingerprint_id_key;
