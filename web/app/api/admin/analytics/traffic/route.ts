import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const now = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // fetch recent page events (30d)
    const { data: events } = await supabase.from('page_events').select('country, session_id').gte('ts', thirtyAgo).limit(100000);
    const byCountry: Record<string, { totalViews: number; uniqueSessions: Set<string> }> = {};
    (events || []).forEach((r: any) => {
      const country = (r.country || 'Unknown') || 'Unknown';
      const session = r.session_id || 'anon';
      if (!byCountry[country]) byCountry[country] = { totalViews: 0, uniqueSessions: new Set() };
      byCountry[country].totalViews += 1;
      byCountry[country].uniqueSessions.add(session);
    });

    const rows = Object.entries(byCountry).map(([country, v]) => ({ country, totalViews: v.totalViews, uniqueSessions: v.uniqueSessions.size }));
    // sort descending
    rows.sort((a, b) => b.totalViews - a.totalViews);

    return NextResponse.json({ rows });
  } catch (e: any) {
    console.error('analytics traffic error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
