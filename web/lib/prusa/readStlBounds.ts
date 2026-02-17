import fs from 'fs';

export type Bounds = { x: number; y: number; z: number } | null;

function isAscii(buf: Buffer) {
  // simple heuristic: if buffer contains "vertex" in first 256 bytes treat as ASCII
  const head = buf.slice(0, 256).toString('utf8');
  return /vertex/i.test(head);
}

export function readStlBounds(filePath: string): Bounds {
  const buf = fs.readFileSync(filePath);
  if (buf.length === 0) return null;

  if (isAscii(buf)) {
    const s = buf.toString('utf8');
    const vertexRe = /vertex\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/gi;
    let m: RegExpExecArray | null;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let found = false;
    while ((m = vertexRe.exec(s))) {
      found = true;
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    }
    if (!found) return null;
    return { x: (maxX - minX), y: (maxY - minY), z: (maxZ - minZ) };
  }

  // binary STL
  try {
    // 80 byte header + uint32 count
    if (buf.length < 84) return null;
    const triCount = buf.readUInt32LE(80);
    let offset = 84;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let found = false;
    for (let i = 0; i < triCount; i++) {
      if (offset + 50 > buf.length) break; // each triangle is 50 bytes
      // normal (3*4 bytes) skip
      offset += 12;
      const x1 = buf.readFloatLE(offset); const y1 = buf.readFloatLE(offset + 4); const z1 = buf.readFloatLE(offset + 8);
      offset += 12;
      const x2 = buf.readFloatLE(offset); const y2 = buf.readFloatLE(offset + 4); const z2 = buf.readFloatLE(offset + 8);
      offset += 12;
      const x3 = buf.readFloatLE(offset); const y3 = buf.readFloatLE(offset + 4); const z3 = buf.readFloatLE(offset + 8);
      offset += 12;
      // attribute byte count
      offset += 2;
      found = true;
      for (const [x, y, z] of [[x1,y1,z1],[x2,y2,z2],[x3,y3,z3]]) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      }
    }
    if (!found) return null;
    return { x: (maxX - minX), y: (maxY - minY), z: (maxZ - minZ) };
  } catch (e) {
    return null;
  }
}

export function dimsToMm(dims: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  // if dims look like meters (<10) assume meters and convert; if values small (<0.1) maybe meters too
  const maxDim = Math.max(dims.x, dims.y, dims.z);
  if (maxDim > 0 && maxDim < 10) {
    // assume meters -> mm
    return { x: dims.x * 1000, y: dims.y * 1000, z: dims.z * 1000 };
  }
  // otherwise assume already mm
  return dims;
}
