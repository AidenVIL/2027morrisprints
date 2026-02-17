import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { estimate } from '../../../../lib/prusa/estimate';
import type { PrusaEstimate } from '../../../../lib/prusa/estimate';
import { requireAdmin } from '../../../../lib/adminAuth';

// GET: unauthenticated quick test — writes bundled test.stl to /tmp and runs estimate
export async function GET(req: Request) {
  try {
    const srcPath = path.join(process.cwd(), 'web', 'assets', 'test.stl');
    const tmpPath = '/tmp/test.stl';

    const data = await fs.readFile(srcPath);
    await fs.writeFile(tmpPath, data);

    const res = await estimate(tmpPath).catch((e) => { throw e; });
    console.log('prusa-test GET result', { grams: res.grams, timeSeconds: res.timeSeconds });
    return NextResponse.json({ ok: true, grams: res.grams, timeSeconds: res.timeSeconds, raw: res });
  } catch (err: any) {
    console.error('prusa self-test failed', err);
    return NextResponse.json({ ok: false, error: err?.message || String(err), details: err?.stack }, { status: 500 });
  }
}

// POST: admin-only test endpoint — runs estimate directly against bundled asset
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const testPath = path.join(process.cwd(), 'web', 'assets', 'test.stl');
    const res: PrusaEstimate = await estimate(testPath, { timeoutMs: 120000 });
    console.log('prusa-test POST result', { grams: res.grams, timeSeconds: res.timeSeconds });
    return NextResponse.json({ ok: true, grams: res.grams, timeSeconds: res.timeSeconds });
  } catch (e: any) {
    console.error('prusa test error', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e), details: e?.stack }, { status: 500 });
  }
}
