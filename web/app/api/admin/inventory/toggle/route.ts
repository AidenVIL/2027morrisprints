import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { item_id, is_active } = body || {};
    if (!item_id || typeof is_active !== 'boolean') return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    const supabase = ensureSupabaseAdmin();
    const { error } = await supabase.from('inventory_items').update({ is_active, updated_at: new Date().toISOString() }).eq('id', item_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('inventory toggle error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
