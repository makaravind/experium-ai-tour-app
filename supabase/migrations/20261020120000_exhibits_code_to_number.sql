-- exhibits.code: TEXT -> SMALLINT park reference number (1-99)
-- Nullable until numbers are manually validated against the printed park map.
ALTER TABLE exhibits DROP COLUMN code;
ALTER TABLE exhibits ADD COLUMN code SMALLINT UNIQUE NULL;

UPDATE exhibits
SET code = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM exhibits
) sub
WHERE exhibits.id = sub.id;
