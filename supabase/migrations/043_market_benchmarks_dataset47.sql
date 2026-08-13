-- Dataset-47 (terrenos-habitacionales/industriales + industrial pages 2025-26)
-- New colonia benchmarks computed from imported Chihuahua venta properties.
INSERT INTO market_benchmarks (city, colonia, avg_price_m2_const, avg_price_m2_land, historical_growth_rate)
VALUES ('Chihuahua', 'Pozos del Valle', NULL, 350, 0)
ON CONFLICT (city, colonia) DO NOTHING;
