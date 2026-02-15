import { supabaseAdmin } from './supabaseClient'

// NOTE: This is a best-effort estimator for environments where PrusaSlicer
// isn't available. For production, replace this with a proper call to
// the PrusaSlicer CLI running in the build environment (Docker, VM).

export async function estimateWithPrusa(storagePath: string, materialProfile?: string) {
  // download file from storage
  try {
    const { data, error } = await supabaseAdmin.storage.from('models').download(storagePath)
    if (error || !data) {
      throw new Error('failed to download model for estimation')
    }
    // Very rough heuristic: use file size to estimate grams and time
    const blob = await data.arrayBuffer()
    const bytes = blob.byteLength
    // heuristic: 1 gram per 10000 bytes (very approximate)
    const grams = Math.max(1, Math.round(bytes / 10000))
    // heuristic: 1 second per 5000 bytes
    const timeSeconds = Math.max(60, Math.round(bytes / 5000))
    return { grams, timeSeconds }
  } catch (e) {
    console.error('estimator error', e)
    throw e
  }
}
