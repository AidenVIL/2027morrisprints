import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'missing token' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const body = await req.json();
  const { quoteId } = body;

  const { data: userData } = await supabaseAdmin.auth.getUser(token as string);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  try {
    // set quote status to cancelled and release inventory via RPC
    const { data: quote } = await supabaseAdmin.from('quote_requests').select('*').eq('id', quoteId).single();
    if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 });

    // release inventory if reserved
    try {
      const grams = quote.reserved_grams || 0;
      if (quote.inventory_item_id && grams > 0) {
        await supabaseAdmin.rpc('release_inventory', { p_item_id: quote.inventory_item_id, p_grams: grams, p_quote_id: quoteId });
      }
    } catch (e) { console.error('release error', e) }

    await supabaseAdmin.from('quote_requests').update({ status: 'CANCELLED' }).eq('id', quoteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('cart remove error', e);
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}
