import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseClient'
import { estimateWithPrusa } from '../../../lib/prusaEstimator'

export async function POST(req: Request) {
  const body = await req.json()
  const { path, inventory_item_id } = body
  if (!path || !inventory_item_id) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  try {
    const { data: itemData, error: itemError } = await supabaseAdmin.from('inventory_items').select('*').eq('id', inventory_item_id).single()
    if (itemError || !itemData) return NextResponse.json({ error: 'invalid inventory item' }, { status: 400 })

    let est;
    try {
      est = await estimateWithPrusa(path);
    } catch (err) {
      console.error('estimator threw', err);
      // If estimator threw a structured parse error, surface it to caller
      if (err instanceof Error && typeof err.message === 'string' && err.message.startsWith('ESTIMATE_PARSE_ERROR:')) {
        try {
          const json = JSON.parse(err.message.replace('ESTIMATE_PARSE_ERROR:', ''));
          return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: json }, { status: 500 });
        } catch (_) {
          return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: String(err) }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: String(err) }, { status: 500 });
    }

    const grams = Number(est.grams);
    const timeSeconds = Number(est.timeSeconds);

    if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      const debug = { cmd: (est as any)?.cmd ?? null, gcodeHeaderSnippet: (est as any)?.gcodeHeaderSnippet ?? null };
      return NextResponse.json({ ok: false, error: 'ESTIMATE_FAILED', details: { grams: est.grams, timeSeconds: est.timeSeconds, debug } }, { status: 500 });
    }

    const MACHINE_HOURLY_RATE_PENCE = Number(process.env.MACHINE_HOURLY_RATE_PENCE || 0)
    const ELECTRICITY_RATE_PENCE_PER_HOUR = Number(process.env.ELECTRICITY_RATE_PENCE_PER_HOUR || 0)
    const MARKUP_PERCENTAGE = Number(process.env.MARKUP_PERCENTAGE || 0)

    const materialCostPerGram = (itemData.cost_per_kg_pence || 0) / 1000
    const safeTimeSeconds = Number(timeSeconds ?? 0)
    const hours = safeTimeSeconds / 3600
    const safeGrams = Number(grams ?? 0)
    const price = Math.round(materialCostPerGram * safeGrams + MACHINE_HOURLY_RATE_PENCE * hours + ELECTRICITY_RATE_PENCE_PER_HOUR * hours)
    const finalPrice = Math.round(price * (1 + MARKUP_PERCENTAGE / 100))

    return NextResponse.json({ ok: true, grams, timeSeconds, price: finalPrice })
  } catch (e) {
    console.error('estimate error', e)
    return NextResponse.json({ error: 'estimate failed', details: String(e) }, { status: 500 })
  }
}
