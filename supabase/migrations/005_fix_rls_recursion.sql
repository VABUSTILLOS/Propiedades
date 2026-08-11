-- 005: Fix RLS infinite recursion on profiles
--
-- The "Admins can manage all profiles" policy (001) self-references profiles:
--   USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
-- Every query on profiles (direct or via subqueries from properties/transactions/
-- messages/bids/market_benchmarks policies) re-evaluates this policy, which
-- re-queries profiles -> infinite recursion (SQLSTATE 42P17).
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS, and rewrite the three
-- policies that inline "SELECT 1 FROM profiles" to use them.

-- 1. Helper functions (bypass RLS; safe: only read own role row, return bool).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agent()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'agent'
  );
$$;

-- 2. Rewrite the admin policy on profiles (drop self-referencing version).
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL
  USING (public.is_admin());

-- 3. Rewrite the agent policy on properties.
DROP POLICY IF EXISTS "Agents can view MLS properties" ON properties;
CREATE POLICY "Agents can view MLS properties" ON properties FOR SELECT
  USING (is_mls = true AND public.is_agent());

-- 4. Rewrite the admin policy on market_benchmarks.
DROP POLICY IF EXISTS "Admins manage market benchmarks" ON market_benchmarks;
CREATE POLICY "Admins manage market benchmarks" ON market_benchmarks FOR ALL
  USING (public.is_admin());

-- Grant usage on the helper functions to anon/authenticated so RLS checks work.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_agent() TO anon, authenticated, service_role;
