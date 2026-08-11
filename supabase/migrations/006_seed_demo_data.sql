-- 006: Seed demo marketplace data
--
-- Inserts a small set of active listings (Roma Norte, Condesa, Polanco, Coyoacán),
-- market benchmarks, and sample reviews so the public marketplace renders data.
-- Owner = the demo agent profile created by 002's signup trigger.

-- Market benchmarks (ciudad, colonia) -----------------------------------------
INSERT INTO market_benchmarks (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate) VALUES
  ('Ciudad de México', 'Roma Norte',   72000.00, 115000.00, 6.50),
  ('Ciudad de México', 'Condesa',      75000.00, 120000.00, 6.10),
  ('Ciudad de México', 'Polanco',      98000.00, 160000.00, 5.20),
  ('Ciudad de México', 'Coyoacán',     48000.00,  78000.00, 4.80),
  ('Ciudad de México', 'Del Valle',    62000.00,  95000.00, 5.90)
ON CONFLICT (city, colonia) DO NOTHING;

-- Properties (owner = demo agent) ---------------------------------------------
INSERT INTO properties (
  owner_id, title, slug, description, type, status, price, currency,
  terreno_m2, construccion_m2, address, colonia, city, state, zip_code, lat, lng,
  geog, neighborhood_vibe, noise_score, flood_risk_level, nearby_schools,
  is_top, property_score, is_mls, commission_split, images,
  estimated_monthly_rent, cap_rate_projected, hoa_fee, predial_anual,
  price_history, tax_history
) VALUES
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  'Departamento luminoso en Roma Norte', 'departamento-roma-norte-1',
  'Hermoso departamento de 2 recámaras con balcón frente a árboles, a 5 min de la Plaza Río de Janeiro. Cocina integral, estacionamiento y bodega incluidos.',
  'sale', 'active', 6850000.00, 'MXN',
  80.00, 95.00, 'Av. Álvaro Obregón 120, Roma Norte', 'Roma Norte', 'Ciudad de México', 'CDMX', '06700',
  19.4170, -99.1600, ST_SetSRID(ST_MakePoint(-99.1600, 19.4170), 4326)::geography,
  '{"safety_rating": 8, "pet_friendly_rating": 7, "walkability_score": 95}', 3, 'low',
  '["Colegio Madrid", "Instituto La Salle"]',
  true, 92, true, '50/50', ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200'],
  28500.00, 4.99, 2500.00, 9800.00,
  '[{"date":"2026-01","price":6650000},{"date":"2026-03","price":6750000}]'::jsonb,
  '[{"year":2025,"predial":9400}]'::jsonb
),
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  'Casa con jardín en la Condesa', 'casa-condesa-jardin',
  'Casa de 3 niveles con jardín privado, terraza con asador y chimenea. Remodelada en 2025, lista para habitar.',
  'sale', 'active', 12500000.00, 'MXN',
  180.00, 240.00, 'Av. Nuevo León 210, Condesa', 'Condesa', 'Ciudad de México', 'CDMX', '06140',
  19.4110, -99.1690, ST_SetSRID(ST_MakePoint(-99.1690, 19.4110), 4326)::geography,
  '{"safety_rating": 9, "pet_friendly_rating": 9, "walkability_score": 98}', 2, 'low',
  '["Colegio Simón Bolívar"]',
  true, 95, true, '60/40', ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'],
  52000.00, 4.99, 0.00, 24000.00,
  '[{"date":"2026-02","price":12200000}]'::jsonb,
  '[{"year":2025,"predial":22800}]'::jsonb
),
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  'Penthouse con vista a Chapultepec en Polanco', 'penthouse-polanco-chapultepec',
  'Penthouse de lujo con vista panorámica al Bosque de Chapultepec. 3 recámaras, roof garden y 2 cajones de estacionamiento.',
  'sale', 'active', 28500000.00, 'MXN',
  150.00, 320.00, 'Av. Presidente Masaryk 190, Polanco', 'Polanco', 'Ciudad de México', 'CDMX', '11560',
  19.4320, -99.1930, ST_SetSRID(ST_MakePoint(-99.1930, 19.4320), 4326)::geography,
  '{"safety_rating": 10, "pet_friendly_rating": 8, "walkability_score": 88}', 1, 'low',
  '["Colegio Americano", "Westhill Institute"]',
  true, 98, true, '50/50', ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200'],
  118000.00, 4.97, 8000.00, 58000.00,
  '[{"date":"2026-01","price":27900000},{"date":"2026-04","price":28200000}]'::jsonb,
  '[{"year":2025,"predial":55200}]'::jsonb
),
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  'Departamento acogedor en Coyoacán', 'departamento-coyoacan-1',
  'Departamento de 1 recámara con patio interior, ideal para parejas. A 10 min del Centro Histórico de Coyoacán.',
  'sale', 'active', 2950000.00, 'MXN',
  55.00, 65.00, 'Calle Francisco Sosa 45, Santa Catarina', 'Coyoacán', 'Ciudad de México', 'CDMX', '04000',
  19.3490, -99.1620, ST_SetSRID(ST_MakePoint(-99.1620, 19.3490), 4326)::geography,
  '{"safety_rating": 8, "pet_friendly_rating": 6, "walkability_score": 85}', 2, 'low',
  '[]',
  false, 84, false, '50/50', ARRAY['https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=1200'],
  12800.00, 5.21, 1200.00, 4200.00,
  '[]'::jsonb,
  '[]'::jsonb
),
(
  '80a2428b-4d50-435d-8ce1-b1a9eba61176',
  'Oficina boutique en la Del Valle', 'oficina-del-valle',
  'Oficina de 4 módulos con recepción, ideal para agencias y despachos. Excelente conectividad con Insurgentes Sur.',
  'rent', 'active', 28000.00, 'MXN',
  90.00, 110.00, 'Av. Insurgentes Sur 601, Del Valle', 'Del Valle', 'Ciudad de México', 'CDMX', '03100',
  19.3890, -99.1620, ST_SetSRID(ST_MakePoint(-99.1620, 19.3890), 4326)::geography,
  '{"safety_rating": 9, "pet_friendly_rating": 4, "walkability_score": 90}', 3, 'low',
  '[]',
  false, 80, false, '50/50', ARRAY['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200'],
  28000.00, 0.00, 3500.00, 0.00,
  '[]'::jsonb,
  '[]'::jsonb
);

-- Sample review for the demo agent ---------------------------------------------
INSERT INTO reviews (transaction_id, author_id, subject_id, rating, comment)
SELECT t.id, r.id, r.id, 5, 'Excelente asesoría, proceso transparente y ágil.'
FROM transactions t
CROSS JOIN profiles r
WHERE r.id = '80a2428b-4d50-435d-8ce1-b1a9eba61176'
LIMIT 0; -- no transactions yet; review requires a transaction, skip seeding reviews.
