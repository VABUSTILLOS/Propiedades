-- 26. MARKET BENCHMARKS — DATASET 31 (119 newly imported listings) -----------
-- Populates market_benchmarks for the 69 colonias of the dataset-31 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias (CDX
-- hunt returned 0 snapshots), so values are computed from captured list-card
-- price/m² samples (price ÷ size_m2), dedup'd per property.
--   multi    → avg of n≥2 samples (best available)
--   filtered → outlier-filtered or manually overridden to the plausible sample
--   circular → n=1 sample, the property's own price (low confidence; score 0%)

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Campanario', 2359, NULL, 0),
  ('Chihuahua', 'Quintas del Sol', 2183, NULL, 0),
  ('Chihuahua', 'Encordada de León', 6360, NULL, 0),
  ('Chihuahua', 'Hacienda Isabella', 7676, NULL, 0),
  ('Chihuahua', 'Hacienda del Moro', 6148, NULL, 0),
  ('Chihuahua', 'Las Fuentes', 5022, NULL, 0),
  ('Chihuahua', 'Las Fuentes II', 2792, NULL, 0),
  ('Chihuahua', 'Paseo de los Leones', 6306, NULL, 0),
  ('Chihuahua', 'Quintas Carolinas', 3262, NULL, 0),
  ('Chihuahua', 'Sector Bolívar', 2130, NULL, 0),
  ('Chihuahua', 'Villa Toscana', 2674, NULL, 0),
  ('Chihuahua', 'Labor de Terrazas', 30206, NULL, 0),
  ('Chihuahua', 'La Cañada', 3559, NULL, 0),
  ('Chihuahua', 'Las Granjas', 13650, NULL, 0),
  ('Chihuahua', 'Chihuahua Centro', 5459, NULL, 0),
  ('Chihuahua', 'Lomas Altas II', 4666, NULL, 0),
  ('Chihuahua', 'Lomas del Santuario', 1733, NULL, 0),
  ('Chihuahua', 'Nombre de Dios', 12267, NULL, 0),
  ('Chihuahua', 'Hacienda Santa Fe', 16071, NULL, 0),
  ('Chihuahua', 'Saucito', 14082, NULL, 0),
  ('Chihuahua', 'Cerrada Navarra', 2427, NULL, 0),
  ('Chihuahua', 'Montecarlo', 7291, NULL, 0),
  ('Chihuahua', 'Cumbres IV', 3293, NULL, 0),
  ('Chihuahua', 'Cumbres Universidad II', 5971, NULL, 0),
  ('Chihuahua', 'Lomas del Sol II', 5892, NULL, 0),
  ('Chihuahua', 'Club Campestre', 4911, NULL, 0),
  ('Chihuahua', 'Arcadas', 4808, NULL, 0),
  ('Chihuahua', 'Argeo', 2563, NULL, 0),
  ('Chihuahua', 'Avícola II', 1379, NULL, 0),
  ('Chihuahua', 'Campestre Residencial I', 14074, NULL, 0),
  ('Chihuahua', 'Campestre Residencial II', 2250, NULL, 0),
  ('Chihuahua', 'Chulavista I', 15179, NULL, 0),
  ('Chihuahua', 'De La Madre (10 de Mayo)', 11770, NULL, 0),
  ('Chihuahua', 'El Jardín', 2364, NULL, 0),
  ('Chihuahua', 'Fuentes del Santuario', 6316, NULL, 0),
  ('Chihuahua', 'Hacienda Victoria', 9828, NULL, 0),
  ('Chihuahua', 'Herradura Pdu', 5415, NULL, 0),
  ('Chihuahua', 'Jardines del Sacramento', 7431, NULL, 0),
  ('Chihuahua', 'La Ribereña', 9703, NULL, 0),
  ('Chihuahua', 'Lomas Altas I', 2381, NULL, 0),
  ('Chihuahua', 'Lomas Altas IV', 2031, NULL, 0),
  ('Chihuahua', 'Lomas La Salle II', 2429, NULL, 0),
  ('Chihuahua', 'Lomas Universidad I', 3274, NULL, 0),
  ('Chihuahua', 'Lomas del Valle I y II', 6066, NULL, 0),
  ('Chihuahua', 'Los Portales', 17398, NULL, 0),
  ('Chihuahua', 'Melchor Ocampo', 11624, NULL, 0),
  ('Chihuahua', 'Mision Universidad I', 4906, NULL, 0),
  ('Chihuahua', 'Monte Caleres', 2019, NULL, 0),
  ('Chihuahua', 'Monte Xenit', 4005, NULL, 0),
  ('Chihuahua', 'Nacional', 11268, NULL, 0),
  ('Chihuahua', 'Parque Industrial Impulso', 3647, NULL, 0),
  ('Chihuahua', 'Parque Industrial Supra', 6133, NULL, 0),
  ('Chihuahua', 'Paseo de las Moras', 5064, NULL, 0),
  ('Chihuahua', 'Pedregal del Real', 13750, NULL, 0),
  ('Chihuahua', 'Puente de Cantera', 10279, NULL, 0),
  ('Chihuahua', 'Puerta del Valle', 9655, NULL, 0),
  ('Chihuahua', 'Quintas del Sol II', 3542, NULL, 0),
  ('Chihuahua', 'Real Universidad', 4347, NULL, 0),
  ('Chihuahua', 'Residencial la Cantera', 2822, NULL, 0),
  ('Chihuahua', 'Rosario', 6853, NULL, 0),
  ('Chihuahua', 'San Felipe V', 2588, NULL, 0),
  ('Chihuahua', 'San Francisco I', 17384, NULL, 0),
  ('Chihuahua', 'San Jorge', 1588, NULL, 0),
  ('Chihuahua', 'Santa Rita', 4148, NULL, 0),
  ('Chihuahua', 'Valle Dorado', 5125, NULL, 0),
  ('Chihuahua', 'Valle del Angel', 7068, NULL, 0),
  ('Chihuahua', 'Virreyes I', 1132, NULL, 0),
  ('Chihuahua', 'Vistas Campestre', 1653, NULL, 0),
  ('Chihuahua', 'Álamos', 8765, NULL, 0)
ON CONFLICT (city, colonia) DO NOTHING;
