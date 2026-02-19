import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';
import { formToRowPayload, InventoryItemFormValues } from '../../../../../lib/inventory/schema';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { item_id } = body || {};
    if (!item_id) return NextResponse.json({ error: 'missing item_id' }, { status: 400 });

    // normalize incoming form values to a row-shaped payload
    const formValues: InventoryItemFormValues = body || ({} as any);
    const rowPayload = formToRowPayload(formValues);

    // map to DB column names
    const allowed: any = {};
    if (typeof rowPayload.material === 'string') allowed.material = rowPayload.material;
    if (typeof rowPayload.colour === 'string') allowed.colour = rowPayload.colour;
    if (typeof rowPayload.grams_available_g === 'number') allowed.grams_available = Number(rowPayload.grams_available_g);
    if (typeof rowPayload.grams_reserved_g === 'number') allowed.grams_reserved = Number(rowPayload.grams_reserved_g);
    if (typeof rowPayload.active === 'boolean') allowed.is_active = rowPayload.active;
    if (typeof rowPayload.cost_per_kg_pence === 'number') allowed.cost_per_kg_pence = Number(rowPayload.cost_per_kg_pence);
    if (typeof rowPayload.density_g_per_cm3 === 'number') allowed.density_g_per_cm3 = Number(rowPayload.density_g_per_cm3);
    if (typeof rowPayload.support_multiplier === 'number') allowed.support_multiplier = Number(rowPayload.support_multiplier);

    if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

    allowed.updated_at = new Date().toISOString();

    const supabase = ensureSupabaseAdmin();
    const { error, data } = await supabase.from('inventory_items').update(allowed).eq('id', item_id).select('*').single();
    if (error) {
      console.error('inventory update error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    // add derived GBP for UI
    const result = { ...(data as any), cost_per_kg_gbp: (Number((data as any).cost_per_kg_pence ?? 0) / 100) };
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('inventory update exception', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
