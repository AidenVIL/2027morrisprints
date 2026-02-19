import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/adminAuth';

// Returns editable inventory schema for admin UI
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const schema = {
      fields: [
        { key: 'material', label: 'Material', type: 'text', required: true },
        { key: 'colour', label: 'Colour', type: 'text', required: true },
        { key: 'active', label: 'Active', type: 'boolean' },
        { key: 'grams_available', label: 'Grams available (g)', type: 'number', min: 0 },
        { key: 'grams_reserved', label: 'Grams reserved (g)', type: 'number', min: 0 },
        { key: 'cost_per_kg_gbp', label: 'Cost per KG (£)', type: 'money_gbp', min: 0 },
        { key: 'density_g_per_cm3', label: 'Density (g/cm³)', type: 'number', min: 0.5, step: 0.01 },
        { key: 'support_multiplier', label: 'Support multiplier', type: 'number', min: 1.0, step: 0.01 },
      ],
    };

    return NextResponse.json(schema);
  } catch (e: any) {
    console.error('inventory schema error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
