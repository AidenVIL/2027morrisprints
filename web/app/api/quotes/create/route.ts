import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { stripe } from '../../../../lib/stripe';
import { runEstimation } from '../../../../lib/estimator/runEstimation';

const MACHINE_HOURLY_RATE_PENCE = Number(process.env.MACHINE_HOURLY_RATE_PENCE || 0);
const ELECTRICITY_RATE_PENCE_PER_HOUR = Number(process.env.ELECTRICITY_RATE_PENCE_PER_HOUR || 0);
const MARKUP_PERCENTAGE = Number(process.env.MARKUP_PERCENTAGE || 0);

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { quoteId, path, originalName, mime, size, settings, inventory_item_id } = body;

  // get user from token
  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    // Validate inventory item
    const { data: itemData, error: itemError } = await supabaseAdmin.from('inventory_items').select('*').eq('id', inventory_item_id).single();
    if (itemError || !itemData) return NextResponse.json({ error: 'invalid inventory item' }, { status: 400 });

    // Run estimator (server-side)
    const est = await runEstimation(path, inventory_item_id, { layerPreset: settings?.layerPreset, infillPercent: settings?.infillPercent, supports: settings?.supports });
    const grams = Number(est.grams)
    const timeSeconds = Number(est.timeSeconds)
    const finalPrice = Math.round((est.pricing?.final ?? 0) * 100)

    const safeGrams = Math.ceil(Math.max(0, grams || 0))
    const safeTimeSeconds = Math.ceil(Math.max(0, timeSeconds || 0))

    // reserve inventory via RPC
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: inventory_item_id, p_grams: safeGrams, p_quote_id: quoteId });

    // Create PaymentIntent with manual capture
    const pi = await stripe.paymentIntents.create({
      amount: finalPrice,
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
      quantity: settings.quantity || 1,
      inventory_item_id: inventory_item_id,
      estimated_grams: safeGrams,
      estimated_print_time_seconds: safeTimeSeconds,
      reserved_grams: safeGrams,
      estimated_price_pence: finalPrice
    });

    await supabaseAdmin.from('payments').insert({
      quote_request_id: quoteId,
      stripe_payment_intent_id: pi.id,
      amount_authorised_pence: (pi.amount as number) || finalPrice,
      currency: pi.currency,
      status: 'requires_capture'
    });

    return NextResponse.json({ ok: true, client_secret: pi.client_secret, payment_intent_id: pi.id, estimated: { grams: safeGrams, timeSeconds: safeTimeSeconds, price: finalPrice } });
  } catch (e) {
    console.error('quote create error', e);
    // attempt to release reservation if something went wrong and quoteId/inventory provided
    try {
      const { inventory_item_id } = body as any;
      const est = await runEstimation(path, inventory_item_id, { layerPreset: (body as any).settings?.layerPreset, infillPercent: (body as any).settings?.infillPercent, supports: (body as any).settings?.supports }).catch(() => null as any);
      const grams = est?.grams || 0;
      if (inventory_item_id && grams > 0) {
        await supabaseAdmin.rpc('release_inventory', { p_item_id: inventory_item_id, p_grams: grams, p_quote_id: quoteId });
      }
    } catch (e2) {
      console.error('failed releasing after error', e2);
    }
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
