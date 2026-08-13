-- 25. MORTGAGE CALCULATOR LEADS -----------------------------------------------------
-- Leads captured by the mortgage simulator on property detail pages.
-- Stores the contact data plus the simulation metadata used for follow-up.

CREATE TABLE mortgage_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    property_title TEXT,
    property_price NUMERIC(14, 2),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    simulated_monthly_payment NUMERIC(12, 2),
    simulated_down_payment NUMERIC(14, 2),
    simulation JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mortgage_leads_property ON public.mortgage_leads(property_id);
CREATE INDEX IF NOT EXISTS idx_mortgage_leads_created ON public.mortgage_leads(created_at DESC);

ALTER TABLE mortgage_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can submit a lead.
CREATE POLICY "Anyone can submit a mortgage lead" ON mortgage_leads
    FOR INSERT WITH CHECK (true);

-- No public read/update/delete: leads are only visible via service role
-- (admin dashboards / CRM exports run with elevated privileges).
CREATE POLICY "No public mortgage lead reads" ON mortgage_leads
    FOR SELECT USING (false);

CREATE POLICY "No public mortgage lead updates" ON mortgage_leads
    FOR UPDATE USING (false);

CREATE POLICY "No public mortgage lead deletes" ON mortgage_leads
    FOR DELETE USING (false);
