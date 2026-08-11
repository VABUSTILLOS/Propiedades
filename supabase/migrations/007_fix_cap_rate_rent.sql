-- 007: Fix cap-rate overflow for rental listings
--
-- compute_cap_rate returns NUMERIC(5,2) (max 999.99). For 'rent' listings the
-- price is a monthly figure, so (monthly_rent*12/price)*100 blows up (e.g. 1200)
-- and the BEFORE INSERT trigger fails with numeric field overflow (22003).
-- Cap rate is a purchase metric; only compute it for 'sale' listings.

CREATE OR REPLACE FUNCTION public.maintain_property_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cap rate applies to purchases only; rents have no capital value ratio.
  IF NEW.type = 'sale' AND NEW.price IS NOT NULL AND NEW.price > 0 AND NEW.estimated_monthly_rent IS NOT NULL THEN
    NEW.cap_rate_projected := public.compute_cap_rate(NEW.price, NEW.estimated_monthly_rent);
  ELSE
    NEW.cap_rate_projected := NULL;
  END IF;

  -- Discount vs. appraisal (savings vs. independent valuation).
  IF NEW.valor_avaluo IS NOT NULL AND NEW.valor_avaluo > 0 THEN
    NEW.porcentaje_descuento_avaluo := ROUND(((NEW.valor_avaluo - NEW.price) / NEW.valor_avaluo) * 100, 2);
  ELSE
    NEW.porcentaje_descuento_avaluo := NULL;
  END IF;

  RETURN NEW;
END;
$$;
