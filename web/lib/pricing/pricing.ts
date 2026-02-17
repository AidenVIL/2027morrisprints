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
  const machine_rate_per_hour_gbp = Number(settings.machine_rate_per_hour_gbp ?? 0.3)
  const electricity_price_per_kwh_gbp = Number(settings.electricity_price_per_kwh_gbp ?? 0)
  const printer_avg_watts = Number(settings.printer_avg_watts ?? 120)
  const electricity_markup = Number(settings.electricity_markup ?? 1.1)
  const material_markup = Number(settings.material_markup ?? 1.5)
  const labour_fee_gbp = Number(settings.labour_fee_gbp ?? 1.0)

  const min_order_fee = Math.max(0, Number(settings.min_order_fee_gbp ?? 0))
  const supports_fee_setting = Math.max(0, Number(settings.supports_fee_gbp ?? 0))
  const small_part_fee_threshold = Number(settings.small_part_fee_threshold_g ?? 15)
  const small_part_fee_gbp = Number(settings.small_part_fee_gbp ?? 0.5)

  const safeGrams = Math.max(0, Number(grams || 0))
  const safeTimeSec = Math.max(0, Number(timeSeconds || 0))

  const materialCost = (safeGrams / 1000) * Number(material.cost_per_kg_gbp || 0)
  const materialCharge = materialCost * material_markup

  const machineHours = safeTimeSec / 3600
  const machineCharge = machineHours * machine_rate_per_hour_gbp

  const electricityKwh = (printer_avg_watts / 1000) * machineHours
  const electricityCost = electricityKwh * electricity_price_per_kwh_gbp
  const electricityCharge = electricityCost * electricity_markup

  const labourCharge = labour_fee_gbp

  // extras
  const extras: Extras = { minOrderFee: 0, supportsFee: 0, smallPartFee: 0 }
  if (min_order_fee > 0) extras.minOrderFee = min_order_fee
  // supports fee is applied by settings if provided; caller should indicate supports separately by adding supportsFee here as needed
  extras.supportsFee = supports_fee_setting
  if (safeGrams < small_part_fee_threshold) extras.smallPartFee = small_part_fee_gbp

  const subtotalRaw =
    materialCharge +
    machineCharge +
    electricityCharge +
    labourCharge +
    extras.minOrderFee +
    extras.supportsFee +
    extras.smallPartFee

  const subtotal = round2(subtotalRaw)
  const final = round2(roundUpToNearest05(subtotal))

  return {
    materialCost: round2(materialCost),
    materialCharge: round2(materialCharge),
    machineHours: round2(machineHours),
    machineCharge: round2(machineCharge),
    electricityKwh: round2(electricityKwh),
    electricityCost: round2(electricityCost),
    electricityCharge: round2(electricityCharge),
    labourCharge: round2(labourCharge),
    extras,
    subtotal,
    final,
  }
}

export default estimatePricing
