"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseBrowser';

export default function CartPage(){
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(){
    setLoading(true);
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) { setItems([]); setLoading(false); return; }
    const res = await fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (res.ok) setItems(j.items || []);
    else setItems([]);
    setLoading(false);
  }

  useEffect(()=>{ load() }, []);

  async function removeItem(id: string){
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return alert('Sign in required');
    const res = await fetch('/api/cart/remove', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quoteId: id }) });
    const j = await res.json();
    if (!res.ok) return alert('Remove failed: '+(j?.error||j?.details||'unknown'));
    // update local
    load();
  }

  if (loading) return <div className="p-6">Loading cart…</div>;
  if (!items || items.length === 0) return <div className="p-6">Your cart is empty. Get a quote first.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Cart</h2>
      {items.map((it: any) => (
        <div key={it.id} className="p-4 border rounded bg-white">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium">{it.file_original_name || `Quote ${it.id}`}</div>
              <div className="text-sm text-gray-600">Material: {it.inventory_item_id}</div>
            </div>
            <div className="text-right">
              <div className="text-lg">£{((it.estimated_price_pence || 0)/100).toFixed(2)}</div>
              <div className="text-xs mt-1"><span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">{it.status}</span></div>
              <div className="mt-3 flex gap-2 justify-end">
                <a href={`/quotes/new?draft=${it.id}`} className="px-3 py-1 border rounded">Edit</a>
                <button onClick={()=>removeItem(it.id)} className="px-3 py-1 border rounded">Remove</button>
                <a href={`/checkout?quoteId=${it.id}`} className="px-3 py-1 bg-indigo-600 text-white rounded">Proceed to payment</a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
