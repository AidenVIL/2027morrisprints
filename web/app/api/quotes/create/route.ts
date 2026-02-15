import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { stripe } from '../../../../lib/stripe';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { quoteId, path, originalName, mime, size, settings } = body;

  // get user from token
  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  // Determine hold amount: use HOLD_AMOUNT_PENCE env or compute a small deposit
  const hold = Number(process.env.HOLD_AMOUNT_PENCE || 1000);

  try {
    // Create PaymentIntent with manual capture
    const pi = await stripe.paymentIntents.create({
      amount: hold,
      currency: 'gbp',
      capture_method: 'manual',
      metadata: { quote_id: quoteId, user_id: user.id }
    });

    // store quote and payment (set user_id from token)
    await supabaseAdmin.from('quote_requests').insert({
      id: quoteId,
      user_id: user.id,
      status: 'pending_review',
      file_path: path,
      file_original_name: originalName,
      file_mime: mime,
      file_size: size,
      settings: settings,
      post_processing: {},
      quantity: settings.quantity || 1
    });

    await supabaseAdmin.from('payments').insert({
      quote_request_id: quoteId,
      stripe_payment_intent_id: pi.id,
      amount_authorised_pence: (pi.amount as number) || hold,
      currency: pi.currency,
      status: 'requires_capture'
    });

    return NextResponse.json({ ok: true, client_secret: pi.client_secret, payment_intent_id: pi.id });
  } catch (e) {
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
