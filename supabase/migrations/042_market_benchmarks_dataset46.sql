-- 42. MARKET BENCHMARKS — DATASET 46 (14 colonias) --------------------
-- Populates market_benchmarks for 14 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 125 dataset-46 imports (2016–2020
-- Wayback captures of the propiedades.com/chihuahua-chihuahua root listing
-- page). Source: DB price/m² samples (price ÷ size_m2) per colonia,
-- sanity-filtered (size ≥ 5 m², $/m² within benchmark ranges).
-- const = avg for non-terreno (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "Porticos de Bella Cumbre", 8200, 0, 0),
  ('Chihuahua', "Los Olivos", 11894, 0, 0),
  ('Chihuahua', "Valle de San Lorenzo", 11166, 0, 0),
  ('Chihuahua', "San Francisco", 9231, 0, 0),
  ('Chihuahua', "Loma Dorada", 5792, 0, 0),
  ('Chihuahua', "Rincones de San Andrés", 7263, 0, 0),
  ('Chihuahua', "2 de Junio", 4696, 0, 0),
  ('Chihuahua', "Cuarteles", 7086, 0, 0),
  ('Chihuahua', "Misión del Valle II", 11132, 0, 0),
  ('Chihuahua', "Residencial Cumbres II", 12105, 0, 0),
  ('Chihuahua', "Lince I", 7009, 0, 0),
  ('Chihuahua', "Inalámbrica", 10364, 0, 0),
  ('Chihuahua', "San Ignacio", 6071, 0, 0),
  ('Chihuahua', "Robinson Sector IV", 11540, 0, 0)
ON CONFLICT (city, colonia) DO NOTHING;
