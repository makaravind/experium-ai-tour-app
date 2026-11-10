-- Amenity section (amenity admin, step 1b)
--
-- Every amenity is now placed in a section (data placed via the admin tool /
-- seed), so section becomes mandatory.

ALTER TABLE amenities
  ALTER COLUMN section SET NOT NULL;
