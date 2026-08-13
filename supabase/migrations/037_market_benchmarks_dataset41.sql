-- 37. MARKET BENCHMARKS — DATASET 41 (31 colonias) --------------------
-- Populates market_benchmarks for 31 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 79 dataset-41 imports (2020–2022 Wayback
-- root captures of propiedades.com/chihuahua-chihuahua/venta — the last
-- unconsumed captures in the CDX window). This gives the semáforo RPC
-- (compute_colonia_discount) a benchmark to score every in-market property.
--
-- Source: DB price/m² samples (price ÷ size_m2) per colonia from all DB
-- properties (not just new imports). 30 of 31 are single in-market samples
-- (RPC discount = 0 until more samples arrive); Cumbres de San Francisco I y
-- II is a single terreno sample stored in avg_price_m2_land.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Adición Sur Universidad', 37667, 0, 0),
  ('Chihuahua', 'Campestre del Bosque', 4352, 0, 0),
  ('Chihuahua', 'Cerrada Ríoja', 16707, 0, 0),
  ('Chihuahua', 'Cima de La Cantera', 11859, 0, 0),
  ('Chihuahua', 'Colinas del León', 10952, 0, 0),
  ('Chihuahua', 'Cosmos', 14375, 0, 0),
  ('Chihuahua', 'Cumbres de San Francisco I y II', 0, 8224, 0),
  ('Chihuahua', 'Cumbres del Sur I', 13468, 0, 0),
  ('Chihuahua', 'El Porvenir I', 8663, 0, 0),
  ('Chihuahua', 'El Vallecillo', 12500, 0, 0),
  ('Chihuahua', 'Foxconn', 10526, 0, 0),
  ('Chihuahua', 'Fraccionamiento Puerta Rivera Real', 13253, 0, 0),
  ('Chihuahua', 'Francisco I Madero', 8929, 0, 0),
  ('Chihuahua', 'Haciendas Real', 13521, 0, 0),
  ('Chihuahua', 'Infonavit Nacional', 11400, 0, 0),
  ('Chihuahua', 'Karike', 11000, 0, 0),
  ('Chihuahua', 'La Molina', 17089, 0, 0),
  ('Chihuahua', 'Las Fuentes I', 11905, 0, 0),
  ('Chihuahua', 'Lomas Altas III', 39661, 0, 0),
  ('Chihuahua', 'Lomas del Rejón', 25687, 0, 0),
  ('Chihuahua', 'Lomas del Santuario I Etapa', 29080, 0, 0),
  ('Chihuahua', 'Los Encinos', 14141, 0, 0),
  ('Chihuahua', 'Misiones Universidad I, II y III', 11847, 0, 0),
  ('Chihuahua', 'Paseos de Chihuahua I y II', 9636, 0, 0),
  ('Chihuahua', 'Puerta del Valle I y II', 7987, 0, 0),
  ('Chihuahua', 'Residencial Universidad', 18087, 0, 0),
  ('Chihuahua', 'Roma II', 9091, 0, 0),
  ('Chihuahua', 'Roma Sur', 4044, 0, 0),
  ('Chihuahua', 'San Rafael', 6025, 0, 0),
  ('Chihuahua', 'Senda Real', 11475, 0, 0),
  ('Chihuahua', 'Junta de los Ríos "B" Ampl', 13483, 0, 0),
  ON CONFLICT (city, colonia) DO UPDATE SET
    avg_price_m2_const = EXCLUDED.avg_price_m2_const,
    avg_price_m2_land = EXCLUDED.avg_price_m2_land,
    historical_growth_rate = EXCLUDED.historical_growth_rate;
