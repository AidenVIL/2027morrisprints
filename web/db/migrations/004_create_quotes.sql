-- Create quotes table to persist generated quotes
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  customer_id uuid NULL,
  customer_email text NULL,
  inventory_item_id uuid NULL,
  material text NULL,
  layer_preset text NULL,
  infill_percent int NULL,
  supports boolean NULL,
  quantity int NULL,
  storage_path text NULL,
  original_name text NULL,
  grams_est int NULL,
  time_seconds_est int NULL,
  price_material_pence int NULL,
  price_machine_pence int NULL,
  price_electricity_pence int NULL,
  price_labour_pence int NULL,
  price_extras_pence int NULL,
  price_total_pence int NULL,
  status text DEFAULT 'estimated',
  currency text DEFAULT 'gbp'
);

-- optional index for lookups by customer
CREATE INDEX IF NOT EXISTS quotes_customer_id_idx ON quotes(customer_id);
