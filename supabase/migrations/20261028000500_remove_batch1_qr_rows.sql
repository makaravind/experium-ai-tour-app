-- Remove batch-1 dummy QR code rows (added as a workaround; no physical markers exist).
-- No scan rows reference these rows so CASCADE is safe.
TRUNCATE exhibit_qr_codes CASCADE;
