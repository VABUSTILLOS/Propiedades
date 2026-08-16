-- =============================================================================
-- 050_property_media_uploads.sql — Authenticated generated-media uploads
--
-- Allows signed-in users to upload wizard-generated media (browser-rendered
-- videos) into the public property-media bucket under wizard/<auth.uid()>/.
-- Public read access + bucket creation already exist in migration 049.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'property-media authenticated upload'
    ) THEN
        CREATE POLICY "property-media authenticated upload"
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'property-media'
                AND (storage.foldername(name))[1] = 'wizard'
                AND (storage.foldername(name))[2] = auth.uid()::text
            );
    END IF;
END $$;
