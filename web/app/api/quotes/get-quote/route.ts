import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseClient'
import { analyzeStl } from '../../../../lib/geometry/stl'
import { estimateMass } from '../../../../lib/estimator/mass'
import { estimateTime } from '../../../../lib/estimator/time'
import { estimatePricing } from '../../../../lib/pricing/pricing'

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

    // Log which Supabase host we're using (hostname only, don't log keys)
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      if (supabaseUrl) {
        try { console.info('Supabase host:', new URL(supabaseUrl).hostname) } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore logging errors */ }

    // download file from storage
    const { data: downloadData, error: downloadErr } = await supabaseAdmin.storage.from('models').download(path)
    if (downloadErr || !downloadData) return NextResponse.json({ error: 'failed to download file', details: String(downloadErr?.message || downloadErr) }, { status: 400 })
    const arr = await downloadData.arrayBuffer()
    const buf = Buffer.from(arr)

    const ext = (path.split('.').slice(-1)[0] || '').toLowerCase()
    if (ext !== 'stl') return NextResponse.json({ error: 'Only STL supported for now' }, { status: 400 })

    // analyze STL geometry
    const geom = analyzeStl(buf)

    // fetch inventory item strictly by primary key
    const norm = (s: any) => (typeof s === 'string' ? s.trim().toLowerCase() : '')
    let itemData: any = null
    try {
      // select all columns to avoid errors when optional columns are missing in older schemas
      const r = await supabaseAdmin
        .from('inventory_items')
        .select('*')
        .eq('id', inventory_item_id)
        .maybeSingle()
      itemData = r.data
      if (r.error) {
        console.error('inventory lookup error', r.error)
        return NextResponse.json({ error: 'inventory_lookup_error', details: String(r.error?.message || r.error) }, { status: 500 })
      }
    } catch (e) {
      console.error('inventory lookup exception', e)
      return NextResponse.json({ error: 'inventory_lookup_error', details: String(e) }, { status: 500 })
    }

    if (!itemData) {
      // gather debug info: total count + sample rows
      let total: number | null = null
      let sample: any[] = []
      try {
        const countRes = await supabaseAdmin.from('inventory_items').select('id', { count: 'exact', head: true })
        total = typeof countRes.count === 'number' ? countRes.count : null
      } catch (e) {
        console.error('inventory count query failed', e)
      }
      try {
        const sampleRes = await supabaseAdmin.from('inventory_items').select('id, material, colour').limit(5)
        sample = sampleRes.data || []
      } catch (e) {
        console.error('inventory sample query failed', e)
      }

      console.error('inventory_item_not_found', { providedInventoryItemId: inventory_item_id, providedMaterial: body?.material || null, total, sampleCount: sample.length })
      return NextResponse.json({ error: 'inventory_item_not_found', providedInventoryItemId: inventory_item_id, providedMaterial: body?.material || null, inventoryDebug: { total, sample, providedMaterialNorm: norm(body?.material), itemMaterialNorm: null } }, { status: 400 })
    }

    // normalise and compare material names; if mismatch return explicit error
    const providedMaterialNorm = norm(body?.material)
    const itemMaterialNorm = norm(itemData?.material)
    if (providedMaterialNorm && itemMaterialNorm && providedMaterialNorm !== itemMaterialNorm) {
      console.error('material_mismatch', { provided: body?.material, item: itemData?.material, providedMaterialNorm, itemMaterialNorm })
      return NextResponse.json({ error: 'material_mismatch', providedMaterial: body?.material || null, itemMaterial: itemData?.material || null, inventoryDebug: { providedMaterialNorm, itemMaterialNorm } }, { status: 400 })
    }

    // normalize numeric material properties with fallbacks for older schemas
    const density_g_per_cm3 = Number(itemData?.density_g_per_cm3 ?? itemData?.density_g_cm3 ?? itemData?.density ?? 1.24)
    const support_multiplier = Number(itemData?.support_multiplier ?? itemData?.supportMultiplier ?? itemData?.support_factor ?? 1.18)

    // prefer pence integer storage; derive GBP for compatibility
    const costPerKgPence = Number(itemData?.cost_per_kg_pence ?? Math.round((Number(itemData?.cost_per_kg_gbp ?? itemData?.cost_per_kg ?? itemData?.price_per_kg ?? 0) * 100)))
    const cost_per_kg_gbp = costPerKgPence / 100

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
      cost_per_kg_pence: costPerKgPence,
      cost_per_kg_gbp: cost_per_kg_gbp,
      density_g_per_cm3: density_g_per_cm3,
      support_multiplier: support_multiplier,
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

    const pricing = estimatePricing(mass.grams, time.timeSeconds, { cost_per_kg_gbp: material.cost_per_kg_gbp, density_g_per_cm3: material.density_g_per_cm3, support_multiplier: material.support_multiplier }, pricingSettings)

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

    const estimated = {
      grams: mass.grams,
      timeSeconds: time.timeSeconds,
      // price in pence for client consumption
      price_pence: Math.round((pricing?.final ?? 0) * 100),
      // material cost in pence (raw): grams (g) -> kg factor
      material_cost_pence: Math.round((mass.grams / 1000) * costPerKgPence),
    };

    // return the draft quote id so the client can reference the UNCONFIRMED draft
    return NextResponse.json({ ok: true, quoteDraftId: quoteId, estimated, breakdown: pricing, material, geometry: { volume_mm3: geom.volume_mm3, area_mm2: geom.area_mm2, bbox: geom.bbox } })
  } catch (e) {
    console.error('get-quote error', e)
    return NextResponse.json({ ok: false, error: 'failed', details: String(e) }, { status: 500 })
  }
}
