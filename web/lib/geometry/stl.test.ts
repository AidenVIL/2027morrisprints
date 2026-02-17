import assert from 'assert'
import { analyzeStl } from './stl'

function makeAsciiTetra(): Buffer {
  // Tetra with vertices A(0,0,0), B(1,0,0), C(0,1,0), D(0,0,1)
  const stl = `solid tetra
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 0 1
  endloop
endfacet
facet normal -1 0 0
  outer loop
    vertex 0 0 0
    vertex 0 1 0
    vertex 0 0 1
  endloop
endfacet
facet normal 1 1 1
  outer loop
    vertex 1 0 0
    vertex 0 1 0
    vertex 0 0 1
  endloop
endfacet
endsolid tetra
`
  return Buffer.from(stl, 'utf8')
}

function close(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps
}

// Run tests
;(function run() {
  const buf = makeAsciiTetra()
  const res = analyzeStl(buf)
  // Tetra volume should be 1/6
  const expectedVolume = 1 / 6
  assert.ok(close(res.volume_mm3, expectedVolume, 1e-6), `volume ${res.volume_mm3} != ${expectedVolume}`)
  // BBox should be [0,1] in x,y,z
  assert.strictEqual(res.bbox.min.x, 0)
  assert.strictEqual(res.bbox.min.y, 0)
  assert.strictEqual(res.bbox.min.z, 0)
  assert.strictEqual(res.bbox.max.x, 1)
  assert.strictEqual(res.bbox.max.y, 1)
  assert.strictEqual(res.bbox.max.z, 1)
  // triangles == 4
  assert.strictEqual(res.triangles, 4)
  console.log('stl.test: OK')
})()
