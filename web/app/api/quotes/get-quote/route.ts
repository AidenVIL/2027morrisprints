import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseClient'
import { analyzeStl } from '../../../lib/geometry/stl'
import { estimateMass } from '../../../lib/estimator/mass'
import { estimateTime } from '../../../lib/estimator/time'
import { estimatePricing } from '../../../lib/pricing/pricing'

const PRESET_MAP: Record<string, number> = { draft: 0.28, standard: 0.2, fine: 0.16, ultra: 0.12 }

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const body = await req.json()
  const { inventory_item_id, layerPreset, infillPercent, supports, quantity, storagePath, filePath, originalName } = body

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string)
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  try {
    const path = storagePath || filePath
    if (!path) return NextResponse.json({ error: 'missing file path' }, { status: 400 })

    // download file from storage
    const { data: downloadData, error: downloadErr } = await supabaseAdmin.storage.from('models').download(path)
    if (downloadErr || !downloadData) return NextResponse.json({ error: 'failed to download file', details: String(downloadErr?.message || downloadErr) }, { status: 400 })
    const arr = await downloadData.arrayBuffer()
    const buf = Buffer.from(arr)

    const ext = (path.split('.').slice(-1)[0] || '').toLowerCase()
    if (ext !== 'stl') return NextResponse.json({ error: 'Only STL supported for now' }, { status: 400 })

    // analyze STL geometry
    const geom = analyzeStl(buf)

    // fetch inventory item and app settings
    const { data: itemData, error: itemErr } = await supabaseAdmin.from('inventory_items').select('id, cost_per_kg_gbp, density_g_per_cm3, support_multiplier, grams_available').eq('id', inventory_item_id).single()
    if (itemErr || !itemData) return NextResponse.json({ error: 'inventory_item_not_found' }, { status: 400 })

    const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*').limit(1).maybeSingle()

    // map preset -> layerHeight
    const layerHeightMm = PRESET_MAP[String(layerPreset || 'standard')] || 0.2

    // prepare estimator inputs
    const massSettings = {
      layerHeightMm,
      infillPercent: Number(infillPercent ?? 0),
      supports: Boolean(supports),
      density_g_per_cm3: Number(itemData.density_g_per_cm3 ?? 1.24),
      perimeters: 3,
      extrusionWidthMm: 0.45,
      topBottomLayers: 5,
      supportMultiplier: Number(itemData.support_multiplier ?? 1.18),
    }

    const mass = estimateMass({ volume_mm3: geom.volume_mm3, area_mm2: geom.area_mm2, bbox: geom.bbox }, massSettings)

    const time = estimateTime({ area_mm2: geom.area_mm2, bbox: { size: { z: geom.bbox.size.z } } }, { V_print_mm3: mass.V_print_mm3, layerHeightMm, supports: Boolean(supports), preset: String(layerPreset || 'standard') as any })

    const material = {
      cost_per_kg_gbp: Number(itemData.cost_per_kg_gbp ?? 0),
      density_g_per_cm3: Number(itemData.density_g_per_cm3 ?? 1.24),
      support_multiplier: Number(itemData.support_multiplier ?? 1.18),
    }

    const pricingSettings = {
      machine_rate_per_hour_gbp: Number(settingsData?.machine_rate_per_hour_gbp ?? 0.3),
      electricity_price_per_kwh_gbp: Number(settingsData?.electricity_price_per_kwh_gbp ?? 0),
      printer_avg_watts: Number(settingsData?.printer_avg_watts ?? 120),
      electricity_markup: Number(settingsData?.electricity_markup ?? 1.1),
      material_markup: Number(settingsData?.material_markup ?? 1.5),
      labour_fee_gbp: Number(settingsData?.labour_fee_gbp ?? 1.0),
      min_order_fee_gbp: Number(settingsData?.min_order_fee_gbp ?? 0),
      supports_fee_gbp: Number(settingsData?.supports_fee_gbp ?? 0),
      small_part_fee_threshold_g: Number(settingsData?.small_part_fee_threshold_g ?? 15),
      small_part_fee_gbp: Number(settingsData?.small_part_fee_gbp ?? 0.5),
    }

    const pricing = estimatePricing(mass.grams, time.timeSeconds, material, pricingSettings)

    // reserve inventory
    const quoteId = crypto.randomUUID()
    const qty = Number(quantity ?? 1)
    await supabaseAdmin.rpc('reserve_inventory', { p_item_id: inventory_item_id, p_grams: Math.ceil(mass.grams * qty), p_quote_id: quoteId })

    // insert draft row
    await supabaseAdmin.from('quote_requests').insert({
      id: quoteId,
      user_id: user.id,
      status: 'UNCONFIRMED',
      file_path: path,
      file_original_name: originalName || path.split('/').slice(-1)[0],
      settings: massSettings,
      quantity: qty,
      inventory_item_id,
      estimated_grams: Math.ceil(mass.grams * qty),
      estimated_print_time_seconds: Math.ceil(time.timeSeconds * qty),
      reserved_grams: Math.ceil(mass.grams * qty),
      estimated_price_pence: Math.round(pricing.final * 100),
    })

    return NextResponse.json({ ok: true, grams: mass.grams, timeSeconds: time.timeSeconds, breakdown: pricing, geometry: { volume_mm3: geom.volume_mm3, area_mm2: geom.area_mm2, bbox: geom.bbox } })
  } catch (e) {
    console.error('get-quote error', e)
    return NextResponse.json({ ok: false, error: 'failed', details: String(e) }, { status: 500 })
  }
}
