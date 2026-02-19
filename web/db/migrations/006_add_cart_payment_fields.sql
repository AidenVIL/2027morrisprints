-- Add payment fields to carts table
ALTER TABLE IF EXISTS carts
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL,
  ADD COLUMN IF NOT EXISTS checkout_details jsonb NULL;

-- Optional: a small payments summary for quick queries
ALTER TABLE IF EXISTS carts
  ADD COLUMN IF NOT EXISTS amount_authorised_pence int NULL;

CREATE INDEX IF NOT EXISTS carts_payment_intent_idx ON carts(stripe_payment_intent_id);
