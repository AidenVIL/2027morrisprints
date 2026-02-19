import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { stripe } from '../../../../lib/stripe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cartId, customer = null, delivery = null, billing = null } = body;

    // if cartId not provided, try to resolve by session header or authenticated user
    let resolvedCartId = cartId || null;
    if (!resolvedCartId) {
      const sessionId = req.headers.get('x-session-id') || null;
      if (sessionId) {
        const { data: cart } = await supabaseAdmin.from('carts').select('id').eq('session_id', sessionId).eq('status', 'open').order('created_at', { ascending: false }).limit(1).maybeSingle();
        resolvedCartId = cart?.id || null;
      }
    }

    if (!resolvedCartId) return NextResponse.json({ error: 'missing cartId or session' }, { status: 400 });

    // load cart items with joined quotes
    const { data: items } = await supabaseAdmin
      .from('cart_items')
      .select('qty, quotes(*)')
      .eq('cart_id', resolvedCartId);

    if (!items || items.length === 0) return NextResponse.json({ error: 'cart empty' }, { status: 400 });

    // compute total in pence
    let total = 0;
    for (const it of items) {
      const qty = it.qty || 1;
      const quote = it.quotes || it.quote || {};
      const price = Number(quote.price_total_pence || quote.price_total_pence || 0) || 0;
      total += qty * price;
    }

    if (total <= 0) return NextResponse.json({ error: 'cart total is zero' }, { status: 400 });

    const pi = await stripe.paymentIntents.create({
      amount: total,
      currency: 'gbp',
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      metadata: { cart_id: cartId }
    });

    // store payment_intent on cart
    await supabaseAdmin.from('carts').update({
      stripe_payment_intent_id: pi.id,
      checkout_details: { customer, delivery, billing },
      amount_authorised_pence: pi.amount || total,
      status: 'checked_out'
    }).eq('id', resolvedCartId);

    // insert a payments row so webhook updates can find it
    await supabaseAdmin.from('payments').insert({
      cart_id: resolvedCartId,
      stripe_payment_intent_id: pi.id,
      amount_authorised_pence: pi.amount || total,
      currency: pi.currency,
      status: 'requires_capture'
    }).catch(()=>null);

    return NextResponse.json({ ok: true, clientSecret: pi.client_secret, payment_intent_id: pi.id, cartId: resolvedCartId });
  } catch (e) {
    console.error('create-intent error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
