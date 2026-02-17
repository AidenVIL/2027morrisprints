import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { count: activeNow } = await supabase.from('active_sessions').select('session_id', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo);

    const { data: recentEvents } = await supabase.from('page_events').select('session_id, ts').gte('ts', thirtyMinAgo).limit(100000);
    const uniqueLast30 = new Set((recentEvents || []).map((r: any) => r.session_id || 'anon'));

    // time series last 24h in 15-min buckets
    const { data: last24 } = await supabase.from('page_events').select('ts').gte('ts', dayAgo).limit(200000);
    const bucketMs = 15 * 60 * 1000;
    const buckets: Record<number, number> = {};
    const start = Math.floor((now - 24 * 60 * 60 * 1000) / bucketMs) * bucketMs;
    for (let t = start; t <= now; t += bucketMs) buckets[t] = 0;
    (last24 || []).forEach((r: any) => {
      const ts = new Date(r.ts).getTime();
      const b = Math.floor(ts / bucketMs) * bucketMs;
      if (buckets[b] !== undefined) buckets[b] += 1;
    });

    const timeSeries = Object.keys(buckets).map(k => ({ ts: Number(k), count: buckets[Number(k)] }));

    return NextResponse.json({
      activeNow: Number(activeNow ?? 0),
      activeLast30min: uniqueLast30.size,
      timeSeries,
    });
  } catch (e: any) {
    console.error('analytics active error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
