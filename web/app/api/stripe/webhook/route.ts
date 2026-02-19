import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('stripe webhook signature invalid', err);
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        await supabaseAdmin.from('payments').update({ status: 'captured', amount_captured_pence: Math.round(pi.amount_received || 0) }).eq('stripe_payment_intent_id', pi.id);
        // mark cart as paid if metadata contains cart_id
        const cartId = pi.metadata?.cart_id || null;
        if (cartId) await supabaseAdmin.from('carts').update({ status: 'paid' }).eq('id', cartId);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi2 = event.data.object as any;
        await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('stripe_payment_intent_id', pi2.id);
        const cartId = pi2.metadata?.cart_id || null;
        if (cartId) await supabaseAdmin.from('carts').update({ status: 'failed' }).eq('id', cartId);
        break;
      }
      case 'payment_intent.canceled': {
        const pi3 = event.data.object as any;
        await supabaseAdmin.from('payments').update({ status: 'canceled' }).eq('stripe_payment_intent_id', pi3.id);
        const cartId = pi3.metadata?.cart_id || null;
        if (cartId) await supabaseAdmin.from('carts').update({ status: 'denied' }).eq('id', cartId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('processing webhook failed', e);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
