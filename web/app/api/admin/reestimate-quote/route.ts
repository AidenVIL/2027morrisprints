import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { supabaseAdmin } from '../../../../lib/supabaseClient'
import runEstimation from '../../../../lib/estimator/runEstimation'

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

    const { data: quote } = await supabaseAdmin.from('quote_requests').select('*').eq('id', id).single()
    if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 })

    const storagePath = quote.file_path
    if (!storagePath) return NextResponse.json({ error: 'missing file path on quote' }, { status: 400 })

    const opts = (quote.settings ?? {}) as any
    const res = await runEstimation(storagePath, quote.inventory_item_id, { layerPreset: opts.layerPreset, infillPercent: opts.infillPercent, supports: opts.supports })

    const qty = Number(quote.quantity ?? 1)
    const gramsTotal = Math.ceil(res.grams * qty)
    const timeTotal = Math.ceil(res.timeSeconds * qty)
    const pricePence = Math.round(res.pricing.final * 100)

    // reserve inventory
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: quote.inventory_item_id, p_grams: gramsTotal, p_quote_id: quote.id })

    // update quote
    await supabaseAdmin.from('quote_requests').update({
      estimated_grams: gramsTotal,
      estimated_print_time_seconds: timeTotal,
      reserved_grams: gramsTotal,
      estimated_price_pence: pricePence,
      last_estimation_at: new Date().toISOString(),
    }).eq('id', quote.id)

    return NextResponse.json({ ok: true, grams: res.grams, timeSeconds: res.timeSeconds, breakdown: res.pricing, geometry: res.geometry })
  } catch (e) {
    console.error('reestimate error', e)
    return NextResponse.json({ ok: false, error: 'failed', details: String(e) }, { status: 500 })
  }
}
