-- Migration: create quotes table
-- Adds `quotes` table with constraints, indexes, and updated_at trigger

-- Ensure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table
CREATE TABLE IF NOT EXISTS public.quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    file_url text NOT NULL,
    original_filename text NOT NULL,
    material text NOT NULL,
    layer_height numeric NOT NULL CHECK (layer_height > 0),
    infill_percent integer NOT NULL CHECK (infill_percent >= 0 AND infill_percent <= 100),
    supports_enabled boolean NOT NULL DEFAULT false,
    estimated_time_seconds integer CHECK (estimated_time_seconds >= 0),
    estimated_weight_grams numeric CHECK (estimated_weight_grams >= 0),
    machine_cost numeric CHECK (machine_cost >= 0),
    material_cost numeric CHECK (material_cost >= 0),
    electricity_cost numeric CHECK (electricity_cost >= 0),
    total_price numeric CHECK (total_price >= 0),
    quote_version integer NOT NULL DEFAULT 1 CHECK (quote_version >= 1),
    status text NOT NULL,
    admin_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes(created_at);

-- Function to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.quotes;
CREATE TRIGGER set_updated_at_trigger
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Optional: provide a convenient view or additional constraints in future migrations
