import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { quoteId, payment_intent_id } = body;

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    // verify payment row exists
    const { data: pay } = await supabaseAdmin.from('payments').select('*').eq('stripe_payment_intent_id', payment_intent_id).single();
    if (!pay) return NextResponse.json({ error: 'payment not found' }, { status: 404 });

    // update quote status to PENDING
    await supabaseAdmin.from('quote_requests').update({ status: 'PENDING' }).eq('id', quoteId);

    // update payments status
    await supabaseAdmin.from('payments').update({ status: 'authorized' }).eq('stripe_payment_intent_id', payment_intent_id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('confirm checkout error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
