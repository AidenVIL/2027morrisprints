export type Material = {
  cost_per_kg_gbp: number
  density_g_per_cm3?: number
  support_multiplier?: number
}

export type PricingSettings = {
  machine_rate_per_hour_gbp?: number
  electricity_price_per_kwh_gbp: number
  printer_avg_watts?: number
  electricity_markup?: number
  material_markup?: number
  labour_fee_gbp?: number
  min_order_fee_gbp?: number
  supports_fee_gbp?: number
  small_part_fee_threshold_g?: number
  small_part_fee_gbp?: number
}

export type Extras = {
  minOrderFee: number
  supportsFee: number
  smallPartFee: number
}

export type PricingBreakdown = {
  materialCost: number
  materialCharge: number
  machineHours: number
  machineCharge: number
  electricityKwh: number
  electricityCost: number
  electricityCharge: number
  labourCharge: number
  extras: Extras
  subtotal: number
  final: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function roundUpToNearest05(n: number) {
  return Math.ceil(n / 0.05) * 0.05
}

export function estimatePricing(
  grams: number,
  timeSeconds: number,
  material: Material,
  settings: PricingSettings
): PricingBreakdown {
  const n = (x: any, fallback = 0) => (Number.isFinite(Number(x)) ? Number(x) : fallback)

  const machine_rate_per_hour_gbp = n(settings.machine_rate_per_hour_gbp, 0.3)
  const electricity_price_per_kwh_gbp = n(settings.electricity_price_per_kwh_gbp, 0)
  const printer_avg_watts = n(settings.printer_avg_watts, 120)
  const electricity_markup = n(settings.electricity_markup, 1.1)
  const material_markup = n(settings.material_markup, 1.5)
  const labour_fee_gbp = n(settings.labour_fee_gbp, 1.0)

  const min_order_fee = Math.max(0, n(settings.min_order_fee_gbp, 0))
  const supports_fee_setting = Math.max(0, n(settings.supports_fee_gbp, 0))
  const small_part_fee_threshold = n(settings.small_part_fee_threshold_g, 15)
  const small_part_fee_gbp = n(settings.small_part_fee_gbp, 0.5)

  const safeGrams = Math.max(0, n(grams, 0))
  const safeTimeSec = Math.max(0, n(timeSeconds, 0))

  const materialCost = (safeGrams / 1000) * n(material.cost_per_kg_gbp, 0)
  const materialCharge = materialCost * material_markup

  const machineHours = safeTimeSec / 3600
  const machineCharge = machineHours * machine_rate_per_hour_gbp

  const electricityKwh = (printer_avg_watts / 1000) * machineHours
  const electricityCost = electricityKwh * electricity_price_per_kwh_gbp
  const electricityCharge = electricityCost * electricity_markup

  const labourCharge = labour_fee_gbp

  // extras - always numbers
  const extras: Extras = { minOrderFee: 0, supportsFee: 0, smallPartFee: 0 }
  if (min_order_fee > 0) extras.minOrderFee = min_order_fee
  extras.supportsFee = supports_fee_setting
  if (safeGrams < small_part_fee_threshold) extras.smallPartFee = small_part_fee_gbp

  const subtotalRaw =
    n(materialCharge, 0) +
    n(machineCharge, 0) +
    n(electricityCharge, 0) +
    n(labourCharge, 0) +
    n(extras.minOrderFee, 0) +
    n(extras.supportsFee, 0) +
    n(extras.smallPartFee, 0)

  const subtotal = round2(n(subtotalRaw, 0))
  // final price is simple sum (no automatic rounding up)
  const final = round2(subtotal)

  return {
    materialCost: round2(n(materialCost, 0)),
    materialCharge: round2(n(materialCharge, 0)),
    machineHours: round2(n(machineHours, 0)),
    machineCharge: round2(n(machineCharge, 0)),
    electricityKwh: round2(n(electricityKwh, 0)),
    electricityCost: round2(n(electricityCost, 0)),
    electricityCharge: round2(n(electricityCharge, 0)),
    labourCharge: round2(n(labourCharge, 0)),
    extras: { minOrderFee: round2(n(extras.minOrderFee, 0)), supportsFee: round2(n(extras.supportsFee, 0)), smallPartFee: round2(n(extras.smallPartFee, 0)) },
    subtotal: round2(n(subtotal, 0)),
    final: round2(n(final, 0)),
  }
}

export default estimatePricing
