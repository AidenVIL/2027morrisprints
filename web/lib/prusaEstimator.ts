import { supabaseAdmin } from './supabaseClient'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { estimate } from './prusa/estimate'

// Downloads the model from Supabase storage and runs the PrusaSlicer-based estimator.
export async function estimateWithPrusa(storagePath: string, settings?: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.from('models').download(storagePath)
    if (error || !data) throw new Error('failed to download model for estimation')
    const arr = await data.arrayBuffer()
    const buf = Buffer.from(arr)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prusa-dl-'))
    const baseName = storagePath.split('/').slice(-1)[0] || 'model.stl'
    const tmpPath = path.join(tmpDir, baseName)
    await fs.writeFile(tmpPath, buf)

    // map material name to filament density and a simple filament preset
    const materialMap: Record<string, { preset: string; density: number }> = {
      'PLA': { preset: 'PLA', density: 1.24 },
      'PETG': { preset: 'PETG', density: 1.27 },
      'ABS': { preset: 'ABS', density: 1.04 },
    }
    const matName = settings?.material || '';
    const matInfo = materialMap[matName?.toUpperCase()] || { preset: 'PLA', density: 1.24 };

    // build overrides mapping for PrusaSlicer --set keys
    const overrides: Record<string, any> = {};
    if (settings?.layerHeightMm) overrides['layer_height'] = settings.layerHeightMm;
    if (settings?.infillPercent !== undefined) overrides['fill_density'] = settings.infillPercent;
    if (settings?.supports !== undefined) overrides['support_material'] = settings.supports ? 1 : 0;
    if (settings?.nozzleMm) overrides['nozzle_diameter'] = settings.nozzleMm;
    if (settings?.filamentDiameterMm) overrides['filament_diameter'] = settings.filamentDiameterMm;
    // also set filament preset name if available
    overrides['filament'] = matInfo.preset;

    const est = await estimate(tmpPath, { density: matInfo.density, overrides, debug: Boolean(settings?.debug) || Boolean(process.env.PRUSA_DEBUG) });

    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch (e) { /* ignore */ }

    return est;
  } catch (e) {
    console.error('estimator error', e)
    throw e
  }
}
