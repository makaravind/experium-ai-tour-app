-- Sections + display IDs (exhibit admin tool, step 11)
--
-- Every exhibit is now placed in a section (data placed via the admin tool),
-- so section/number become mandatory. The CHECK exhibits_section_number_both
-- from 20261110000100_sections.sql is now redundant; left in place.

ALTER TABLE exhibits
  ALTER COLUMN section SET NOT NULL,
  ALTER COLUMN number SET NOT NULL;
