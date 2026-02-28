-- Migration: create slice_jobs table
-- Adds `slice_jobs` table with constraints and index on status

-- Ensure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.slice_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    status text NOT NULL,
    settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- Index on status for quick lookups by job state
CREATE INDEX IF NOT EXISTS slice_jobs_status_idx ON public.slice_jobs(status);
