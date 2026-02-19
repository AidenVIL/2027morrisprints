import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../lib/adminAuth';

// inventory list route: serves admin inventory items

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const { data, error } = await supabase.from('inventory_items').select('*').order('material', { ascending: true }).order('colour', { ascending: true });
    if (error) throw error;
    const items = (data || []).map((it: any) => ({
      ...it,
      cost_per_kg_gbp: (Number(it.cost_per_kg_pence ?? 0) / 100),
    }));
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('admin inventory list error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
