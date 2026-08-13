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
  ('Chihuahua', 'Junta de los Ríos y Etapas',                11583,  NULL, 0),
  -- Real benchmarks from detail-page statistics (Nov 2025 + Feb 2025 datasets)
  ('Chihuahua', 'Ankara',                                    17453, 17798, 0),
  ('Chihuahua', 'Cuauhtémoc',                                12248,  8729, 0),
  ('Chihuahua', 'Lomas Montecarlo',                          10197, 10452, 0),
  ('Chihuahua', 'Los Huertos',                               10350, 12161, 0),
  ('Chihuahua', 'Panamericana',                              11918,  8854, 0),
  ('Chihuahua', 'Paseos de Chihuahua',                        8680, 10797, 0),
  ('Chihuahua', 'Quintas Montecarlo',                         8175,  7766, 0),
  ('Chihuahua', 'Residencial El León',                        8751,  6837, 0),
  ('Chihuahua', 'Rincón del Lago',                            8449,  9182, 0),
  ('Chihuahua', 'Santo Niño',                                29061, 27446, 0),
  ('Chihuahua', 'Tracia',                                    19111, 18870, 0),
  -- Fallback benchmarks from list captures (n=1, circular — low confidence)
  ('Chihuahua', 'Campesina',                                 22936,  NULL, 0),
  ('Chihuahua', 'Cumbres Universidad',                       13750,  NULL, 0),
  ('Chihuahua', 'Molino de Agua',                            16480,  NULL, 0)
ON CONFLICT (city, colonia) DO NOTHING;
