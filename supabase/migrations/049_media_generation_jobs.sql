-- Media generation jobs for automatic video/tour creation from property images
-- Stores async job state and output URLs

CREATE TABLE IF NOT EXISTS media_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('video', 'tour', 'social_cuts', 'all')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    input_images JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {url, order, caption}
    output_video_url TEXT,
    output_video_vertical_url TEXT,
    output_tour_url TEXT,
    output_tour_type TEXT CHECK (output_tour_type IN ('panorama_360', 'walkthrough', 'none')),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_gen_jobs_property ON media_generation_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_media_gen_jobs_user ON media_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_media_gen_jobs_status ON media_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_gen_jobs_created ON media_generation_jobs(created_at DESC);

-- RLS policies
ALTER TABLE media_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view own media jobs"
    ON media_generation_jobs FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create jobs for their properties
CREATE POLICY "Users can create media jobs for own properties"
    ON media_generation_jobs FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_id AND p.owner_id = auth.uid()
        )
    );

-- Users can update their own jobs (for cancellation)
CREATE POLICY "Users can update own media jobs"
    ON media_generation_jobs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for Edge Function)
CREATE POLICY "Service role full access"
    ON media_generation_jobs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_media_gen_jobs_updated_at
    BEFORE UPDATE ON media_generation_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add media generation columns to properties for quick access to latest generated assets
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS generated_video_url TEXT,
    ADD COLUMN IF NOT EXISTS generated_video_vertical_url TEXT,
    ADD COLUMN IF NOT EXISTS generated_tour_url TEXT,
    ADD COLUMN IF NOT EXISTS generated_tour_type TEXT CHECK (generated_tour_type IN ('panorama_360', 'walkthrough', 'none')),
    ADD COLUMN IF NOT EXISTS media_generation_status TEXT DEFAULT 'none' CHECK (media_generation_status IN ('none', 'pending', 'processing', 'done', 'failed')),
    ADD COLUMN IF NOT EXISTS media_generation_updated_at TIMESTAMPTZ;
-- Storage bucket for generated media (videos, tours). Uploads happen via the
-- Edge Function with the service role; public read for playback on listings.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'property-media',
    'property-media',
    TRUE,
    52428800, -- 50 MB per file
    ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'text/html', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'property-media public read'
    ) THEN
        CREATE POLICY "property-media public read"
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'property-media');
    END IF;
END $$;
