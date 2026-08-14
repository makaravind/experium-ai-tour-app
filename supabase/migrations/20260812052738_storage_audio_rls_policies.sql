-- Storage RLS policies for audio and images buckets

CREATE POLICY "Public read audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "Anon upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');
