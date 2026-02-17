import { NextResponse } from 'next/server';
import { ensureSupabaseAdmin } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const supabase = ensureSupabaseAdmin();

    // parse multipart form data
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const desiredPath = (form.get('path') as string) || undefined;

    if (!file) return NextResponse.json({ error: 'missing file' }, { status: 400 });

    const name = file.name || `upload-${crypto.randomUUID()}`;
    const path = desiredPath || `temp/${crypto.randomUUID()}/${name}`;

    const arr = await file.arrayBuffer();
    const buffer = Buffer.from(arr);

    const { error } = await supabase.storage.from('models').upload(path, buffer, { upsert: true });
    if (error) {
      console.error('server upload error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    console.error('upload endpoint error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
