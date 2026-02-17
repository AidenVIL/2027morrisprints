import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const { data, error } = await supabase.from('inventory_items').select('*').order('material', { ascending: true }).order('colour', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('admin inventory list error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
