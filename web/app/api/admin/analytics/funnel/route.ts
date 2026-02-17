import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = ensureSupabaseAdmin();
    const now = Date.now();
    const thirtyAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabase.from('page_events').select('event_type, session_id').gte('ts', thirtyAgo).limit(200000);

    let landing = 0;
    let quoteStarted = 0;
    let checkoutStarted = 0;
    let quoteSubmitted = 0;

    const seenLanding = new Set<string>();
    const seenQuoteStarted = new Set<string>();
    const seenCheckout = new Set<string>();
    const seenSubmitted = new Set<string>();

    (events || []).forEach((r: any) => {
      const t = r.event_type;
      const s = r.session_id || 'anon';
      if (t === 'page_view') {
        landing += 1;
        seenLanding.add(s);
      }
      if (t === 'quote_started') { quoteStarted += 1; seenQuoteStarted.add(s); }
      if (t === 'checkout_started') { checkoutStarted += 1; seenCheckout.add(s); }
      if (t === 'quote_submitted') { quoteSubmitted += 1; seenSubmitted.add(s); }
    });

    const landingSessions = seenLanding.size;
    const startSessions = seenQuoteStarted.size;
    const checkoutSessions = seenCheckout.size;
    const submittedSessions = seenSubmitted.size;

    const rate = (a: number, b: number) => (a === 0 ? 0 : Number(((b / a) * 100).toFixed(2)));

    return NextResponse.json({
      landingViews: landing,
      quoteStarted,
      checkoutStarted,
      quoteSubmitted,
      unique: {
        landingSessions,
        startSessions,
        checkoutSessions,
        submittedSessions,
      },
      conversion: {
        startFromLandingPct: rate(landingSessions, startSessions),
        checkoutFromStartPct: rate(startSessions, checkoutSessions),
        submitFromCheckoutPct: rate(checkoutSessions, submittedSessions),
        overallSubmitFromLandingPct: rate(landingSessions, submittedSessions),
      },
    });
  } catch (e: any) {
    console.error('analytics funnel error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
