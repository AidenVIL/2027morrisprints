import { NextRequest } from 'next/server';
import { ensureSupabaseAdmin } from '../../../lib/supabaseClient';

function guessGeoFromRequest(req: NextRequest) {
  // Next.js request.geo is available on some platforms (Vercel)
  // Fallback to common headers; default to Unknown
  try {
    // @ts-ignore
    const geo = (req as any).geo;
    const country = geo?.country || req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || 'Unknown';
    const city = geo?.city || req.headers.get('x-vercel-ip-city') || 'Unknown';
    return { country, city };
  } catch (e) {
    return { country: 'Unknown', city: 'Unknown' };
  }
}

export async function POST(request: Request) {
  try {
    const supabase = ensureSupabaseAdmin();
    const req = request as NextRequest;
    const payload = await request.json();
    const event_type = payload?.event_type || payload?.type;
    const path = payload?.path || payload?.url || (req.nextUrl && req.nextUrl.pathname) || null;
    const referrer = payload?.referrer || req.headers.get('referer') || null;
    const user_agent = payload?.user_agent || req.headers.get('user-agent') || null;
    const session_id = payload?.session_id || payload?.session || crypto.randomUUID();

    const geo = guessGeoFromRequest(req);

    // Insert page event
    await supabase.from('page_events').insert({
      session_id,
      event_type,
      path,
      referrer,
      user_agent,
      country: geo.country,
      city: geo.city,
    });

    // Upsert active session
    await supabase.from('active_sessions').upsert({
      session_id,
      last_seen: new Date().toISOString(),
      country: geo.country,
      city: geo.city,
    }, { onConflict: 'session_id' });

    return new Response(JSON.stringify({ ok: true, session_id }), { status: 200 });
  } catch (e: any) {
    console.error('track error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 500 });
  }
}
