import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

export type EstimatorOptions = {
  density_g_cm3?: number // material density in g/cm^3 (defaults PLA ~1.24)
  infillPercent?: number // 0-100
  layerHeightMm?: number
  extrusionWidthMm?: number
  speedMmPerSec?: number // average extrusion travel speed
  preset?: 'draft' | 'standard' | 'fine' | 'ultra' | string
  supports?: boolean
  calibrationFactorMaterial?: number
  calibrationFactorTime?: number
  materialCostPerGram?: number
  laborRatePerHour?: number
}

export type EstimatorResult = {
  grams: number
  timeSeconds: number
  extrusionLengthMm: number
  estimatedPrice: number
  details?: Record<string, any>
}

// Default parameters
const DEFAULTS = {
  density_g_cm3: 1.24, // PLA ~1.24 g/cm3
  infillPercent: 20,
  layerHeightMm: 0.2,
  extrusionWidthMm: 0.45,
  speedMmPerSec: 50,
  presetMultipliers: { draft: 0.85, standard: 1.0, fine: 1.2, ultra: 1.4 } as Record<string, number>,
  supportsMultiplier: 1.25,
  calibrationFactorMaterial: 1.0,
  calibrationFactorTime: 1.0,
  materialCostPerGram: 0.05, // $0.05/g default
  laborRatePerHour: 15.0,
}

// Compute solid volume from STL (mm^3). Supports binary and ASCII STL.
export async function computeStlVolumeMm3(filePath: string): Promise<number> {
  const stat = await fsPromises.stat(filePath)
  const fd = await fsPromises.open(filePath, 'r')
  try {
    const headerBuf = Buffer.alloc(84)
    await fd.read(headerBuf, 0, 84, 0)
    // Heuristic: if bytes 80-83 (uint32) looks like reasonable triangle count and file size matches -> binary
    const triCount = headerBuf.readUInt32LE(80)
    const expectedSize = 84 + triCount * 50
    if (stat.size === expectedSize || stat.size >= expectedSize) {
      // binary STL
      return await computeBinaryStlVolume(fd, triCount)
    }
    // else try ASCII parse
    const content = await fsPromises.readFile(filePath, 'utf8')
    if (content.toLowerCase().includes('solid')) {
      return computeAsciiStlVolume(content)
    }
    // fallback: try binary parsing anyway
    return await computeBinaryStlVolume(fd, triCount)
  } finally {
    await fd.close()
  }
}

async function computeBinaryStlVolume(fd: fsPromises.FileHandle, triCount: number): Promise<number> {
  const chunkSize = 50
  let offset = 84
  const buf = Buffer.alloc(chunkSize)
  let total = 0
  for (let i = 0; i < triCount; i++) {
    const { bytesRead } = await fd.read(buf, 0, chunkSize, offset)
    if (bytesRead < chunkSize) break
    offset += chunkSize
    // vertices start at byte 12 in the chunk (after normal 3 floats)
    const v1x = buf.readFloatLE(12)
    const v1y = buf.readFloatLE(16)
    const v1z = buf.readFloatLE(20)
    const v2x = buf.readFloatLE(24)
    const v2y = buf.readFloatLE(28)
    const v2z = buf.readFloatLE(32)
    const v3x = buf.readFloatLE(36)
    const v3y = buf.readFloatLE(40)
    const v3z = buf.readFloatLE(44)
    total += Math.abs(signedTetraVolume(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z))
  }
  return total
}

function computeAsciiStlVolume(content: string): number {
  const lines = content.split(/\r?\n/)
  const verts: number[] = []
  const volumes: number[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t.toLowerCase().startsWith('vertex')) {
      const parts = t.split(/\s+/)
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])
      verts.push(x, y, z)
      if (verts.length >= 9) {
        const v1x = verts[verts.length - 9]
        const v1y = verts[verts.length - 8]
        const v1z = verts[verts.length - 7]
        const v2x = verts[verts.length - 6]
        const v2y = verts[verts.length - 5]
        const v2z = verts[verts.length - 4]
        const v3x = verts[verts.length - 3]
        const v3y = verts[verts.length - 2]
        const v3z = verts[verts.length - 1]
        volumes.push(Math.abs(signedTetraVolume(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z)))
      }
    }
  }
  return volumes.reduce((a, b) => a + b, 0)
}

function signedTetraVolume(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  // volume of tetrahedron formed by points a,b,c and origin = dot(a, cross(b,c)) / 6
  const crossx = by * cz - bz * cy
  const crossy = bz * cx - bx * cz
  const crossz = bx * cy - by * cx
  const dot = ax * crossx + ay * crossy + az * crossz
  return dot / 6.0
}

export async function estimateFromStl(filePath: string, opts?: EstimatorOptions): Promise<EstimatorResult> {
  const o = { ...DEFAULTS, ...(opts || {}) } as any

  const volumeMm3 = await computeStlVolumeMm3(filePath)

  // Effective printed volume accounts for infill multiplier and a small shell baseline
  const effectiveFill = 0.3 + (Number(o.infillPercent) / 100) * 0.7
  const printedVolumeMm3 = volumeMm3 * effectiveFill

  // Convert volume to grams: grams = (mm3 -> cm3) * density_g_cm3
  const volumeCm3 = printedVolumeMm3 / 1000.0
  let grams = volumeCm3 * Number(o.density_g_cm3)
  grams *= Number(o.calibrationFactorMaterial || 1)

  // Extrusion cross-section = layerHeight * extrusionWidth (mm^2)
  const layerHeight = Number(o.layerHeightMm)
  const extrusionWidth = Number(o.extrusionWidthMm)
  const extrusionCrossSectionMm2 = Math.max(0.0001, layerHeight * extrusionWidth)
  const extrusionLengthMm = printedVolumeMm3 / extrusionCrossSectionMm2

  // Time estimate from extrusion length and speed, adjusted by preset and supports
  const baseSpeed = Number(o.speedMmPerSec)
  const presetMultiplier = (o.presetMultipliers && o.presetMultipliers[o.preset]) || (o.preset && DEFAULTS.presetMultipliers[o.preset]) || 1.0
  let timeSeconds = extrusionLengthMm / Math.max(0.001, baseSpeed)
  timeSeconds *= Number(o.calibrationFactorTime || 1)
  timeSeconds *= presetMultiplier
  if (o.supports) timeSeconds *= Number(o.supportsMultiplier || DEFAULTS.supportsMultiplier)

  // Price: material + labor
  const materialCost = grams * Number(o.materialCostPerGram)
  const labor = (timeSeconds / 3600) * Number(o.laborRatePerHour)
  const estimatedPrice = materialCost + labor

  return {
    grams: Number(grams),
    timeSeconds: Number(timeSeconds),
    extrusionLengthMm: Number(extrusionLengthMm),
    estimatedPrice: Number(Number(estimatedPrice).toFixed(4)),
    details: {
      volumeMm3,
      printedVolumeMm3,
      effectiveFill,
      extrusionCrossSectionMm2,
      presetMultiplier,
      calibrationFactorMaterial: o.calibrationFactorMaterial,
      calibrationFactorTime: o.calibrationFactorTime,
    },
  }
}

export default { estimateFromStl, computeStlVolumeMm3 }
