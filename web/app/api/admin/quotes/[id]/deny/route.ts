import { NextResponse } from 'next/server';
import { stripe } from '../../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';

export async function POST(req: Request, context: any) {
  const resolvedParams = typeof context?.params?.then === 'function' ? await context.params : context?.params;
  const id = resolvedParams?.id ?? context?.params?.id;
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const reason = body.reason || null;

  // verify admin
  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single().catch(() => ({ data: null }));
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('quote_request_id', id).limit(1).single();
  if (!payment) return NextResponse.json({ error: 'payment not found' }, { status: 404 });

  try {
    const canceled = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id as string);
    await supabaseAdmin.from('payments').update({ status: 'canceled' }).eq('stripe_payment_intent_id', payment.stripe_payment_intent_id);
    await supabaseAdmin.from('quote_requests').update({ status: 'denied' }).eq('id', id);
    await supabaseAdmin.from('quote_decisions').insert({ quote_request_id: id, admin_id: profile.id, final_amount_pence: 0, breakdown: {}, decision_notes: reason });
    return NextResponse.json({ ok: true, canceled });
  } catch (e) {
    return NextResponse.json({ error: 'cancel failed', details: String(e) }, { status: 500 });
  }
}
