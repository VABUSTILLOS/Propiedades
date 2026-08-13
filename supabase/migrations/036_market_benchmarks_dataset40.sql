-- 36. MARKET BENCHMARKS — DATASET 40 (16 colonias) --------------------
-- Populates market_benchmarks for 16 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 35 dataset-40 imports (2021 Wayback
-- captures of the propiedades.com /casas-venta and /locales-venta pages, a
-- pre-Next.js server-rendered schema whose cards are <div class="properties-list">)
-- that lacked coverage, so the semáforo RPC (compute_colonia_discount) can
-- score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia. 15 of 16 are
-- single in-market samples (RPC discount = 0 until more samples arrive);
-- Ignacio Allende averages 2 local-comercial samples. All stored in
-- avg_price_m2_const (land = 0).

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Américas', 13218, 0, 0),
  ('Chihuahua', 'Atenas I, II, III, IV, V y VI', 7308, 0, 0),
  ('Chihuahua', 'Cafetales', 25854, 0, 0),
  ('Chihuahua', 'Cerrada Baena', 29333, 0, 0),
  ('Chihuahua', 'Condominos Comerciales Dumas I y II', 6109, 0, 0),
  ('Chihuahua', 'Guadalupe', 34630, 0, 0),
  ('Chihuahua', 'Ignacio Allende', 7804, 0, 0),
  ('Chihuahua', 'Jardines del Santuario', 23333, 0, 0),
  ('Chihuahua', 'La Galera I, II, III, IV y V', 14444, 0, 0),
  ('Chihuahua', 'Lomas Universidad II', 16667, 0, 0),
  ('Chihuahua', 'Poblado San Vicente', 14231, 0, 0),
  ('Chihuahua', 'Quinta Versalles', 15000, 0, 0),
  ('Chihuahua', 'Quintas Carolinas I, II, III, IV y V', 33621, 0, 0),
  ('Chihuahua', 'Rinconada de La Sierra I, II, III, IV y V', 11209, 0, 0),
  ('Chihuahua', 'San Ángel', 27027, 0, 0),
  ('Chihuahua', 'Satélite', 6160, 0, 0);
