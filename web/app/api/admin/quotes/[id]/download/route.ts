import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';

export async function GET(req: Request, context: any) {
  const resolvedParams = typeof context?.params?.then === 'function' ? await context.params : context?.params;
  const id = resolvedParams?.id ?? context?.params?.id;
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single().catch(() => ({ data: null }));
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: quote } = await supabaseAdmin.from('quote_requests').select('*').eq('id', id).single();
  if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 });

  // generate signed URL for storage
  const bucket = 'models';
  const path = quote.file_path;
  const expiresIn = 60; // seconds
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (!data?.signedUrl) return NextResponse.json({ error: 'signed url failed' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
