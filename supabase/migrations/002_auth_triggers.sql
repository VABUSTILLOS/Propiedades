-- =============================================================================
-- 002_auth_triggers.sql — profile lifecycle automation
-- Creates a profile row whenever a user signs up and keeps timestamps fresh.
-- =============================================================================

-- Auto-create a profile on signup. Copies email + name from auth.users metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    full_name text := coalesce(meta->>'full_name', meta->>'name', '');
    role_text text := coalesce(meta->>'role', 'buyer');
    valid_role user_role;
BEGIN
    BEGIN
        valid_role := role_text::user_role;
    EXCEPTION WHEN invalid_text_representation THEN
        valid_role := 'buyer';
    END;

    INSERT INTO public.profiles (id, role, full_name, email)
    VALUES (new.id, valid_role, full_name, coalesce(new.email, ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at fresh on profiles and properties.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
