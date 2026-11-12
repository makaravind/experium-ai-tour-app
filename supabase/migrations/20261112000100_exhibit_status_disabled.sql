-- Add 'disabled' exhibit status: hidden from all visitor surfaces

ALTER TABLE exhibits DROP CONSTRAINT exhibits_status_check;
ALTER TABLE exhibits
  ADD CONSTRAINT exhibits_status_check CHECK (status IN ('live','coming_soon','disabled'));
