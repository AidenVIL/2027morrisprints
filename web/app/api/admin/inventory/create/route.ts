import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { material, colour, grams_available = 0, grams_reserved = 0, cost_per_kg_pence = 0, is_active = true } = body || {};
    if (!material || !colour) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    const supabase = ensureSupabaseAdmin();
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ material, colour, grams_available: Number(grams_available), grams_reserved: Number(grams_reserved), cost_per_kg_pence: Number(cost_per_kg_pence), is_active }])
      .select('*')
      .single();

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
