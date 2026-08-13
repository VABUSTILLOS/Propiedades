-- 34. MARKET BENCHMARKS — DATASET 38 (3 colonias) ---------------------
-- Populates market_benchmarks for 3 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 15 dataset-38 imports (2025–2026 Wayback
-- captures of the propiedades.com *-remates category pages) that lacked
-- coverage, so the semáforo RPC (compute_colonia_discount) can score every
-- in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2). Single in-market samples, so
-- the benchmarks equal each property's own rate (RPC discount = 0 until more
-- samples arrive). Rinconadas del Valle is a terreno-only colonia → stored in
-- avg_price_m2_land (const = 0); toHotScore returns null for terrenos, the
-- value feeds AVM estimateValue only.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campestre las Carolinas', 3407, 0, 0),
  ('Chihuahua', 'Parque Industrial Impulso VII y VIII', 3662, 0, 0),
  ('Chihuahua', 'Rinconadas del Valle', 0, 3048, 0);
