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
