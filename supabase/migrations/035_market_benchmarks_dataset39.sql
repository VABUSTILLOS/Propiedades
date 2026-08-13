-- 35. MARKET BENCHMARKS — DATASET 39 (3 colonias) ---------------------
-- Populates market_benchmarks for 3 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 11 dataset-39 imports (May 2024 Wayback
-- capture of propiedades.com/chihuahua-chihuahua/terrenos-comerciales-venta,
-- a pre-Next.js page whose listings live in __NEXT_DATA__.results.properties)
-- that lacked coverage, so the semáforo RPC (compute_colonia_discount) can
-- score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2). All three colonias are
-- terreno-comercial-only in this dataset → stored in avg_price_m2_land
-- (const = 0). Single in-market samples, so the benchmarks equal each
-- property's own rate; toHotScore returns null for terrenos, the values feed
-- AVM estimateValue only.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Vistas del Norte', 0, 176, 0),
  ('Chihuahua', 'Granjas Cerro Grande', 0, 600, 0),
  ('Chihuahua', 'El Bajo', 0, 1917, 0);
