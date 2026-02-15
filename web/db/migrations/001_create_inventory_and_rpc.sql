-- Create inventory tables and RPCs
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material text NOT NULL,
  colour text NOT NULL,
  brand text,
  cost_per_kg_pence integer NOT NULL,
  grams_available integer NOT NULL DEFAULT 0,
  grams_reserved integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(material, colour, brand)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id),
  admin_id uuid REFERENCES profiles(id),
  type text CHECK (type IN ('add','remove','reserve','release','consume','adjust')),
  grams integer NOT NULL,
  related_quote_id uuid NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Update quote_requests table
ALTER TABLE IF EXISTS quote_requests
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id),
  ADD COLUMN IF NOT EXISTS estimated_grams integer,
  ADD COLUMN IF NOT EXISTS estimated_print_time_seconds integer,
  ADD COLUMN IF NOT EXISTS reserved_grams integer,
  ADD COLUMN IF NOT EXISTS estimated_price_pence integer;

-- RPC to reserve inventory safely
CREATE OR REPLACE FUNCTION reserve_inventory(p_item_id uuid, p_grams integer, p_quote_id uuid, p_admin_id uuid DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_available integer;
BEGIN
  -- lock the row
  UPDATE inventory_items SET grams_reserved = grams_reserved WHERE id = p_item_id;
  SELECT grams_available - grams_reserved INTO v_available FROM inventory_items WHERE id = p_item_id FOR UPDATE;
  IF v_available IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;
  IF v_available < p_grams THEN
    RAISE EXCEPTION 'insufficient stock';
  END IF;
  UPDATE inventory_items SET grams_reserved = grams_reserved + p_grams, updated_at = now() WHERE id = p_item_id;
  INSERT INTO inventory_movements(item_id, admin_id, type, grams, related_quote_id, created_at) VALUES (p_item_id, p_admin_id, 'reserve', p_grams, p_quote_id, now());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_inventory(p_item_id uuid, p_grams integer, p_quote_id uuid, p_admin_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE inventory_items SET grams_reserved = GREATEST(grams_reserved - p_grams, 0), updated_at = now() WHERE id = p_item_id;
  INSERT INTO inventory_movements(item_id, admin_id, type, grams, related_quote_id, created_at) VALUES (p_item_id, p_admin_id, 'release', p_grams, p_quote_id, now());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION consume_inventory(p_item_id uuid, p_grams integer, p_quote_id uuid, p_admin_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE inventory_items SET grams_reserved = GREATEST(grams_reserved - p_grams, 0), grams_available = GREATEST(grams_available - p_grams, 0), updated_at = now() WHERE id = p_item_id;
  INSERT INTO inventory_movements(item_id, admin_id, type, grams, related_quote_id, created_at) VALUES (p_item_id, p_admin_id, 'consume', p_grams, p_quote_id, now());
END;
$$ LANGUAGE plpgsql;
