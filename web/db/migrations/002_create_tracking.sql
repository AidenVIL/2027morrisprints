-- Create tracking tables: page_events and active_sessions
CREATE TABLE IF NOT EXISTS page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  session_id text,
  event_type text NOT NULL,
  path text,
  referrer text,
  user_agent text,
  country text,
  city text
);

CREATE TABLE IF NOT EXISTS active_sessions (
  session_id text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now(),
  country text,
  city text
);
