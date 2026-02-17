-- Add pricing and inventory fields for estimator
ALTER TABLE IF EXISTS inventory_items
  ADD COLUMN IF NOT EXISTS density_g_per_cm3 numeric DEFAULT 1.24,
  ADD COLUMN IF NOT EXISTS cost_per_kg_gbp numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS support_multiplier numeric DEFAULT 1.18;

-- Create app_settings table to hold pricing and machine settings (single-row)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_rate_per_hour_gbp numeric DEFAULT 0.30,
  electricity_price_per_kwh_gbp numeric DEFAULT 0.0,
  printer_avg_watts integer DEFAULT 120,
  electricity_markup numeric DEFAULT 1.10,
  material_markup numeric DEFAULT 1.50,
  labour_fee_gbp numeric DEFAULT 1.00,
  min_order_fee_gbp numeric DEFAULT 0.0,
  supports_fee_gbp numeric DEFAULT 0.0,
  small_part_fee_threshold_g numeric DEFAULT 15,
  small_part_fee_gbp numeric DEFAULT 0.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure there is at least one settings row (optional)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM app_settings) = 0 THEN
    INSERT INTO app_settings DEFAULT VALUES;
  END IF;
END$$;
