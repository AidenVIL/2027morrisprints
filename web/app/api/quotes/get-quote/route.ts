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
  const { inventory_item_id, material, layerHeightMm, infillPercent, supports, quantity, storagePath, filePath, originalName, nozzleMm, filamentDiameterMm } = body;

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

    // Run estimator (downloads file internally). Pass user settings to Prusa overrides.
    const settingsObj = {
      material: material || undefined,
      layerHeightMm: layerHeightMm || undefined,
      infillPercent: infillPercent || undefined,
      supports: supports || undefined,
      nozzleMm: nozzleMm || undefined,
      filamentDiameterMm: filamentDiameterMm || undefined,
    };
    const est = await estimateWithPrusa(path, settingsObj);
    const grams = Number(est.grams);
    const timeSeconds = Number(est.timeSeconds);

    // validate estimator output
    if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      const debug = { cmd: (est as any).cmd ?? null, gcodeHeaderSnippet: (est as any).gcodeHeaderSnippet ?? null, usedProfileName: (est as any).usedProfileName ?? null };
      return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: { grams: est.grams, timeSeconds: est.timeSeconds, debug } }, { status: 500 });
    }

    // compute price (same logic as other endpoints)
    const { data: itemData } = await supabaseAdmin.from('inventory_items').select('*').eq('id', inventory_item_id).single();
    const materialCostPerGram = (itemData?.cost_per_kg_pence || 0) / 1000;
    const hours = timeSeconds / 3600;
    const price = Math.round(materialCostPerGram * grams + MACHINE_HOURLY_RATE_PENCE * hours + ELECTRICITY_RATE_PENCE_PER_HOUR * hours);
    const finalPrice = Math.round(price * (1 + MARKUP_PERCENTAGE / 100));

    const quoteId = crypto.randomUUID();
    const qty = Number(quantity ?? 1);

    // reserve inventory
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: inventory_item_id, p_grams: grams, p_quote_id: quoteId });

    // insert draft row with UNCONFIRMED
    await supabaseAdmin.from('quote_requests').insert({
      id: quoteId,
      user_id: user.id,
      status: 'UNCONFIRMED',
      file_path: path,
      file_original_name: originalName || path.split('/').slice(-1)[0],
      settings: settingsObj,
      quantity: qty,
      inventory_item_id,
      estimated_grams: grams,
      estimated_print_time_seconds: timeSeconds,
      reserved_grams: grams,
      estimated_price_pence: finalPrice
    });

    const debugInfo: any = {};
    if ((est as any).cmd) debugInfo.cmd = (est as any).cmd;
    if ((est as any).gcodeHeaderSnippet) debugInfo.gcodeHeaderSnippet = (est as any).gcodeHeaderSnippet;
    if ((est as any).usedProfileName) debugInfo.usedProfileName = (est as any).usedProfileName;

    return NextResponse.json({ ok: true, quoteId, estimated: { grams, timeSeconds, price: finalPrice }, debug: debugInfo });
  } catch (e) {
    console.error('get-quote error', e);
    // If estimator threw a structured parse error, return ESTIMATE_FAILED with details
    if (e instanceof Error && typeof e.message === 'string' && e.message.startsWith('ESTIMATE_PARSE_ERROR:')) {
      try {
        const json = JSON.parse(e.message.replace('ESTIMATE_PARSE_ERROR:',''));
        return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: json }, { status: 500 });
      } catch (parseErr) {
        // fallthrough to generic error
      }
    }

    try {
      if (inventory_item_id) {
        const est = await estimateWithPrusa(storagePath || filePath, {
          material: material,
          layerHeightMm: layerHeightMm,
          infillPercent: infillPercent,
          supports: supports,
          nozzleMm: nozzleMm,
          filamentDiameterMm: filamentDiameterMm,
        }).catch(() => null);
        const releasedGrams = Number(est?.grams || 0);
        if (releasedGrams > 0) await supabaseAdmin.rpc('release_inventory', { p_item_id: inventory_item_id, p_grams: releasedGrams, p_quote_id: (body as any).quoteId || null });
      }
    } catch (e2) { console.error('release failed', e2) }
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
