-- batch-1: insert exhibit_audio rows (EN only, status=published)
-- Run AFTER audio files are uploaded to Supabase Storage bucket 'audio'

INSERT INTO exhibit_audio (id, exhibit_id, language, script, audio_url, status) VALUES
  (gen_random_uuid(), 'c581dd88-70e7-4ceb-b83f-2a4d0f82b253', 'en', 'Most sculptures are made from dead things. Stone, cut timber, cast metal, and clay. The Living Tree House is made from none of these. Living trees make up its trunks, its branches, and its walls. All still growing.

The structure itself tells a stranger story.

These trunks and branches have been guided, branch by branch, into the shape of a house. The technique is called arborsculpture.

This is just the beginning. The next phase will bring fully enclosed living rooms that visitors can walk inside.

A house that grows, that breathes, and that will keep changing long after today.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/1/en.mp3', 'published'),
  (gen_random_uuid(), 'a75c9812-fc10-4d96-b55a-b63e4c8f6538', 'en', 'These three Baobabs come from Africa. Here at Experium, they are called Kalpavriksha. They have been alive for one thousand five hundred years.

The park transported them across the ocean. They traveled for many months at sea, kept alive inside iced containers. Seven Baobab species exist in the world. Six of them come from Africa.

For fifteen centuries, these trees survived earthquakes, thunderstorms, forest fires, pests, and human encroachment. The park calls that endurance self power. Their trunks can grow up to twenty feet wide.

This exhibit is designed for touch. Visitors are invited to step forward, hold the trunks, and feel the calm that fifteen centuries and an ocean have pressed into the bark.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/2/en.mp3', 'published'),
  (gen_random_uuid(), 'd7162d75-57a0-486b-a002-70bb6eacd119', 'en', 'In a forest in Indonesia, a tree took root on solid stone. No soil. No help. Just roots gripping rock.

This is the Lotus Tree. A stone-rooted tree hand-shaped into the outline of an open lotus flower, with a Buddha statue resting inside its hollow center.

A nursery owner found it growing on a rock in Indonesia and nurtured it. The park''s founder discovered it there and brought it here. The tree alone cost ₹85 lakhs. The journey added ₹5 lakhs. The hand-crafted Buddha inside the tree is valued at ₹15 lakhs.

That lotus shape was not natural. It was guided into existence, one branch at a time. The Lotus Tree is still growing. Its branches are still being shaped, even today.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/3/en.mp3', 'published'),
  (gen_random_uuid(), 'eb481df1-2d03-41e9-84ff-6a4c692474f4', 'en', 'Forty years ago, someone planted a chair.

Not carved. Not cut. Planted, and trained to grow into this shape.

These living chairs came from Indonesia, grown by a craftsman who spent four decades patiently bending and shaping living trees into functional seats. The craftsman was regarded as an artist. Experium acquired these directly from his grandson.

Most furniture begins with a fallen tree. These chairs never let the tree fall.

Each one cost twelve and a half lakhs. That is about the price of a fine painting made in a single day. But a painting stops when the artist puts down the brush. These chairs are still growing.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/8/en.mp3', 'published'),
  (gen_random_uuid(), '15e05c65-bad7-4318-8bd7-44be1988bb94', 'en', 'Look at the trunk. The colors aren''t painted. The tree makes them itself.

This is the Rainbow Eucalyptus forest. These are the only trees of their kind in India. Every single one was brought here from Papua New Guinea. Each one cost fourteen lakhs.

Right now, you can already see the colors beginning to appear. The trunks keep developing their rainbow pattern as they mature. The full display takes two to five years. Every time you visit, this forest looks a little different.

Without trimming, these trees would reach 120 feet. Experium keeps them at a height you can actually take in.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/80/en.mp3', 'published'),
  (gen_random_uuid(), 'f0bd4d87-7e1c-44d4-8c64-d9d0cf04c25b', 'en', 'Touch this trunk and your hand comes away golden. This is the Namibian Gold Powder Tree. The only one of its kind in all of India. Native to Namibia, the bark is coated in a fine, natural golden powder. Press your palm against it and the gold transfers to your skin. Across parts of Africa, local communities have gathered this golden powder for generations. Not as a dye. Not as medicine. As talcum powder. A soft, natural dusting powder, taken straight from the tree. No processing needed. The tree simply makes it. Every day, without being asked. It is a living, golden tree. And there is exactly one of them here in India.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/66/en.mp3', 'published'),
  (gen_random_uuid(), '2a5c82c8-34f9-466b-bd3d-487175666a2d', 'en', 'What you''re looking at was once a living tree. Today, every inch of it is solid stone.

This is fossil wood. It is the tallest piece in the park''s fossil wood collection. Ten million years ago, a tree fell. Over time, its wood dissolved, mineral by mineral, and was replaced by rock. The original shape survived. The cells survived. The tree became stone. It has stayed that way ever since.

The founder sourced this piece from overseas. At roughly fifteen lakh rupees per piece, the park holds several of these ancient stones. Each one came from a different country.

Ten million years of time, preserved in something you can stand next to.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/67/en.mp3', 'published'),
  (gen_random_uuid(), '48e92857-0e4e-4ef6-b734-c39557976121', 'en', 'Look at those rings. Not carved. Not painted. Grown.

This is the Olympic Tree. Its branches have been trained, year by year, into the shape of the five interlocking Olympic rings.

It came from China, shaped by a single nurseryman as a personal tribute to the 2008 Olympic Games in Beijing. Experium brought it here for nearly eighty lakh rupees. Because there is nothing else like it in the world.

What you see isn''t finished. The tree is alive. Every day, its branches press outward. Every day, a careful hand guides them back into those five perfect circles.

One person. Years of patience. A living memory of the Olympics, still growing.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/20/en.mp3', 'published'),
  (gen_random_uuid(), '54dc0e35-12e9-4f21-a3b0-5b09fb1cfc83', 'en', 'This is a tree. It grew from a seed. And someone spent thirty years turning it into a kettle.

The Kettle Tree — the only one of its form in India. A master artist from Southeast Asia trained this living tree, branch by patient branch, into the silhouette of a kettle. Not once did they carve it or cut it into shape. They simply guided it, year after year.

It was brought to Experium for ₹65 lakhs. The founder wanted something that could not be copied overnight.

Today, this tree sets the standard for every living sculpture in the park. It''s still alive. Still growing. Still a kettle.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/24/en.mp3', 'published'),
  (gen_random_uuid(), '718392e0-84d2-45a9-bf88-9af88f135f7e', 'en', 'The world''s largest collection of the world''s smallest landscapes is right here.

This is the Penjing Garden. It stretches across one full acre of Experium, and every inch is packed with miniature worlds.

Penjing is different from bonsai. Bonsai shapes a single tree. Penjing builds an entire natural scene inside a shallow oval tray. Trees, stones, and water together. Rare stones become cliffs. A tiny trunk becomes a forest.

An award-winning Penjing master from Vietnam designed every piece here. Some trays are just two feet wide. Each one is a complete landscape, shaped to meet the standards of international Penjing competitions.

Ancient olive trees stand over the garden, a living frame for the miniature worlds below.', 'https://oslmbxefuqbkgqrnfcvm.supabase.co/storage/v1/object/public/audio/26/en.mp3', 'published');