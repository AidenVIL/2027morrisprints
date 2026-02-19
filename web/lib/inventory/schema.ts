export type InventoryItemRow = {
  id: string;
  material: string;
  colour: string;
  active: boolean;
  grams_available_g: number;
  grams_reserved_g: number;
  cost_per_kg_pence: number;
  density_g_per_cm3: number;
  support_multiplier: number;
};

export type InventoryItemFormValues = {
  id?: string;
  material: string;
  colour: string;
  active: boolean;
  grams_available_g: number;
  grams_reserved_g: number;
  cost_per_kg_pence?: number;
  cost_per_kg_gbp?: number; // UI-facing decimal
  density_g_per_cm3: number;
  support_multiplier: number;
};

// Normalize a DB row (or legacy row) into form values for the UI
export function rowToForm(row: any): InventoryItemFormValues {
  const costPence = Number(row.cost_per_kg_pence ?? 0);
  return {
    id: String(row.id),
    material: String(row.material ?? ''),
    colour: String(row.colour ?? ''),
    active: Boolean(row.is_active ?? row.active ?? false),
    grams_available_g: Number(row.grams_available ?? row.grams_available_g ?? 0),
    grams_reserved_g: Number(row.grams_reserved ?? row.grams_reserved_g ?? 0),
    cost_per_kg_pence: Number(row.cost_per_kg_pence ?? null),
    cost_per_kg_gbp: costPence / 100,
    density_g_per_cm3: Number(row.density_g_per_cm3 ?? row.density ?? 1.24),
    support_multiplier: Number(row.support_multiplier ?? row.supportMultiplier ?? 1.18),
  };
}

// Convert UI form values into a DB payload. Returns keys in the InventoryItemRow shape
// but does not include derived fields like cost_per_kg_gbp.
export function formToRowPayload(values: any): Partial<InventoryItemRow> {
  const out: Partial<InventoryItemRow> = {};
  if (typeof values.material === 'string') out.material = values.material.trim();
  if (typeof values.colour === 'string') out.colour = values.colour.trim();
  if (typeof values.active === 'boolean') out.active = values.active;

  // accept either grams_available or grams_available_g
  if (typeof values.grams_available_g === 'number') out.grams_available_g = Number(values.grams_available_g);
  else if (typeof values.grams_available === 'number') out.grams_available_g = Number(values.grams_available);

  if (typeof values.grams_reserved_g === 'number') out.grams_reserved_g = Number(values.grams_reserved_g);
  else if (typeof values.grams_reserved === 'number') out.grams_reserved_g = Number(values.grams_reserved);

  // cost: accept pence or gbp
  if (typeof values.cost_per_kg_pence === 'number') {
    out.cost_per_kg_pence = Number(values.cost_per_kg_pence);
  } else if (typeof values.cost_per_kg_gbp === 'number') {
    out.cost_per_kg_pence = Math.round(Number(values.cost_per_kg_gbp) * 100);
  }

  if (typeof values.density_g_per_cm3 === 'number') out.density_g_per_cm3 = Number(values.density_g_per_cm3);
  if (typeof values.support_multiplier === 'number') out.support_multiplier = Number(values.support_multiplier);

  return out;
}
