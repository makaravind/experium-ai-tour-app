-- Add exhibits.status for coming-soon exhibits (gh-58)

ALTER TABLE exhibits
  ADD COLUMN status TEXT NOT NULL DEFAULT 'live'
  CHECK (status IN ('live','coming_soon'));
