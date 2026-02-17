import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { estimateWithPrusa } from '../../../../lib/prusaEstimator';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  const body = await req.json();
  const { storagePath, settings } = body;
  if (!storagePath) return NextResponse.json({ error: 'missing storagePath' }, { status: 400 });

  try {
    // force debug output
    const est = await estimateWithPrusa(storagePath, { ...(settings || {}), debug: true });
    return NextResponse.json({ ok: true, estimate: est });
  } catch (e) {
    console.error('prusa-debug error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
