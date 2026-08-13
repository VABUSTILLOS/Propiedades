-- 33. MARKET BENCHMARKS — DATASET 37 (4 colonias) ---------------------
-- Populates market_benchmarks for 4 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 13 dataset-37 imports (2023–2026 Wayback
-- captures of the propiedades.com root and /venta listing pages) that lacked
-- coverage, so the semáforo RPC (compute_colonia_discount) can score every
-- in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Each of these
-- colonias has a single in-market sample, so the benchmark equals that
-- property's own rate (RPC discount = 0 until more samples arrive).
--
-- Skipped: México (terreno habitacional with land_area_m2 = 0 — no m² data).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campestre Residencial III', 20203, 0, 0),
  ('Chihuahua', 'La Joya', 19500, 0, 0),
  ('Chihuahua', 'Laura Leticia', 10000, 0, 0),
  ('Chihuahua', 'Residencial Campestre Washington', 20203, 0, 0);
