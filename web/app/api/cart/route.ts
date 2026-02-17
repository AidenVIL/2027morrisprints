import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    const { data } = await supabaseAdmin.from('quote_requests').select('*').eq('user_id', user.id).eq('status', 'UNCONFIRMED').order('created_at', { ascending: false });
    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e) {
    console.error('cart fetch error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
