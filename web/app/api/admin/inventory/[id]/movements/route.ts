import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../../lib/adminAuth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const supabase = ensureSupabaseAdmin();
    const { data, error } = await supabase.from('inventory_movements').select('*').eq('item_id', id).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('inventory movements error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
