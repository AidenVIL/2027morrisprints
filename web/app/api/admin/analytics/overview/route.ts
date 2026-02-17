import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const now = new Date();
    const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    // counts using head=true to get exact counts without fetching rows
    const { count: totalQuotes7d } = await supabase.from('quote_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenAgo);
    const { count: totalQuotes30d } = await supabase.from('quote_requests').select('id', { count: 'exact', head: true }).gte('created_at', thirtyAgo);

    // revenue sums (estimated_price_pence) over ranges
    const { data: rev7 } = await supabase.from('quote_requests').select('sum:estimated_price_pence').gte('created_at', sevenAgo).maybeSingle();
    const { data: rev30 } = await supabase.from('quote_requests').select('sum:estimated_price_pence').gte('created_at', thirtyAgo).maybeSingle();
    const revenue7dPence = rev7?.sum ?? 0;
    const revenue30dPence = rev30?.sum ?? 0;

    const { count: activeNow } = await supabase.from('active_sessions').select('session_id', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo);

    return NextResponse.json({
      totalQuotes7d: Number(totalQuotes7d ?? 0),
      totalQuotes30d: Number(totalQuotes30d ?? 0),
      revenue7d: Number(revenue7dPence) / 100,
      revenue30d: Number(revenue30dPence) / 100,
      activeNow: Number(activeNow ?? 0),
    });
  } catch (e: any) {
    console.error('analytics overview error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
