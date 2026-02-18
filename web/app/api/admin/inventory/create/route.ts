import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const {
      material,
      colour,
      grams_available = 0,
      grams_reserved = 0,
      // accept either pence or GBP for cost
      cost_per_kg_pence = undefined,
      cost_per_kg_gbp = undefined,
      // optional new estimator fields
      density_g_per_cm3 = undefined,
      support_multiplier = undefined,
      is_active = true,
    } = body || {};

    if (!material || !colour) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    const supabase = ensureSupabaseAdmin();

    // normalize cost to GBP numeric column when possible
    let costGbp: number | null = null;
    if (typeof cost_per_kg_gbp === 'number') costGbp = cost_per_kg_gbp;
    else if (typeof cost_per_kg_pence === 'number') costGbp = Number(cost_per_kg_pence) / 100;

    const insertRow: any = {
      material,
      colour,
      grams_available: Number(grams_available),
      grams_reserved: Number(grams_reserved),
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (costGbp !== null) insertRow.cost_per_kg_gbp = costGbp;
    // keep legacy pence column if provided
    if (typeof cost_per_kg_pence === 'number') insertRow.cost_per_kg_pence = Number(cost_per_kg_pence);
    if (typeof density_g_per_cm3 === 'number') insertRow.density_g_per_cm3 = Number(density_g_per_cm3);
    if (typeof support_multiplier === 'number') insertRow.support_multiplier = Number(support_multiplier);

    const { data, error } = await supabase.from('inventory_items').insert([insertRow]).select('*').single();

    if (error) {
      console.error('inventory create error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('inventory create exception', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
