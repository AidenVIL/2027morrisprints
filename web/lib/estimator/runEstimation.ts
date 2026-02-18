import { supabaseAdmin } from '../../lib/supabaseClient'
import { analyzeStl } from '../../lib/geometry/stl'
import { estimateMass } from './mass'
import { estimateTime } from './time'
import { estimatePricing } from '../../lib/pricing/pricing'

export type RunEstimationResult = {
  grams: number
  timeSeconds: number
  pricing: any
  geometry: { volume_mm3: number; area_mm2: number; bbox: any }
}

export async function runEstimation(storagePath: string, inventory_item_id: string | null, opts?: { layerPreset?: string; infillPercent?: number; supports?: boolean }) {
  if (!storagePath) throw new Error('missing storagePath')

  const { data: downloadData, error: downloadErr } = await supabaseAdmin.storage.from('models').download(storagePath)
  if (downloadErr || !downloadData) throw new Error('failed to download file: ' + String(downloadErr?.message || downloadErr))
  const arr = await downloadData.arrayBuffer()
  const buf = Buffer.from(arr)

  const ext = (storagePath.split('.').slice(-1)[0] || '').toLowerCase()
  if (ext !== 'stl') throw new Error('Only STL supported for now')

  const geom = analyzeStl(buf)

  const { data: itemData, error: itemErr } = await supabaseAdmin.from('inventory_items').select('id, cost_per_kg_gbp, density_g_per_cm3, support_multiplier, grams_available').eq('id', inventory_item_id).single()
  if (itemErr || !itemData) throw new Error('inventory_item_not_found')

  const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*').limit(1).maybeSingle()

  const PRESET_MAP: Record<string, number> = { draft: 0.28, standard: 0.2, fine: 0.16, ultra: 0.12 }
  const layerHeightMm = PRESET_MAP[String(opts?.layerPreset || 'standard')] || 0.2

  const massSettings = {
    layerHeightMm,
    infillPercent: Number(opts?.infillPercent ?? 0),
    supports: Boolean(opts?.supports),
    density_g_per_cm3: Number(itemData.density_g_per_cm3 ?? 1.24),
    perimeters: 3,
    extrusionWidthMm: 0.45,
    topBottomLayers: 5,
    supportMultiplier: Number(itemData.support_multiplier ?? 1.18),
  }

  const mass = estimateMass({ volume_mm3: geom.volume_mm3, area_mm2: geom.area_mm2, bbox: geom.bbox }, massSettings)

  const time = estimateTime({ area_mm2: geom.area_mm2, bbox: { size: { z: geom.bbox.size.z } } }, { V_print_mm3: mass.V_print_mm3, layerHeightMm, supports: Boolean(opts?.supports), preset: String(opts?.layerPreset || 'standard') as any })

  // determine cost stored in pence if available, otherwise fall back to GBP column
  const costPerKgPence = Number(itemData.cost_per_kg_pence ?? Math.round((Number(itemData.cost_per_kg_gbp ?? 0) * 100)))

  const material = {
    // pricing library expects GBP; derive from pence
    cost_per_kg_gbp: costPerKgPence / 100,
    cost_per_kg_pence: costPerKgPence,
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

  return { grams: mass.grams, timeSeconds: time.timeSeconds, pricing, geometry: { volume_mm3: geom.volume_mm3, area_mm2: geom.area_mm2, bbox: geom.bbox } }
}

export default runEstimation
