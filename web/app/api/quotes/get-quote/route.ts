import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { estimateWithPrusa } from '../../../../lib/prusaEstimator';

const MACHINE_HOURLY_RATE_PENCE = Number(process.env.MACHINE_HOURLY_RATE_PENCE || 0);
const ELECTRICITY_RATE_PENCE_PER_HOUR = Number(process.env.ELECTRICITY_RATE_PENCE_PER_HOUR || 0);
const MARKUP_PERCENTAGE = Number(process.env.MARKUP_PERCENTAGE || 0);

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { inventory_item_id, settings, quantity, storagePath, filePath, originalName } = body;

  // get user from token
  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    const path = storagePath || filePath;
    if (!path) return NextResponse.json({ error: 'missing file path' }, { status: 400 });

    // Ensure file exists in storage
    const { data: fileData, error: fileErr } = await supabaseAdmin.storage.from('models').list(path.includes('/') ? path.split('/').slice(0, -1).join('/') : path);
    // We won't treat list failure as fatal here; rely on estimator's download check

    // Run estimator (downloads file internally)
    const est = await estimateWithPrusa(path, settings?.materialProfile);
    const grams = est.grams;
    const timeSeconds = est.timeSeconds;

    // compute price (same logic as other endpoints)
    const { data: itemData } = await supabaseAdmin.from('inventory_items').select('*').eq('id', inventory_item_id).single();
    const materialCostPerGram = (itemData?.cost_per_kg_pence || 0) / 1000;
    const hours = timeSeconds / 3600;
    const price = Math.round(materialCostPerGram * grams + MACHINE_HOURLY_RATE_PENCE * hours + ELECTRICITY_RATE_PENCE_PER_HOUR * hours);
    const finalPrice = Math.round(price * (1 + MARKUP_PERCENTAGE / 100));

    const quoteId = crypto.randomUUID();

    // reserve inventory
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: inventory_item_id, p_grams: grams, p_quote_id: quoteId });

    // insert draft row with UNCONFIRMED
    await supabaseAdmin.from('quote_requests').insert({
      id: quoteId,
      user_id: user.id,
      status: 'UNCONFIRMED',
      file_path: path,
      file_original_name: originalName || path.split('/').slice(-1)[0],
      settings: settings,
      quantity: quantity || settings?.quantity || 1,
      inventory_item_id,
      estimated_grams: grams,
      estimated_print_time_seconds: timeSeconds,
      reserved_grams: grams,
      estimated_price_pence: finalPrice
    });

    return NextResponse.json({ ok: true, quoteId, estimated: { grams, timeSeconds, price: finalPrice } });
  } catch (e) {
    console.error('get-quote error', e);
    try {
      if (inventory_item_id) {
        const est = await estimateWithPrusa(storagePath || filePath, settings?.materialProfile).catch(() => null);
        const grams = est?.grams || 0;
        if (grams > 0) await supabaseAdmin.rpc('release_inventory', { p_item_id: inventory_item_id, p_grams: grams, p_quote_id: (body as any).quoteId || null });
      }
    } catch (e2) { console.error('release failed', e2) }
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
