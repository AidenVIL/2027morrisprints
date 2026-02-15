import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single().catch(() => ({ data: null }));
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: quotes } = await supabaseAdmin.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(100);
  return NextResponse.json(quotes || []);
}
