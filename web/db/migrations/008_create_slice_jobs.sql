-- Migration: 008_create_slice_jobs.sql
-- Creates the `slice_jobs` table linked to `quotes` with indexes
BEGIN;

-- Ensure uuid generator is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table
CREATE TABLE IF NOT EXISTS public.slice_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  status text NOT NULL,
  settings_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- If table already exists, ensure columns exist
ALTER TABLE public.slice_jobs
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add foreign key constraint for quote_id if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'f'
      AND t.relname = 'slice_jobs'
      AND c.conname = 'slice_jobs_quote_id_fkey'
  ) THEN
    ALTER TABLE public.slice_jobs
      ADD CONSTRAINT slice_jobs_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS slice_jobs_status_idx ON public.slice_jobs(status);
CREATE INDEX IF NOT EXISTS slice_jobs_quote_id_idx ON public.slice_jobs(quote_id);

COMMIT;
