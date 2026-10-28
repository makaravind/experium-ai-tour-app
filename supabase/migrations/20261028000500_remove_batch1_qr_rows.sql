-- Remove batch-1 dummy QR code rows (added as a workaround; no physical markers exist).
-- DELETE (not TRUNCATE CASCADE) so FK violations surface loudly if any scans/reports row
-- references these codes rather than silently wiping those tables.
DELETE FROM exhibit_qr_codes;
