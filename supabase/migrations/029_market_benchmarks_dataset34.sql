-- 29. MARKET BENCHMARKS — DATASET 34 (18 newly imported colonias) ----------
-- Populates market_benchmarks for 18 colonias of the dataset-34 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- all others use avg_price_m2_const.
--
-- Excluded (no size data in source cards): Ejido Rancho de En Medio.
-- That property has precio_m2_const NULL so the RPC returns NULL regardless;
-- a benchmark is impossible to compute without m² samples.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Agrícola Francisco Villa', 12195, 0, 0),
  ('Chihuahua', 'Barrio de Londres', 16438, 0, 0),
  ('Chihuahua', 'Benito Juárez CNOP', 0, 2718, 0),
  ('Chihuahua', 'Ejido Terrazas y Minas del Cobre', 0, 227, 0),
  ('Chihuahua', 'El Sacramento', 0, 900, 0),
  ('Chihuahua', 'Nuevo Chihuahua', 0, 7303, 0),
  ('Chihuahua', 'Nuevo Sacramento', 0, 267, 0),
  ('Chihuahua', 'Obrera', 13945, 0, 0),
  ('Chihuahua', 'Punta Oriente', 10909, 0, 0),
  ('Chihuahua', 'Quintas Carolinas I', 0, 488, 0),
  ('Chihuahua', 'Rincones de San Francisco', 0, 8035, 0),
  ('Chihuahua', 'Rincones de Sierra Azul', 0, 877, 0),
  ('Chihuahua', 'Robinson Residencial', 0, 1074, 0),
  ('Chihuahua', 'Roma V', 35950, 0, 0),
  ('Chihuahua', 'Sacramento I y II', 0, 380, 0),
  ('Chihuahua', 'Tabalaopa', 0, 1020, 0),
  ('Chihuahua', 'Valle Escondido', 0, 8900, 0),
  ('Chihuahua', 'Valle de Chihuahua', 0, 891, 0);
