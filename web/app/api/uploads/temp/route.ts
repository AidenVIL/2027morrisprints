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

    // Attempt upload, and if the bucket is missing, try to create it and retry once.
    let uploadResult = await supabase.storage.from('models').upload(path, buffer, { upsert: true });
    if (uploadResult.error) {
      const em = String(uploadResult.error.message || uploadResult.error);
      console.error('initial upload error', em, uploadResult.error);
      if (em.toLowerCase().includes('bucket') || em.toLowerCase().includes('bucket not found')) {
        try {
          console.log('attempting to create missing bucket `models`');
          const create = await supabase.storage.createBucket('models', { public: false });
          if (create.error) {
            console.error('failed creating bucket', create.error);
            return NextResponse.json({ error: create.error.message || String(create.error) }, { status: 500 });
          }
          // retry upload
          uploadResult = await supabase.storage.from('models').upload(path, buffer, { upsert: true });
          if (uploadResult.error) {
            console.error('upload after create failed', uploadResult.error);
            return NextResponse.json({ error: uploadResult.error.message || String(uploadResult.error) }, { status: 500 });
          }
        } catch (ce: any) {
          console.error('exception creating bucket', ce);
          return NextResponse.json({ error: ce?.message || String(ce) }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: uploadResult.error.message || String(uploadResult.error) }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    console.error('upload endpoint error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
