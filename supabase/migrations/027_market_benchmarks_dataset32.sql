-- 27. MARKET BENCHMARKS — DATASET 32 (29 newly imported colonias) ----------
-- Populates market_benchmarks for 29 colonias of the dataset-32 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property. Over-$3M cross-listed samples
-- (vivanuncios) and killed listings (no image) are excluded.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- Villa Juárez (mixed) gets both columns; all others use avg_price_m2_const.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Abraham González', 9235, 0, 0),
  ('Chihuahua', 'Arquitectos', 12586, 0, 0),
  ('Chihuahua', 'Bahías', 26906, 0, 0),
  ('Chihuahua', 'Catania Residencial', 9375, 0, 0),
  ('Chihuahua', 'Cerrada Castilla', 0, 7370, 0),
  ('Chihuahua', 'Cerro de La Cruz', 10000, 0, 0),
  ('Chihuahua', 'Dale', 7143, 0, 0),
  ('Chihuahua', 'Hacienda Camila', 19117, 0, 0),
  ('Chihuahua', 'Las Animas', 43137, 0, 0),
  ('Chihuahua', 'Leones Universidad', 0, 10553, 0),
  ('Chihuahua', 'Linss', 38622, 0, 0),
  ('Chihuahua', 'Los Claustros Universidad', 14813, 0, 0),
  ('Chihuahua', 'Los Nogales', 0, 344, 0),
  ('Chihuahua', 'Madera 65', 7073, 0, 0),
  ('Chihuahua', 'Obrera Vista Avalos', 0, 3143, 0),
  ('Chihuahua', 'Panorámico', 6563, 0, 0),
  ('Chihuahua', 'Parques de San Felipe', 32308, 0, 0),
  ('Chihuahua', 'Ramón Reyes', 9171, 0, 0),
  ('Chihuahua', 'Real de Minas', 13333, 0, 0),
  ('Chihuahua', 'Reforma', 0, 2771, 0),
  ('Chihuahua', 'Riberas del Sacramento', 0, 300, 0),
  ('Chihuahua', 'San Felipe II', 38462, 0, 0),
  ('Chihuahua', 'San Fernando', 16901, 0, 0),
  ('Chihuahua', 'Toribio Ortega', 7885, 0, 0),
  ('Chihuahua', 'Unidad Cuauhtémoc', 37302, 0, 0),
  ('Chihuahua', 'Villa Juárez', 8233, 6198, 0),
  ('Chihuahua', 'Zarco', 11364, 0, 0),
  ('Chihuahua', 'Zona Centro', 30140, 0, 0),
  ('Chihuahua', 'Zootecnia', 23333, 0, 0);
