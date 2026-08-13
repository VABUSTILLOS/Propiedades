-- 41. MARKET BENCHMARKS — DATASET 45 (14 colonias) --------------------
-- Populates market_benchmarks for 14 Chihuahua colonias (≤ $3,000,000 MXN
-- market) newly discovered among the 166 dataset-45 imports (2015/2017
-- Wayback captures of the propiedades.com/chihuahua-chihuahua root
-- pagination pages ?pagina=N). Source: DB price/m² samples (price ÷ size_m2)
-- per colonia, sanity-filtered (size ≥ 5 m², $/m² within benchmark ranges).
-- const = avg for non-terreno (construccion_m2); land = avg for terreno
-- (terreno_m2). Both stored when present; historical growth rate = 0.

INSERT INTO public.market_benchmarks
  (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES
  ('Chihuahua', "Campanario III a", 6843, 0, 0),
  ('Chihuahua', "Francisco I. Madero Condominios", 7578, 0, 0),
  ('Chihuahua', "Fundadores", 0, 158, 0),
  ('Chihuahua', "Jardines de San Francisco I", 12605, 0, 0),
  ('Chihuahua', "jose maria ponce de leon", 4930, 0, 0),
  ('Chihuahua', "Los Naranjos I, II, III, IV, V y VI", 9600, 0, 0),
  ('Chihuahua', "Mezquites Sur", 0, 267, 0),
  ('Chihuahua', "Oasis Revolución", 4487, 0, 0),
  ('Chihuahua', "Puntas Naranjos Oriente I", 6522, 0, 0),
  ('Chihuahua', "Rinconada de Cervantes", 10435, 0, 0),
  ('Chihuahua', "Rincón Soberano", 9091, 0, 0),
  ('Chihuahua', "San Gabriel I y II", 7215, 0, 0),
  ('Chihuahua', "San Juan", 10590, 0, 0),
  ('Chihuahua', "Valle de San Pedro", 9231, 0, 0);
