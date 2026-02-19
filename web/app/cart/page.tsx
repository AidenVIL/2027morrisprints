"use client";
import { useEffect, useState } from 'react';
import { useCartStore } from '../../lib/cart/store';
import { parsePriceToPence } from '../../lib/formatPrice';

export default function CartPage(){
  const localItems = useCartStore(s => s.items);
  const removeLocal = useCartStore(s => s.removeItem);
  const [serverCart, setServerCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const sessionId = typeof window !== 'undefined' ? localStorage.getItem('morrisprints_session_id') : null;
        const headers: any = {};
        if (sessionId) headers['x-session-id'] = sessionId;
        const res = await fetch('/api/cart', { headers });
        const j = await res.json().catch(()=>null);
        if (res.ok) setServerCart(j.cart || null);
      } catch (e) {
        console.error('failed fetching server cart', e);
      } finally { setLoading(false); }
    }
    void load();
  }, []);

  const items = serverCart?.items && serverCart.items.length > 0 ? serverCart.items.map((it:any) => ({ id: it.id, createdAt: it.created_at, quoteSnapshot: it.quotes })) : localItems;

  const subtotal = (items || []).reduce((s, it) => s + parsePriceToPence(it.quoteSnapshot?.finalPrice || it.quoteSnapshot?.price_pence || 0), 0);

  if (!items || items.length === 0) return <div className="p-6">Your cart is empty. Get a quote first.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Cart</h2>
      {items.map((it: any) => (
        <div key={it.id} className="p-4 border rounded bg-white">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium">{it.quoteSnapshot?.original_name || it.quoteSnapshot?.originalName || `Item ${it.id}`}</div>
              <div className="text-sm text-gray-600">{(it.quoteSnapshot?.inventory_item_id) ? `${it.quoteSnapshot.inventory_item_id}` : ''} {it.quoteSnapshot?.material ? `— ${it.quoteSnapshot.material}` : ''}</div>
              <div className="text-sm text-gray-600">{it.quoteSnapshot?.layer_preset || it.quoteSnapshot?.layerPreset} • Infill {it.quoteSnapshot?.infill_percent ?? it.quoteSnapshot?.infillPercent}% • {it.quoteSnapshot?.supports ? 'Supports' : 'No supports'} • Qty {it.quoteSnapshot?.quantity || 1}</div>
            </div>
            <div className="text-right">
              <div className="text-lg">£{(subtotal/100).toFixed(2)}</div>
              <div className="text-sm">{it.quoteSnapshot?.grams_est ?? it.quoteSnapshot?.grams} g • {(Math.floor((it.quoteSnapshot?.time_seconds_est||it.quoteSnapshot?.timeSeconds||0)/3600)).toString().padStart(2,'0')}:{(Math.floor(((it.quoteSnapshot?.time_seconds_est||it.quoteSnapshot?.timeSeconds||0)%3600)/60)).toString().padStart(2,'0')}</div>
              <div className="mt-3 flex gap-2 justify-end">
                <a href={`/quotes/new?draft=${it.id}`} className="px-3 py-1 border rounded">Edit</a>
                <button onClick={()=>removeLocal(it.id)} className="px-3 py-1 border rounded">Remove</button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="p-4 border rounded bg-white">
        <div className="flex justify-between">
          <div className="font-medium">Subtotal</div>
          <div className="font-medium">£{(subtotal/100).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
