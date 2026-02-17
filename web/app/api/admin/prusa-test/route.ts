import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { estimate } from '../../../../lib/prusa/estimate';

export async function GET(req: Request) {
  try {
    // locate the tiny test STL bundled with the repo
    const srcPath = path.join(process.cwd(), 'web', 'assets', 'test.stl');
    const tmpPath = '/tmp/test.stl';

    const data = await fs.readFile(srcPath);
    await fs.writeFile(tmpPath, data);

    // run PrusaSlicer-based estimate
    const res = await estimate(tmpPath).catch((e) => { throw e; });

    return NextResponse.json({ ok: true, grams: res.grams, timeSeconds: res.timeSeconds, raw: res });
  } catch (err: any) {
    console.error('prusa self-test failed', err);
    return NextResponse.json({ ok: false, error: err?.message || String(err), details: err?.stack }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { estimate } from '../../../../lib/prusa/estimate';
import type { PrusaEstimate } from '../../../../lib/prusa/estimate';
import { requireAdmin } from '../../../../lib/adminAuth';
import path from 'path';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const testPath = path.join(process.cwd(), 'web', 'assets', 'test.stl');
    const res: PrusaEstimate = await estimate(testPath, { timeoutMs: 120000 });
    return NextResponse.json({ ok: true, grams: res.grams, timeSeconds: res.timeSeconds });
  } catch (e: any) {
    console.error('prusa test error', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
