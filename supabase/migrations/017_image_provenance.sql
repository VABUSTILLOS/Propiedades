-- =============================================================================
-- 017_image_provenance.sql — Photo provenance + local hosting support
--
-- Tracks where each listing photo was obtained from (provenance) so every
-- image on the site can be traced back to its source listing, and enables
-- hosting photos locally (Supabase Storage bucket) instead of hotlinking
-- to third-party CDNs.
--
--   image_sources — TEXT[] parallel to properties.images; entry [i] holds the
--                   original source URL of images[i]. Kept in the same order
--                   so provenance survives after images[] is swapped to
--                   local bucket URLs.
--   storage bucket property-images — public bucket for local copies of
--                   listing photos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Provenance column
-- ---------------------------------------------------------------------------
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS image_sources TEXT[] DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. Public storage bucket for local photo copies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'property-images',
    'property-images',
    TRUE,
    10485760, -- 10 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access to listing photos (they are public listings anyway).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'property-images public read'
    ) THEN
        CREATE POLICY "property-images public read"
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'property-images');
    END IF;
END $$;
