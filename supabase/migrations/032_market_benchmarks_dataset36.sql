-- 32. MARKET BENCHMARKS — DATASET 36 (10 colonias) ---------------------
-- Populates market_benchmarks for 10 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 47 dataset-36 imports (2023–2026 Wayback
-- captures of propiedades.com) that lacked coverage, so the semáforo RPC
-- (compute_colonia_discount) can score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Over-$3M samples
-- (vivanuncios cross-listed properties outside the target market) are excluded.
-- Rancho listings whose LAND area lands in construccion_m2 (classifyCategory
-- maps Rancho→casa) produce land-in-const anomalies; those samples are excluded
-- from mixed colonias (Aeropuerto 1107, Granjas Familiares 700) and colonias
-- with only such samples are skipped. Terreno-only colonias store the value in
-- avg_price_m2_land (const = 0).
--
-- Skipped (no reliable m² data): Mezquites Sur, Cafetales, Campus II Uach,
-- Plomeros, Cantera del Pedregal (const/terreno = 0). Skipped (land-in-const
-- anomaly): Brisas del León (rancho 2500 m² → 384/m²), Avalos (rancho 600 m²
-- → 1833/m²) — rates 3–5× below the const p10 (2674), they are ranch LAND
-- prices, not construction rates.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Aeropuerto', 7188, 0, 0),
  ('Chihuahua', 'El Sáuz', 34375, 0, 0),
  ('Chihuahua', 'Granjas Familiares Valle de Chihuahua', 20313, 0, 0),
  ('Chihuahua', 'Haciendas del Valle II', 40845, 0, 0),
  ('Chihuahua', 'Insurgentes I', 0, 7389, 0),
  ('Chihuahua', 'Las Canteras', 37713, 0, 0),
  ('Chihuahua', 'Nuevo Majalca', 9615, 0, 0),
  ('Chihuahua', 'Paseo de las Misiones', 35432, 0, 0),
  ('Chihuahua', 'Puente de Piedra', 28252, 0, 0),
  ('Chihuahua', 'Villas del Sol I', 6141, 0, 0);
