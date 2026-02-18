import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { item_id } = body || {};
    if (!item_id) return NextResponse.json({ error: 'missing item_id' }, { status: 400 });

    // allowed updatable fields
    const allowed: any = {};
    if (typeof body.material === 'string') allowed.material = body.material.trim();
    if (typeof body.colour === 'string') allowed.colour = body.colour.trim();
    if (typeof body.grams_available !== 'undefined') allowed.grams_available = Number(body.grams_available);
    if (typeof body.grams_reserved !== 'undefined') allowed.grams_reserved = Number(body.grams_reserved);
    if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active;

    // cost can be provided either as pence or gbp
    if (typeof body.cost_per_kg_gbp === 'number') allowed.cost_per_kg_gbp = Number(body.cost_per_kg_gbp);
    else if (typeof body.cost_per_kg_pence === 'number') allowed.cost_per_kg_gbp = Number(body.cost_per_kg_pence) / 100;

    if (typeof body.density_g_per_cm3 === 'number') allowed.density_g_per_cm3 = Number(body.density_g_per_cm3);
    if (typeof body.support_multiplier === 'number') allowed.support_multiplier = Number(body.support_multiplier);

    if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

    allowed.updated_at = new Date().toISOString();

    const supabase = ensureSupabaseAdmin();
    const { error, data } = await supabase.from('inventory_items').update(allowed).eq('id', item_id).select('*').single();
    if (error) {
      console.error('inventory update error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('inventory update exception', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
