import { NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { getPrusaBinary } from '../../../../lib/prusa/estimate'

export async function GET(_req: Request) {
  try {
    const found = await getPrusaBinary()
    const bin = found.bin

    const res = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 10000 })
    if (res.error) {
      return NextResponse.json({ ok: false, error: 'EXEC_ERROR', details: String(res.error) }, { status: 500 })
    }
    const out = (res.stdout || res.stderr || '').toString().trim()
    return NextResponse.json({ ok: true, bin, version: out })
  } catch (e: any) {
    // Handle structured PRUSASLICER_NOT_FOUND thrown by getPrusaBinary
    if (e instanceof Error && typeof e.message === 'string' && e.message.startsWith('PRUSASLICER_NOT_FOUND:')) {
      try {
        const json = JSON.parse(e.message.replace('PRUSASLICER_NOT_FOUND:', ''))
        return NextResponse.json({ ok: false, error: 'PRUSASLICER_NOT_FOUND', tried: json.tried }, { status: 500 })
      } catch (_parseErr) {
        // fallthrough to generic error
      }
    }
    return NextResponse.json({ ok: false, error: 'failed', details: String(e) }, { status: 500 })
  }
}
