-- Remove batch-1 dummy QR code rows (added as a workaround; no physical markers exist).
-- Delete dependent rows first so the FK constraints don't block the QR code deletion.
DELETE FROM scans WHERE qr_code_id IN (SELECT id FROM exhibit_qr_codes);
DELETE FROM reports WHERE qr_code_id IN (SELECT id FROM exhibit_qr_codes);
DELETE FROM exhibit_qr_codes;
