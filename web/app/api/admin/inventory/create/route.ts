import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';
import { formToRowPayload, InventoryItemFormValues } from '../../../../../lib/inventory/schema';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const supabase = ensureSupabaseAdmin();

    // convert incoming form values into a normalized row payload
    const formValues: InventoryItemFormValues = body || ({} as any);
    const rowPayload = formToRowPayload(formValues);

    if (!rowPayload.material || !rowPayload.colour) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    const insertRow: any = {
      material: rowPayload.material,
      colour: rowPayload.colour,
      grams_available: Number(rowPayload.grams_available_g ?? 0),
      grams_reserved: Number(rowPayload.grams_reserved_g ?? 0),
      is_active: Boolean(rowPayload.active ?? true),
      updated_at: new Date().toISOString(),
    };

    if (typeof rowPayload.cost_per_kg_pence === 'number') insertRow.cost_per_kg_pence = rowPayload.cost_per_kg_pence;
    if (typeof rowPayload.density_g_per_cm3 === 'number') insertRow.density_g_per_cm3 = Number(rowPayload.density_g_per_cm3);
    if (typeof rowPayload.support_multiplier === 'number') insertRow.support_multiplier = Number(rowPayload.support_multiplier);

    // try insert; if some optional columns are missing in older DB schemas, retry without them
    const optionalCols = ['density_g_per_cm3', 'support_multiplier'];
    let attempt = 0;
    while (true) {
      attempt += 1;
      const { data: created, error } = await supabase.from('inventory_items').insert([insertRow]).select('*').single();
      if (!error) {
        const result = { ...(created as any), cost_per_kg_gbp: (Number((created as any).cost_per_kg_pence ?? 0) / 100) };
        return NextResponse.json(result);
      }

      const msg = String(error?.message || '').toLowerCase();
      // if column missing for optional fields (older DB), remove and retry once
      let handled = false;
      if (attempt === 1) {
        for (const col of optionalCols) {
          if (msg.includes(col) && msg.includes('could not find')) {
            console.warn(`inventory create: ${col} missing in DB schema; retrying without it`);
            delete insertRow[col];
            handled = true;
          }
        }
      }

      if (handled) continue;

      console.error('inventory create error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }
  } catch (e: any) {
    console.error('inventory create exception', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
