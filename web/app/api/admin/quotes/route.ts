import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { requireAdmin } from '../../../../lib/adminAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { data: quotes } = await supabaseAdmin.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(100);
  return NextResponse.json(quotes || []);
}
