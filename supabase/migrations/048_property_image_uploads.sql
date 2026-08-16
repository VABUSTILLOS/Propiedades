-- =============================================================================
-- 048_property_image_uploads.sql — Authenticated listing image uploads
--
-- Allows signed-in users to upload images into the public property-images bucket
-- from the listing wizard. Public read access already exists in migration 017.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'property-images authenticated upload'
    ) THEN
        CREATE POLICY "property-images authenticated upload"
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'property-images'
                AND (storage.foldername(name))[1] = 'wizard'
            );
    END IF;
END $$;
