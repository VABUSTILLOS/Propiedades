-- Photo-count column so listing grids can cheaply exclude listings without
-- multiple photos. PostgREST has no operator for array length, so the count
-- is exposed as a regular (generated) column that stays in sync with images[].
--
-- NULL when images IS NULL; cardinality('{}') = 0. Filters like
-- `image_count > 1` therefore keep only listings with 2+ photos.
ALTER TABLE properties
  ADD COLUMN image_count INTEGER
  GENERATED ALWAYS AS (cardinality(images)) STORED;

-- Partial index for the catalog's primary read path: active multi-photo rows.
CREATE INDEX IF NOT EXISTS properties_active_image_count_idx
  ON properties (status, image_count);
