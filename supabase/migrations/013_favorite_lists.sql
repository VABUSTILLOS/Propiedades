-- =============================================================================
-- 013_favorite_lists.sql — Custom favorites lists (private collections)
--
-- Lets a user group their favorite properties into named lists
-- (e.g. "Casas en Cancún", "Departamentos < 3M"). Lists are private and
-- linked to favorites: each item references buyer_favorites.id, so adding a
-- property to a list also keeps it saved as a favorite.
-- =============================================================================

CREATE TABLE favorite_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A property (via its favorite row) can belong to many lists; a list can
-- hold many favorites. Deleting a list or a favorite cleans up its items.
CREATE TABLE favorite_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES favorite_lists(id) ON DELETE CASCADE,
    favorite_id UUID NOT NULL REFERENCES buyer_favorites(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(list_id, favorite_id)
);

CREATE INDEX idx_favorite_lists_user ON favorite_lists(user_id);
CREATE INDEX idx_favorite_list_items_list ON favorite_list_items(list_id, position);
CREATE INDEX idx_favorite_list_items_favorite ON favorite_list_items(favorite_id);

-- Keep updated_at fresh on rename/edit.
CREATE OR REPLACE FUNCTION touch_favorite_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_touch_favorite_lists_updated_at
    BEFORE UPDATE ON favorite_lists
    FOR EACH ROW EXECUTE FUNCTION touch_favorite_lists_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_list_items ENABLE ROW LEVEL SECURITY;

-- Lists are private: only the owning user can read or manage them.
CREATE POLICY "Users manage own lists"
    ON favorite_lists FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Items are managed through their owning list.
CREATE POLICY "Users manage own list items"
    ON favorite_list_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM favorite_lists
            WHERE favorite_lists.id = favorite_list_items.list_id
              AND favorite_lists.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM favorite_lists
            WHERE favorite_lists.id = favorite_list_items.list_id
              AND favorite_lists.user_id = auth.uid()
        )
    );
