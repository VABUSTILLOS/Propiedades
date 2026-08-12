-- 011: Digital flyers for demo properties
--
-- The Stage-3 public flyer lives at /f/<slug> and queries digital_flyers.slug.
-- 007 seeded properties but no flyers, so /f/<slug> 404'd. This migration
-- backfills one flyer per demo listing (idempotent via ON CONFLICT).

INSERT INTO digital_flyers (property_id, agent_id, slug, custom_title, is_white_label, views_count)
SELECT p.id,
       '80a2428b-4d50-435d-8ce1-b1a9eba61176',
       p.slug,
       p.title,
       false,
       0
FROM properties p
WHERE p.owner_id = '80a2428b-4d50-435d-8ce1-b1a9eba61176'
ON CONFLICT (slug) DO NOTHING;
