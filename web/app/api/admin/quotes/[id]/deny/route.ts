import { NextResponse } from 'next/server';
import { stripe } from '../../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../../lib/adminAuth';

export async function POST(req: Request, context: any) {
  const resolvedParams = typeof context?.params?.then === 'function' ? await context.params : context?.params;
  const id = resolvedParams?.id ?? context?.params?.id;

  const body = await req.json();
  const reason = body.reason || null;

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const profile = auth.profile;

  const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('quote_request_id', id).limit(1).single();
  if (!payment) return NextResponse.json({ error: 'payment not found' }, { status: 404 });

  try {
    const canceled = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id as string);
    await supabaseAdmin.from('payments').update({ status: 'canceled' }).eq('stripe_payment_intent_id', payment.stripe_payment_intent_id);
    await supabaseAdmin.from('quote_requests').update({ status: 'denied' }).eq('id', id);
    await supabaseAdmin.from('quote_decisions').insert({ quote_request_id: id, admin_id: profile?.id ?? null, final_amount_pence: 0, breakdown: {}, decision_notes: reason });
    return NextResponse.json({ ok: true, canceled });
  } catch (e) {
    return NextResponse.json({ error: 'cancel failed', details: String(e) }, { status: 500 });
  }
}
