-- Migration: 007_update_quotes_schema.sql
-- Ensure the `quotes` table matches the requested schema for Supabase/Postgres
BEGIN;

-- Ensure uuid generator is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the table if it doesn't exist with the desired canonical schema
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  file_url text,
  original_filename text,
  material text,
  layer_height numeric,
  infill_percent integer,
  supports_enabled boolean DEFAULT false,
  estimated_time_seconds integer,
  estimated_weight_grams numeric,
  machine_cost numeric,
  material_cost numeric,
  electricity_cost numeric,
  total_price numeric,
  quote_version integer DEFAULT 1,
  status text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- If the table already existed, make sure all requested columns exist.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS layer_height numeric,
  ADD COLUMN IF NOT EXISTS infill_percent integer,
  ADD COLUMN IF NOT EXISTS supports_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_time_seconds integer,
  ADD COLUMN IF NOT EXISTS estimated_weight_grams numeric,
  ADD COLUMN IF NOT EXISTS machine_cost numeric,
  ADD COLUMN IF NOT EXISTS material_cost numeric,
  ADD COLUMN IF NOT EXISTS electricity_cost numeric,
  ADD COLUMN IF NOT EXISTS total_price numeric,
  ADD COLUMN IF NOT EXISTS quote_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add foreign key constraint for user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'f'
      AND t.relname = 'quotes'
      AND c.conname = 'quotes_user_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Add CHECK constraints (apply only if not present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_infill_percent_range') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_infill_percent_range CHECK (infill_percent IS NULL OR (infill_percent >= 0 AND infill_percent <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_quote_version_positive') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_quote_version_positive CHECK (quote_version IS NULL OR quote_version >= 1);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes(created_at);
CREATE INDEX IF NOT EXISTS quotes_quote_version_idx ON public.quotes(quote_version);

-- Trigger to maintain updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.quotes;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
