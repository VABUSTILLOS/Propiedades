-- 014: Remove demo seed data
--
-- 007 used to seed 5 fake CDMX listings (Roma Norte, Condesa, Polanco,
-- Coyoacán, Del Valle), market benchmarks and digital flyers so the
-- marketplace had content. The site now only shows listings produced by the
-- Vivanuncios scraper, so this migration deletes the remaining demo rows from
-- environments that already ran the old 007 seed. Idempotent: safe to re-run.
--
-- Order matters: digital_flyers (and flyer_analytics via FK CASCADE) must go
-- before properties. market_benchmarks rows have no dependents.

-- Demo flyers (flyer_analytics rows cascade via FK).
DELETE FROM digital_flyers
WHERE property_id IN (
  SELECT id FROM properties
  WHERE slug IN (
    'departamento-roma-norte-1',
    'casa-condesa-jardin',
    'penthouse-polanco-chapultepec',
    'departamento-coyoacan-1',
    'oficina-del-valle'
  )
);

-- Demo listings (no remaining references after flyers are removed).
DELETE FROM properties
WHERE slug IN (
  'departamento-roma-norte-1',
  'casa-condesa-jardin',
  'penthouse-polanco-chapultepec',
  'departamento-coyoacan-1',
  'oficina-del-valle'
);

-- Demo market benchmarks (CDMX) — not produced by the scraper.
DELETE FROM market_benchmarks WHERE city = 'Ciudad de México';
