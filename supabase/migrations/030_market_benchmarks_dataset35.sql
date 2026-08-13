-- 30. MARKET BENCHMARKS — DATASET 35 (1 newly imported colonia) -----------
-- Populates market_benchmarks for the Revolución colonia (dataset-35 import,
-- Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Source: captured list-card price/m² sample (price ÷ size_m2) from the
-- single bodega listing in this colonia (pid 30562749, $2,597,000 / 186 m²).
--
-- Single-sample colonia: the property is its own benchmark, so the RPC
-- yields 0% discount (neutral, not hot) — consistent with existing single
-- sample colonias.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Revolución', 13962, 0, 0);
