import { NextResponse } from 'next/server';
import { getPrusaBinary } from '../../../../lib/prusa/estimate';
import { spawnSync } from 'child_process';

export async function GET(req: Request) {
  try {
    const found = await getPrusaBinary();
    const bin = found.bin;
    // run --version
    const res = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (res.error) {
      return NextResponse.json({ ok: false, error: 'EXEC_ERROR', details: String(res.error) }, { status: 500 });
    }
    const out = (res.stdout || res.stderr || '').toString();
    return NextResponse.json({ ok: true, bin, version: out.trim() });
  } catch (e: any) {
    // If getPrusaBinary threw structured error, forward it
    if (e instanceof Error && typeof e.message === 'string' && e.message.startsWith('PRUSASLICER_NOT_FOUND:')) {
      try {
        const json = JSON.parse(e.message.replace('PRUSASLICER_NOT_FOUND:', ''));
        return NextResponse.json({ ok: false, error: 'PRUSASLICER_NOT_FOUND', details: json }, { status: 500 });
      } catch (parseErr) {
        // fallthrough
      }
    }
    return NextResponse.json({ ok: false, error: 'failed', details: String(e) }, { status: 500 });
  }
}
