export type GeometryInput = {
  volume_mm3: number
  area_mm2: number
  bbox: { size: { x: number; y: number; z: number } }
}

export type MassSettings = {
  layerHeightMm: number
  infillPercent: number
  supports?: boolean
  density_g_per_cm3: number
  perimeters?: number
  extrusionWidthMm?: number
  topBottomLayers?: number
  supportMultiplier?: number
}

export type MassResult = {
  V_print_mm3: number
  grams: number
}

export function estimateMass(geometry: GeometryInput, settings: MassSettings): MassResult {
  // defaults
  const perimeters = Number(settings.perimeters ?? 3)
  const extrusionWidthMm = Number(settings.extrusionWidthMm ?? 0.45)
  const topBottomLayers = Number(settings.topBottomLayers ?? 5)
  const supportMultiplier = Number(settings.supportMultiplier ?? 1.18)

  // sanitize geometry
  const volume_mm3 = Math.max(0, Number(geometry.volume_mm3 || 0))
  const area_mm2 = Math.max(0, Number(geometry.area_mm2 || 0))
  const bboxX = Math.max(0, Number(geometry.bbox?.size?.x ?? 0))
  const bboxY = Math.max(0, Number(geometry.bbox?.size?.y ?? 0))

  // sanitize settings
  const layerHeightMm = Math.max(0.01, Number(settings.layerHeightMm))
  const infillPercent = Math.min(100, Math.max(0, Number(settings.infillPercent ?? 0)))
  const supports = Boolean(settings.supports)
  const density = Math.max(0.0001, Number(settings.density_g_per_cm3))

  // computations
  const shellThickness = perimeters * extrusionWidthMm
  let V_shell = area_mm2 * shellThickness
  // clamp shell if it exceeds total volume
  if (V_shell > volume_mm3) {
    V_shell = Math.max(0, volume_mm3 * 0.9)
  }

  const projectedArea = Math.min(area_mm2 * 0.25, bboxX * bboxY || area_mm2 * 0.25)
  const t_tb = 2 * topBottomLayers * layerHeightMm
  const V_tb = projectedArea * t_tb

  const V_core = Math.max(volume_mm3 - V_shell, 0)
  const V_print_mm3 = V_shell + V_tb + V_core * (infillPercent / 100)

  let grams = (V_print_mm3 / 1000) * density
  if (supports) grams *= supportMultiplier

  // sanity clamps
  if (!Number.isFinite(grams) || grams <= 0) grams = 1
  grams = Math.max(1, grams)

  return { V_print_mm3, grams }
}

export default estimateMass
