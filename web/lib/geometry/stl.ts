export type Vec3 = { x: number; y: number; z: number }

export type BBox = {
  min: Vec3
  max: Vec3
  size: Vec3
}

export type GeometryResult = {
  triangles: number
  volume_mm3: number
  area_mm2: number
  bbox: BBox
}

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  return {
    x: ay * bz - az * by,
    y: az * bx - ax * bz,
    z: ax * by - ay * bx,
  }
}

function dot(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  return ax * bx + ay * by + az * bz
}

function triangleArea(v0: Vec3, v1: Vec3, v2: Vec3): number {
  const ux = v1.x - v0.x
  const uy = v1.y - v0.y
  const uz = v1.z - v0.z
  const vx = v2.x - v0.x
  const vy = v2.y - v0.y
  const vz = v2.z - v0.z
  const c = cross(ux, uy, uz, vx, vy, vz)
  const mag = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z)
  return 0.5 * mag
}

function signedTetraVolumeFromOrigin(v0: Vec3, v1: Vec3, v2: Vec3): number {
  // V = dot(v0, cross(v1, v2)) / 6
  const c = cross(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
  return dot(v0.x, v0.y, v0.z, c.x, c.y, c.z) / 6.0
}

function updateBBox(bbox: BBox, v: Vec3) {
  bbox.min.x = Math.min(bbox.min.x, v.x)
  bbox.min.y = Math.min(bbox.min.y, v.y)
  bbox.min.z = Math.min(bbox.min.z, v.z)
  bbox.max.x = Math.max(bbox.max.x, v.x)
  bbox.max.y = Math.max(bbox.max.y, v.y)
  bbox.max.z = Math.max(bbox.max.z, v.z)
}

export function analyzeStl(buffer: Buffer): GeometryResult {
  const maybeAscii = buffer.slice(0, 80).toString('utf8').trim().toLowerCase().startsWith('solid')

  let vertices: Vec3[] = []
  let triangles = 0

  const bbox: BBox = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
    size: { x: 0, y: 0, z: 0 },
  }

  const pushVertex = (v: Vec3) => {
    vertices.push(v)
    updateBBox(bbox, v)
  }

  const parseAscii = (): boolean => {
    try {
      const text = buffer.toString('utf8')
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        const t = line.trim()
        if (t.toLowerCase().startsWith('vertex')) {
          const parts = t.split(/\s+/)
          if (parts.length >= 4) {
            const x = Number(parts[1])
            const y = Number(parts[2])
            const z = Number(parts[3])
            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
              pushVertex({ x, y, z })
            }
          }
        }
      }
      triangles = Math.floor(vertices.length / 3)
      return triangles > 0
    } catch (e) {
      return false
    }
  }

  const parseBinary = (): boolean => {
    try {
      if (buffer.length < 84) return false
      const triCount = buffer.readUInt32LE(80)
      let offset = 84
      for (let i = 0; i < triCount; i++) {
        if (offset + 50 > buffer.length) break
        // normal floats at offset, then vertices
        const v1x = buffer.readFloatLE(offset + 12)
        const v1y = buffer.readFloatLE(offset + 16)
        const v1z = buffer.readFloatLE(offset + 20)
        const v2x = buffer.readFloatLE(offset + 24)
        const v2y = buffer.readFloatLE(offset + 28)
        const v2z = buffer.readFloatLE(offset + 32)
        const v3x = buffer.readFloatLE(offset + 36)
        const v3y = buffer.readFloatLE(offset + 40)
        const v3z = buffer.readFloatLE(offset + 44)
        pushVertex({ x: v1x, y: v1y, z: v1z })
        pushVertex({ x: v2x, y: v2y, z: v2z })
        pushVertex({ x: v3x, y: v3y, z: v3z })
        offset += 50
      }
      triangles = Math.floor(vertices.length / 3)
      return triangles > 0
    } catch (e) {
      return false
    }
  }

  let parsed = false
  if (maybeAscii) parsed = parseAscii()
  if (!parsed) parsed = parseBinary()
  if (!parsed) throw new Error('Failed to parse STL')

  // compute metrics
  let totalVolume = 0
  let totalArea = 0
  for (let i = 0; i < triangles; i++) {
    const v0 = vertices[i * 3]
    const v1 = vertices[i * 3 + 1]
    const v2 = vertices[i * 3 + 2]
    totalArea += triangleArea(v0, v1, v2)
    totalVolume += signedTetraVolumeFromOrigin(v0, v1, v2)
  }

  const volume_mm3 = Math.abs(totalVolume)
  const area_mm2 = totalArea
  bbox.size.x = bbox.max.x - bbox.min.x
  bbox.size.y = bbox.max.y - bbox.min.y
  bbox.size.z = bbox.max.z - bbox.min.z

  return {
    triangles,
    volume_mm3,
    area_mm2,
    bbox,
  }
}

export default { analyzeStl }
