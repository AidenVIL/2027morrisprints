import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { item_id, type, grams = 0, note = null } = body || {};
    if (!item_id || !type) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    const supabase = ensureSupabaseAdmin();

    // support: add, remove, reserve, release, consume, adjust_reserved
    if (type === 'reserve') {
      await supabase.rpc('reserve_inventory', { p_item_id: item_id, p_grams: Number(grams) });
    } else if (type === 'release') {
      await supabase.rpc('release_inventory', { p_item_id: item_id, p_grams: Number(grams) });
    } else if (type === 'consume') {
      await supabase.rpc('consume_inventory', { p_item_id: item_id, p_grams: Number(grams) });
    } else if (type === 'add' || type === 'remove' || type === 'adjust_reserved') {
      // fetch current
      const { data: item } = await supabase.from('inventory_items').select('*').eq('id', item_id).single();
      if (!item) return NextResponse.json({ error: 'item not found' }, { status: 404 });

      let updated: any = {};
      if (type === 'add') {
        updated.grams_available = (item.grams_available || 0) + Number(grams);
      } else if (type === 'remove') {
        updated.grams_available = Math.max((item.grams_available || 0) - Number(grams), 0);
      } else if (type === 'adjust_reserved') {
        updated.grams_reserved = Math.max(Number(grams), 0);
      }

      const { error } = await supabase.from('inventory_items').update({ ...updated, updated_at: new Date().toISOString() }).eq('id', item_id);
      if (error) throw error;
      // insert movement record
      await supabase.from('inventory_movements').insert([{ item_id, type, grams: Number(grams), note }]);
    } else {
      return NextResponse.json({ error: 'unsupported type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('inventory adjust error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
