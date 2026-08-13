-- 31. MARKET BENCHMARKS — COVERAGE SWEEP (20 colonias) ------------------
-- Populates market_benchmarks for 20 remaining Chihuahua colonias (≤ $3,000,000
-- MXN market) that lacked coverage after datasets 24–35, so the semáforo RPC
-- (compute_colonia_discount) can score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. Over-$3M samples
-- (vivanuncios cross-listed properties outside the target market) are excluded,
-- per the dataset-34 precedent. Terreno-only colonias store the value in
-- avg_price_m2_land (const = 0).
--
-- Skipped (no reliable m² data): Quinta Sebastián, Los Llanos, Las Canteras,
-- Ejido Rancho de En Medio (const/terreno = 0), and Popular (data anomaly:
-- 80,000 m² for 2.2M MXN → 28/m², ~100x below all other benchmarks).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Cerro de la Cruz', 16779, 19380, 0),
  ('Chihuahua', '11 de Febrero', 0, 1458, 0),
  ('Chihuahua', 'Cumbres de San Francisco', 0, 9000, 0),
  ('Chihuahua', 'Z-5 P1', 0, 16129, 0),
  ('Chihuahua', 'Los Frailes', 0, 17867, 0),
  ('Chihuahua', 'Los Girasoles IV Etapa', 14286, 14286, 0),
  ('Chihuahua', 'Pedregal del Valle', 0, 7250, 0),
  ('Chihuahua', 'Chulavista I Etapa', 14094, 6780, 0),
  ('Chihuahua', 'Los Girasoles III Etapa', 27660, 18978, 0),
  ('Chihuahua', 'Villa del Real', 25658, 15600, 0),
  ('Chihuahua', 'San Felipe I Etapa', 11250, 11250, 0),
  ('Chihuahua', 'Residencial', 19043, 17381, 0),
  ('Chihuahua', 'Fraccionamiento Cumbres', 0, 10400, 0),
  ('Chihuahua', 'Colina del Puerto', 13034, 13897, 0),
  ('Chihuahua', 'Paseos Camino Real', 25862, 7317, 0),
  ('Chihuahua', 'Plan de Ayala', 10638, 0, 0),
  ('Chihuahua', 'Pablo Amaya Norte', 7075, 0, 0),
  ('Chihuahua', 'Parque Industrial Chihuahua Sur', 0, 954, 0),
  ('Chihuahua', 'Veredas del Sur', 0, 1480, 0),
  ('Chihuahua', 'Haciendas del Rejón', 0, 26000, 0);
