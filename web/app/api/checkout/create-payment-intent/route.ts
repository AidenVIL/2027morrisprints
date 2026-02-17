import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { stripe } from '../../../../lib/stripe';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { quoteId } = body;

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    const { data: quote } = await supabaseAdmin.from('quote_requests').select('*').eq('id', quoteId).single();
    if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 });
    if (quote.status !== 'UNCONFIRMED') return NextResponse.json({ error: 'quote not in UNCONFIRMED state' }, { status: 400 });

    const amount = quote.estimated_price_pence || 0;

    const pi = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'gbp',
      capture_method: 'manual',
      metadata: { quote_id: quoteId, user_id: user.id }
    });

    // insert payment record
    await supabaseAdmin.from('payments').insert({
      quote_request_id: quoteId,
      stripe_payment_intent_id: pi.id,
      amount_authorised_pence: pi.amount || amount,
      currency: pi.currency,
      status: 'requires_capture'
    });

    return NextResponse.json({ ok: true, client_secret: pi.client_secret, payment_intent_id: pi.id });
  } catch (e) {
    console.error('create payment intent error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
