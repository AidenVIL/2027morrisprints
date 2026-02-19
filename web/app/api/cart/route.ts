import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

  // support guest carts via x-session-id header
  const sessionId = req.headers.get('x-session-id') || null;

  let userId: string | null = null;
  try {
    if (token) {
      const { data: ud } = await supabaseAdmin.auth.getUser(token as string);
      userId = ud?.data?.user?.id || null;
    }
  } catch (e) {
    console.warn('cart get: failed to resolve user', e);
  }

  try {
    let cartQuery = supabaseAdmin.from('carts').select('id').order('created_at', { ascending: false }).eq('status', 'open');
    if (userId) cartQuery = cartQuery.eq('customer_id', userId);
    else if (sessionId) cartQuery = cartQuery.eq('session_id', sessionId);
    else return NextResponse.json({ ok: true, items: [] });

    const { data: carts } = await cartQuery.limit(1).maybeSingle();
    const cartId = carts?.id;
    if (!cartId) return NextResponse.json({ ok: true, items: [] });

    const { data: items } = await supabaseAdmin
      .from('cart_items')
      .select('id,qty,created_at,quotes(*)')
      .eq('cart_id', cartId);

    return NextResponse.json({ ok: true, cart: { id: cartId, items: items || [] } });
  } catch (e) {
    console.error('cart fetch error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
