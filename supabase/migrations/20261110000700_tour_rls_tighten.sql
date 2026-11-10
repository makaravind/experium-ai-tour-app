-- Tighten RLS on the tour tables (follow-up to 20261110000500_virtual_tour.sql).
-- The admin tool writes through the service-role key (lib/supabase-admin.ts), which bypasses
-- RLS, so no authenticated write policy is needed. The anon SELECT policies stay.
-- Scope: tour_nodes / tour_edges only; older admin_all_* policies on other tables are untouched.

DROP POLICY IF EXISTS "admin_all_tour_nodes" ON tour_nodes;
DROP POLICY IF EXISTS "admin_all_tour_edges" ON tour_edges;
