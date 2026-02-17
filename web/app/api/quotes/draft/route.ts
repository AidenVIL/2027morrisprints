import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { estimateWithPrusa } from '../../../../lib/prusaEstimator';

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

    // Run estimator server-side to ensure canonical estimate
    const est = await estimateWithPrusa(path, settings?.materialProfile);
    const grams = est.grams;
    const timeSeconds = est.timeSeconds;

    // reserve inventory via RPC
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: inventory_item_id, p_grams: grams, p_quote_id: quoteId });

    // insert or upsert a draft quote with status UNCONFIRMED
    await supabaseAdmin.from('quote_requests').upsert({
      id: quoteId,
      user_id: user.id,
      status: 'UNCONFIRMED',
      file_path: path,
      file_original_name: originalName,
      file_mime: mime,
      file_size: size,
      settings: settings,
      post_processing: {},
      quantity: settings?.quantity || 1,
      inventory_item_id: inventory_item_id,
      estimated_grams: grams,
      estimated_print_time_seconds: timeSeconds,
      reserved_grams: grams,
      estimated_price_pence: body.estimated_price_pence || null
    }, { onConflict: 'id' });

    return NextResponse.json({ ok: true, quoteId, estimated: { grams, timeSeconds } });
  } catch (e) {
    console.error('quote draft error', e);
    try {
      const est = await estimateWithPrusa(path, settings?.materialProfile).catch(() => null);
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
