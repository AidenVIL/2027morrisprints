import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  // Handle events
  switch (event.type) {
    case 'payment_intent.amount_capturable_updated':
      // update payment status in DB
      break;
    case 'payment_intent.succeeded':
      // mark payment captured
      const pi = event.data.object;
      await supabaseAdmin.from('payments').update({ status: 'captured', amount_captured_pence: Math.round((pi.amount_received || 0)) }).eq('stripe_payment_intent_id', pi.id);
      await supabaseAdmin.from('quote_requests').update({ status: 'paid' }).eq('id', (pi.metadata && pi.metadata.quote_id) || null);
      break;
    case 'payment_intent.canceled':
      const pi2 = event.data.object;
      await supabaseAdmin.from('payments').update({ status: 'canceled' }).eq('stripe_payment_intent_id', pi2.id);
      await supabaseAdmin.from('quote_requests').update({ status: 'denied' }).eq('id', (pi2.metadata && pi2.metadata.quote_id) || null);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
