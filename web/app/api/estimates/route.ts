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

    const est = await estimateWithPrusa(path)
    const grams = est.grams
    const timeSeconds = est.timeSeconds

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
