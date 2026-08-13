-- Market benchmarks for colonias in Chihuahua, sourced from propiedades.com
-- detail-page statistics (Wayback captures, latest date wins) and list-capture
-- fallbacks (avg $/m² from listings ≤ $3,000,000 MXN, same city+colonia).
--
-- avg_price_m2_const / avg_price_m2_land are stored as cents-per-m² numeric
-- values (PostgREST inserts real numbers; columns are NUMERIC).
INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  -- Real benchmarks from detail-page statistics
  ('Chihuahua', 'Monteverde',                                15396, 16825, 0),
  ('Chihuahua', 'Colinas del Valle',                         11147, 11466, 0),
  ('Chihuahua', 'Romanzza',                                   8457,  8034, 0),
  ('Chihuahua', 'Diamante Reliz',                            15540, 14886, 0),
  ('Chihuahua', 'La Haciendita',                             17771, 18996, 0),
  ('Chihuahua', 'Bosques del Valle',                         14405, 16133, 0),
  ('Chihuahua', 'Campo Bello',                                9837, 11528, 0),
  ('Chihuahua', 'Misión del Valle',                          14938, 13956, 0),
  ('Chihuahua', 'Lomas del Santuario II Etapa',              15037, 11696, 0),
  -- Fallback benchmarks from list captures (≤ $3M listings)
  ('Chihuahua', 'Ciudad Universitaria',                      NULL,   2667, 0),
  ('Chihuahua', 'Lomas Altas V',                              NULL,   7968, 0),
  ('Chihuahua', 'Arquitos',                                  31765,  NULL, 0),
  ('Chihuahua', 'Provincia de Santa Clara Etapa I a La XII', 19366,  NULL, 0),
  ('Chihuahua', 'Los Pinos',                                 14773,  NULL, 0),
  ('Chihuahua', 'Santa Rosa',                                21739,  NULL, 0),
  ('Chihuahua', 'Seratta 36',                                20896,  NULL, 0),
  ('Chihuahua', 'Bosques de San Pedro',                      15372,  NULL, 0),
  ('Chihuahua', 'Puente de Piedra',                          21831,  NULL, 0),
  ('Chihuahua', 'Mirador',                                   19226,  NULL, 0),
  ('Chihuahua', 'Junta de los Ríos y Etapas',                11583,  NULL, 0)
ON CONFLICT (city, colonia) DO NOTHING;
