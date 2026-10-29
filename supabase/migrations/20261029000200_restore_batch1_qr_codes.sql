-- Physical batch-1 markers now exist; restore exhibit_qr_codes rows removed in 500.
INSERT INTO exhibit_qr_codes (id, code, exhibit_id, status) VALUES
  (gen_random_uuid(), '1',  'c581dd88-70e7-4ceb-b83f-2a4d0f82b253', 'active'),
  (gen_random_uuid(), '2',  'a75c9812-fc10-4d96-b55a-b63e4c8f6538', 'active'),
  (gen_random_uuid(), '3',  'd7162d75-57a0-486b-a002-70bb6eacd119', 'active'),
  (gen_random_uuid(), '8',  'eb481df1-2d03-41e9-84ff-6a4c692474f4', 'active'),
  (gen_random_uuid(), '20', '48e92857-0e4e-4ef6-b734-c39557976121', 'active'),
  (gen_random_uuid(), '24', '54dc0e35-12e9-4f21-a3b0-5b09fb1cfc83', 'active'),
  (gen_random_uuid(), '26', '718392e0-84d2-45a9-bf88-9af88f135f7e', 'active'),
  (gen_random_uuid(), '66', 'f0bd4d87-7e1c-44d4-8c64-d9d0cf04c25b', 'active'),
  (gen_random_uuid(), '67', '2a5c82c8-34f9-466b-bd3d-487175666a2d', 'active'),
  (gen_random_uuid(), '80', '15e05c65-bad7-4318-8bd7-44be1988bb94', 'active')
ON CONFLICT DO NOTHING;
