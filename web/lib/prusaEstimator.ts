import { supabaseAdmin } from './supabaseClient'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { estimateFromStl } from './estimator'

// Downloads the model from Supabase storage and runs the pure-Node estimator.
export async function estimateWithPrusa(storagePath: string, settings?: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.from('models').download(storagePath)
    if (error || !data) throw new Error('failed to download model for estimation')
    const arr = await data.arrayBuffer()
    const buf = Buffer.from(arr)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'estimator-dl-'))
    const baseName = storagePath.split('/').slice(-1)[0] || 'model.stl'
    const tmpPath = path.join(tmpDir, baseName)
    await fs.writeFile(tmpPath, buf)

    // map material name to filament density
    const materialMap: Record<string, { density: number }> = {
      'PLA': { density: 1.24 },
      'PETG': { density: 1.27 },
      'ABS': { density: 1.04 },
    }
    const matName = settings?.material || ''
    const matInfo = materialMap[matName?.toUpperCase()] || { density: 1.24 }

    const opts = {
      density_g_cm3: matInfo.density,
      infillPercent: settings?.infillPercent ?? undefined,
      layerHeightMm: settings?.layerHeightMm ?? undefined,
      extrusionWidthMm: settings?.extrusionWidthMm ?? settings?.nozzleMm ? 0.45 : undefined,
      speedMmPerSec: settings?.speedMmPerSec ?? undefined,
      preset: settings?.preset ?? undefined,
      supports: settings?.supports ?? undefined,
      calibrationFactorMaterial: settings?.calibrationFactorMaterial ?? undefined,
      calibrationFactorTime: settings?.calibrationFactorTime ?? undefined,
      materialCostPerGram: settings?.materialCostPerGram ?? undefined,
      laborRatePerHour: settings?.laborRatePerHour ?? undefined,
    }

    const est = await estimateFromStl(tmpPath, opts as any)

    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch (e) { /* ignore */ }

    return est;
  } catch (e) {
    console.error('estimator error', e)
    throw e
  }
}
