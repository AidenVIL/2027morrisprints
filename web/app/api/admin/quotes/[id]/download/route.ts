import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../../../lib/adminAuth';

export async function GET(req: Request, context: any) {
  const resolvedParams = typeof context?.params?.then === 'function' ? await context.params : context?.params;
  const id = resolvedParams?.id ?? context?.params?.id;

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

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
