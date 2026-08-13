-- 28. MARKET BENCHMARKS — DATASET 33 (28 newly imported colonias) ----------
-- Populates market_benchmarks for 28 colonias of the dataset-33 import
-- (Chihuahua, venta ≤ $3,000,000 MXN) that lacked coverage, so the semáforo
-- RPC (compute_colonia_discount) can score every imported property.
--
-- Sources: no Wayback detail-page captures exist for these colonias, so
-- values are computed from captured list-card price/m² samples
-- (price ÷ size_m2), dedup'd per property.
--
-- Terreno-only colonias store the value in avg_price_m2_land (const=0);
-- mixed colonias (Cordilleras, Francisco R Almada, Granjas del Valle,
-- Robinson) get both columns; all others use avg_price_m2_const.
--
-- Excluded (no size data in source cards): Las Canteras, Los Llanos, Obrera.
-- Those properties have precio_m2_const NULL so the RPC returns NULL for them
-- regardless; benchmarks are impossible to compute without m² samples.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', 'Ampliación Américas', 40714, 0, 0),
  ('Chihuahua', 'Begonias', 13793, 0, 0),
  ('Chihuahua', 'Bellavista', 5679, 0, 0),
  ('Chihuahua', 'Caminos del Valle', 27174, 0, 0),
  ('Chihuahua', 'Centro SCT Chihuahua', 5926, 0, 0),
  ('Chihuahua', 'Cerro Prieto', 0, 1344, 0),
  ('Chihuahua', 'Cordilleras', 23722, 10596, 0),
  ('Chihuahua', 'Crucero', 5392, 0, 0),
  ('Chihuahua', 'Cumbres de Robinson', 7333, 0, 0),
  ('Chihuahua', 'Ejido Labor de Terrazas', 0, 1008, 0),
  ('Chihuahua', 'Francisco R Almada', 22500, 5750, 0),
  ('Chihuahua', 'Granjas del Valle', 1143, 1500, 0),
  ('Chihuahua', 'Jardines de Oriente', 11983, 0, 0),
  ('Chihuahua', 'Marielena Hernandez', 10000, 0, 0),
  ('Chihuahua', 'Pacifico', 7805, 0, 0),
  ('Chihuahua', 'Parque Industrial Intermex Aeropuerto', 0, 467, 0),
  ('Chihuahua', 'Poblado La Haciendita', 0, 425, 0),
  ('Chihuahua', 'Poblado Labor de Terrazas o Portillo', 0, 425, 0),
  ('Chihuahua', 'Predio la Cantera', 0, 46477, 0),
  ('Chihuahua', 'Presidentes', 20000, 0, 0),
  ('Chihuahua', 'Rinconada de Oriente I', 14706, 0, 0),
  ('Chihuahua', 'Robinson', 12333, 936, 0),
  ('Chihuahua', 'San Felipe I', 39811, 0, 0),
  ('Chihuahua', 'San Felipe VI', 43728, 0, 0),
  ('Chihuahua', 'Secretaria de La Marina', 22500, 0, 0),
  ('Chihuahua', 'Sierra Azul', 0, 504, 0),
  ('Chihuahua', 'Unidad', 19000, 0, 0),
  ('Chihuahua', 'Veteranos de la Revolución', 11702, 0, 0);
