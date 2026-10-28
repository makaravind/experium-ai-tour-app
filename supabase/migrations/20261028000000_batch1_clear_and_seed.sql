-- batch-1: rename plant→flora, add leisure amenity type, clear and seed exhibits

-- 1. Update exhibits type constraint: plant → flora
ALTER TABLE exhibits DROP CONSTRAINT IF EXISTS exhibits_type_check;
ALTER TABLE exhibits ADD CONSTRAINT exhibits_type_check
  CHECK (type IN ('flora','structure','water_body','landmark'));

-- 2. Add 'leisure' to amenities type
ALTER TABLE amenities DROP CONSTRAINT IF EXISTS amenities_type_check;
ALTER TABLE amenities ADD CONSTRAINT amenities_type_check
  CHECK (type IN ('washroom','ticketing','food','gate','leisure'));

-- 3. Wipe all exhibits and cascaded data (QR codes, scans, audio)
TRUNCATE exhibits CASCADE;

-- 4. Insert 10 batch-1 exhibits
INSERT INTO exhibits (id, code, name, type, tier, description, gps_lng, gps_lat, facts, status) VALUES
  ('c581dd88-70e7-4ceb-b83f-2a4d0f82b253', 1, 'Living Tree House', 'flora', 'gold', 'Most sculptures are made from dead things. Stone, cut timber, cast metal, and clay. The Living Tree House is made from none of these. Living trees make up its trunks, its branches, and its walls. All still growing.

The structure itself tells a stranger story.

These trunks and branches have been guided, branch by branch, into the shape of a house. The technique is called arborsculpture.

This is just the beginning. The next phase will bring fully enclosed living rooms that visitors can walk inside.

A house that grows, that breathes, and that will keep changing long after today.', 78.19234619, 17.38140282, '[{"fact": "A second, distinct installation exists on-site: a living sculpture where tree trunks and branches are trained into the architectural silhouette of a house"}, {"fact": "This sculpture uses living trees as the structural and sculptural medium — contrasting with conventional media: stone, cut timber, cast metal, ceramics, and clay"}, {"fact": "The training technique is arborsculpture — directing living tree growth into functional, load-bearing architectural enclosures"}, {"fact": "The next phase is planned: fully enclosed living tree structures that visitors can enter and inhabit"}]'::jsonb, 'live'),
  ('a75c9812-fc10-4d96-b55a-b63e4c8f6538', 2, 'Kalpavriksha', 'flora', 'gold', 'These three Baobabs come from Africa. Here at Experium, they are called Kalpavriksha. They have been alive for one thousand five hundred years.

The park transported them across the ocean. They traveled for many months at sea, kept alive inside iced containers. Seven Baobab species exist in the world. Six of them come from Africa.

For fifteen centuries, these trees survived earthquakes, thunderstorms, forest fires, pests, and human encroachment. The park calls that endurance self power. Their trunks can grow up to twenty feet wide.

This exhibit is designed for touch. Visitors are invited to step forward, hold the trunks, and feel the calm that fifteen centuries and an ocean have pressed into the bark.', 78.19232058, 17.38159287, '[{"fact": "Approximately 1,500 years old"}, {"fact": "Originated from Africa"}, {"fact": "Transported from Africa by sea — many months at sea, in iced containers"}, {"fact": "Seven Baobab species exist worldwide; six are native to Africa, one to Australia"}, {"fact": "Trunks can grow up to 20 feet in diameter"}, {"fact": "Survived fifteen centuries: earthquakes, thunderstorms, forest fires, pests, human encroachment"}, {"fact": "Touching intended to produce mental relaxation, calm, and inner willpower"}, {"fact": "Designed for touch — visitors encouraged to approach, hold, and hug trunks"}]'::jsonb, 'live'),
  ('d7162d75-57a0-486b-a002-70bb6eacd119', 3, 'Buddha in Lotus Tree', 'flora', 'gold', 'In a forest in Indonesia, a tree took root on solid stone. No soil. No help. Just roots gripping rock.

This is the Lotus Tree. A stone-rooted tree hand-shaped into the outline of an open lotus flower, with a Buddha statue resting inside its hollow center.

A nursery owner found it growing on a rock in Indonesia and nurtured it. The park''s founder discovered it there and brought it here. The tree alone cost ₹85 lakhs. The journey added ₹5 lakhs. The hand-crafted Buddha inside the tree is valued at ₹15 lakhs.

That lotus shape was not natural. It was guided into existence, one branch at a time. The Lotus Tree is still growing. Its branches are still being shaped, even today.', 78.19102502, 17.38185493, '[{"fact": "The tree is a lithophytic (root-over-rock) formation — grows directly on natural stone, not soil"}, {"fact": "Geographic origin: Indonesia"}, {"fact": "The tree roots and trunk are anchored over natural rock"}, {"fact": "The tree was trained through arborsculpture into the shape of an open lotus flower"}, {"fact": "A sculpted Buddha statue is positioned inside the hollow center"}, {"fact": "The Buddha statue is hand-crafted"}, {"fact": "Total investment: ₹1.05 crore"}]'::jsonb, 'live'),
  ('eb481df1-2d03-41e9-84ff-6a4c692474f4', 8, 'Living chairs round table', 'flora', 'gold', 'Forty years ago, someone planted a chair.

Not carved. Not cut. Planted, and trained to grow into this shape.

These living chairs came from Indonesia, grown by a craftsman who spent four decades patiently bending and shaping living trees into functional seats. The craftsman was regarded as an artist. Experium acquired these directly from his grandson.

Most furniture begins with a fallen tree. These chairs never let the tree fall.

Each one cost twelve and a half lakhs. That is about the price of a fine painting made in a single day. But a painting stops when the artist puts down the brush. These chairs are still growing.', 78.19177474, 17.38260728, '[{"fact": "The chairs are living trees — not cut from timber, not carved"}, {"fact": "Each chair is formed from living, growing tree trunks and branches"}, {"fact": "Geographic origin: Indonesia"}, {"fact": "Created by an Indonesian craftsman regarded as an artist"}, {"fact": "The craftsman spent 40 years training and shaping each tree into chair form"}, {"fact": "Experium acquired them directly from the original craftsman''s grandson"}, {"fact": "Unit cost: ₹12.5 lakhs per tree/chair"}, {"fact": "The 40-year living sculpture is framed as essentially priceless by comparison with any paintings"}, {"fact": "Design philosophy: cultivate functional furniture within living trees instead of cutting them down"}, {"fact": "Four decades of continuous, disciplined wood-shaping and growth guidance required"}]'::jsonb, 'live'),
  ('15e05c65-bad7-4318-8bd7-44be1988bb94', 80, 'Rainbow Eucalyptus forest', 'flora', 'silver', 'Look at the trunk. The colors aren''t painted. The tree makes them itself.

This is the Rainbow Eucalyptus forest. These are the only trees of their kind in India. Every single one was brought here from Papua New Guinea. Each one cost fourteen lakhs.

Right now, you can already see the colors beginning to appear. The trunks keep developing their rainbow pattern as they mature. The full display takes two to five years. Every time you visit, this forest looks a little different.

Without trimming, these trees would reach 120 feet. Experium keeps them at a height you can actually take in.', 78.19091686, 17.38220649, '[{"fact": "The trees were imported from Papua New Guinea."}, {"fact": "These are described as the only trees of their kind in India."}, {"fact": "Each tree costs approximately 14 lakhs."}, {"fact": "The trunks develop multi-colored rainbow patterns as they mature."}, {"fact": "Some colors are already visible at the time of visit."}, {"fact": "The full rainbow coloring develops within 2 to 5 years."}, {"fact": "These trees are capable of growing up to 120 feet tall."}]'::jsonb, 'live'),
  ('f0bd4d87-7e1c-44d4-8c64-d9d0cf04c25b', 66, 'Namibian Gold Powder Tree', 'flora', 'gold', 'Touch this trunk and your hand comes away golden. This is the Namibian Gold Powder Tree. The only one of its kind in all of India. Native to Namibia, the bark is coated in a fine, natural golden powder. Press your palm against it and the gold transfers to your skin. Across parts of Africa, local communities have gathered this golden powder for generations. Not as a dye. Not as medicine. As talcum powder. A soft, natural dusting powder, taken straight from the tree. No processing needed. The tree simply makes it. Every day, without being asked. It is a living, golden tree. And there is exactly one of them here in India.', 78.19341045, 17.38113407, '[{"fact": "The tree is a living specimen, not a preserved or processed exhibit"}, {"fact": "Native to Namibia"}, {"fact": "The surface of the trunk is coated in a fine gold-colored powder"}, {"fact": "The powder releases when the bark is physically touched"}, {"fact": "Local communities in Africa have traditionally gathered this powder for use as a natural talcum powder"}, {"fact": "It is categorized as an exceptionally rare acquisition within the garden''s collection"}]'::jsonb, 'live'),
  ('2a5c82c8-34f9-466b-bd3d-487175666a2d', 67, 'Fossil wood', 'flora', 'silver', 'What you''re looking at was once a living tree. Today, every inch of it is solid stone.

This is fossil wood. It is the tallest piece in the park''s fossil wood collection. Ten million years ago, a tree fell. Over time, its wood dissolved, mineral by mineral, and was replaced by rock. The original shape survived. The cells survived. The tree became stone. It has stayed that way ever since.

The founder sourced this piece from overseas. At roughly fifteen lakh rupees per piece, the park holds several of these ancient stones. Each one came from a different country.

Ten million years of time, preserved in something you can stand next to.', 78.1935611, 17.38096832, '[{"fact": "The exhibit is fossil wood: a prehistoric living tree that transformed into solid stone over millions of years"}, {"fact": "It is estimated to be approximately 10 million years old"}, {"fact": "It is completely mineralized timber with stone-like density and texture"}, {"fact": "It is the tall specimen within the park''s fossil wood series"}, {"fact": "The park holds several fossil wood specimens as a collection"}, {"fact": "It is exhibited as a prime geological and ancient feature of the garden"}]'::jsonb, 'live'),
  ('48e92857-0e4e-4ef6-b734-c39557976121', 20, 'Olympic Tree', 'flora', 'gold', 'Look at those rings. Not carved. Not painted. Grown.

This is the Olympic Tree. Its branches have been trained, year by year, into the shape of the five interlocking Olympic rings.

It came from China, shaped by a single nurseryman as a personal tribute to the 2008 Olympic Games in Beijing. Experium brought it here for nearly eighty lakh rupees. Because there is nothing else like it in the world.

What you see isn''t finished. The tree is alive. Every day, its branches press outward. Every day, a careful hand guides them back into those five perfect circles.

One person. Years of patience. A living memory of the Olympics, still growing.', 78.19115577, 17.38220987, '[{"fact": "Its branches and trunks have been sculpted into the shape of the five interlocking Olympic rings"}, {"fact": "The technique used is arborsculpture — directional growth guidance over time"}, {"fact": "The tree was imported from China"}, {"fact": "It was trained and shaped by a single independent nurseryman as a personal creation"}, {"fact": "It was created as a tribute to the 2008 Olympic Games in Beijing"}, {"fact": "Experium acquired it for approximately ₹80 lakhs"}, {"fact": "Ongoing maintenance is required to keep the rings profile intact"}]'::jsonb, 'live'),
  ('54dc0e35-12e9-4f21-a3b0-5b09fb1cfc83', 24, 'Vessel Tree', 'flora', 'gold', 'This is a tree. It grew from a seed. And someone spent thirty years turning it into a kettle.

The Kettle Tree — the only one of its form in India. A master artist from Southeast Asia trained this living tree, branch by patient branch, into the silhouette of a kettle. Not once did they carve it or cut it into shape. They simply guided it, year after year.

It was brought to Experium for ₹65 lakhs. The founder wanted something that could not be copied overnight.

Today, this tree sets the standard for every living sculpture in the park. It''s still alive. Still growing. Still a kettle.', 78.19187605, 17.3811099, '[{"fact": "The tree is a living tree trained into the shape of a kettle"}, {"fact": "It was sculpted by an artist from Southeast Asia"}, {"fact": "It is the only tree of this shape and form in India"}, {"fact": "It is approximately 30 years old"}, {"fact": "It was trained over three decades through arborsculpture"}, {"fact": "It was imported at a cost of ₹65 lakhs"}, {"fact": "It serves as a creative benchmark inspiring ongoing living tree experiments at the property"}]'::jsonb, 'live'),
  ('718392e0-84d2-45a9-bf88-9af88f135f7e', 26, 'Penjing Garden', 'flora', 'gold', 'The world''s largest collection of the world''s smallest landscapes is right here.

This is the Penjing Garden. It stretches across one full acre of Experium, and every inch is packed with miniature worlds.

Penjing is different from bonsai. Bonsai shapes a single tree. Penjing builds an entire natural scene inside a shallow oval tray. Trees, stones, and water together. Rare stones become cliffs. A tiny trunk becomes a forest.

An award-winning Penjing master from Vietnam designed every piece here. Some trays are just two feet wide. Each one is a complete landscape, shaped to meet the standards of international Penjing competitions.

Ancient olive trees stand over the garden, a living frame for the miniature worlds below.', 78.18926483, 17.38128965, '[{"fact": "Penjing is distinct from standalone bonsai: it integrates miniature trees with water and stone elements inside oval vessels to depict complete natural landscapes"}, {"fact": "Display vessels are oval-shaped shallow bowls/trays"}, {"fact": "Specimen dimensions: miniature trees and stone compositions measuring 2 ft × 1.5 ft and 1.5 ft × 1 ft"}, {"fact": "The garden covers approximately 1 acre"}, {"fact": "Master planned and crafted by an award-winning Penjing artist from Vietnam"}, {"fact": "Bonsai plant specimens are cultivated in miniature tree forms"}, {"fact": "Ancient/very old olive trees (Olea europaea) are present in the garden"}, {"fact": "Natural materials include small landscaping stones, rare geological stones, and sculptural pieces"}, {"fact": "The compositional layout blends miniature potted landscapes with mature monumental features (aged olive trees, rare stones, curated sculptures)"}, {"fact": "Cultural origin: prominent horticultural art form across Japan and Southeast Asia"}, {"fact": "Exhibition standards are aligned with international competitive Penjing exhibition criteria practiced across Southeast Asia and Japan"}]'::jsonb, 'live');

-- 5. Insert Living Canopy Walk as leisure amenity
INSERT INTO amenities (id, name, type, description, photos, gps_lat, gps_lng) VALUES
  ('df17aef8-ac5c-45e3-b5f6-a315a4488275', 'Living Canopy Walk', 'leisure', 'What''s above you has never existed anywhere else on Earth. Not like this.

This is the Living Canopy Pavilion. The world''s first man-made living canopy of its kind. Already on its way to a Guinness World Record.

Living plants have been cultivated and trained across an overhead framework. Slowly, the plants reach outward, filling in gaps, and building toward complete shade. In six months to a year, every inch of sky above this space will be covered in green.

Right now, you are standing inside something still becoming. A family gathering spot, a concert venue, and a cool, shaded retreat. All growing into place above you.', '{}', 17.38150687, 78.19075019);