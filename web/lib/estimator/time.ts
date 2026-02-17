export type TimeGeometry = {
  area_mm2: number
  bbox: { size: { z: number } }
}

export type TimeSettings = {
  V_print_mm3: number
  layerHeightMm: number
  supports?: boolean
  preset: 'draft' | 'standard' | 'fine' | 'ultra'
}

export type TimeResult = {
  extrusionLength_mm: number
  timeSeconds: number
}

export function estimateTime(geometry: TimeGeometry, settings: TimeSettings): TimeResult {
  const extrusionWidthMm = 0.45
  const speeds: Record<string, number> = {
    draft: 70,
    standard: 55,
    fine: 45,
    ultra: 35,
  }

  const k_area = 0.0025 // seconds per mm^2
  const layerOverheadSec = 2.0
  const supportsMultiplierTime = 1.15
  const minimumTimeSec = 600

  const area_mm2 = Math.max(0, Number(geometry.area_mm2 || 0))
  const bboxZ = Math.max(0, Number(geometry.bbox?.size?.z ?? 0))

  const V_print_mm3 = Math.max(0, Number(settings.V_print_mm3 || 0))
  const layerHeightMm = Math.max(0.0001, Number(settings.layerHeightMm))
  const supports = Boolean(settings.supports)
  const preset = settings.preset || 'standard'
  const speed_mm_s = speeds[preset] ?? speeds.standard

  const lineArea = extrusionWidthMm * layerHeightMm
  const safeLineArea = Math.max(1e-6, lineArea)

  const extrusionLength = V_print_mm3 / safeLineArea
  const t_extrude = extrusionLength / Math.max(0.0001, speed_mm_s)

  const t_overhead = area_mm2 * k_area
  const layers = bboxZ / layerHeightMm
  const t_layers = layers * layerOverheadSec

  let timeSeconds = t_extrude + t_overhead + t_layers
  if (supports) timeSeconds *= supportsMultiplierTime
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) timeSeconds = minimumTimeSec
  timeSeconds = Math.max(timeSeconds, minimumTimeSec)

  return { extrusionLength_mm: extrusionLength, timeSeconds }
}

export default estimateTime
