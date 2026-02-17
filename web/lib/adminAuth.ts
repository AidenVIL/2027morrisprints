import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabaseClient';

export async function requireAdmin(req: Request) {
  const appToken = req.headers.get('x-admin-token');
  if (appToken && process.env.ADMIN_APP_TOKEN && appToken === process.env.ADMIN_APP_TOKEN) {
    return { profile: { id: null, role: 'admin', auth_via: 'app-token' } };
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return { error: NextResponse.json({ error: 'missing token' }, { status: 401 }) };
  const token = authHeader.replace('Bearer ', '');

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return { error: NextResponse.json({ error: 'invalid token' }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single().catch(() => ({ data: null }));
  if (!profile || profile.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };

  return { profile };
}
