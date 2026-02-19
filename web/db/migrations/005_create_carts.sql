-- Create carts and cart_items tables
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  customer_id uuid NULL,
  session_id text NULL,
  status text DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY,
  cart_id uuid REFERENCES carts(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL,
  qty int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carts_session_idx ON carts(session_id);
CREATE INDEX IF NOT EXISTS carts_customer_idx ON carts(customer_id);
