import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseClient'

async function getOrCreateCart({ userId, sessionId }: { userId?: string | null; sessionId?: string | null }) {
  // try to find open cart by user or session
  if (userId) {
    const { data } = await supabaseAdmin.from('carts').select('*').eq('customer_id', userId).eq('status', 'open').limit(1).maybeSingle()
    if (data) return data
  }
  if (sessionId) {
    const { data } = await supabaseAdmin.from('carts').select('*').eq('session_id', sessionId).eq('status', 'open').limit(1).maybeSingle()
    if (data) return data
  }

  const cartId = crypto.randomUUID()
  const insert: any = { id: cartId, status: 'open' }
  if (userId) insert.customer_id = userId
  if (sessionId) insert.session_id = sessionId
  await supabaseAdmin.from('carts').insert(insert)
  return insert
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null

  const body = await req.json().catch(() => ({} as any))
  const { quoteId, qty = 1 } = body || {}
  if (!quoteId) return NextResponse.json({ error: 'missing quoteId' }, { status: 400 })

  // allow guest via session header
  const sessionId = req.headers.get('x-session-id') || null

  let userId: string | null = null
  try {
    if (token) {
      const { data: ud } = await supabaseAdmin.auth.getUser(token)
      userId = ud?.data?.user?.id || null
    }
  } catch (e) {
    console.warn('cart add: unable to resolve user from token', e)
  }

  try {
    const cart = await getOrCreateCart({ userId, sessionId })
    const cartItemId = crypto.randomUUID()
    await supabaseAdmin.from('cart_items').insert({ id: cartItemId, cart_id: cart.id, quote_id: quoteId, qty: Number(qty || 1) })

    // mark quote as in_cart
    await supabaseAdmin.from('quotes').update({ status: 'in_cart' }).eq('id', quoteId)

    // return cart summary
    const { data: items } = await supabaseAdmin
      .from('cart_items')
      .select('id,qty,created_at,quotes(*)')
      .eq('cart_id', cart.id)

    return NextResponse.json({ ok: true, cart: { id: cart.id, items: items || [] } })
  } catch (e: any) {
    console.error('cart add error', e)
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 })
  }
}
