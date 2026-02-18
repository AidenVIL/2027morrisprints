"use client";
import React from 'react';
import { useCartStore } from '../../lib/cart/store';
import Link from 'next/link';

export default function CheckoutPage(){
  const items = useCartStore(s => s.items);
  const subtotal = (items || []).reduce((s, it) => s + (Number(it.quoteSnapshot?.finalPrice || 0)), 0);

  function handlePay(){
    if (!items || items.length === 0) {
      try { window.alert('Your cart is empty'); } catch(e){}
      return;
    }
    // Placeholder: start payment flow (to be implemented with Stripe)
    try { window.alert('Starting payment flow — integration pending'); } catch(e){}
  }

  if (!items || items.length === 0) return (
    <div className="p-6">
      <div className="text-lg font-semibold mb-3">Your cart is empty</div>
      <div className="text-sm text-gray-600">Get a quote first.</div>
      <div className="mt-4"><Link href="/quotes/new" className="px-3 py-2 bg-indigo-600 text-white rounded">Get a quote</Link></div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Checkout</h2>
      {items.map((it:any) => (
        <div key={it.id} className="p-4 border rounded bg-white">
          <div className="flex justify-between">
            <div>
              <div className="font-medium">{it.quoteSnapshot?.originalName || `Item ${it.id}`}</div>
              <div className="text-sm text-gray-600">{it.quoteSnapshot?.layerPreset} • Infill {it.quoteSnapshot?.infillPercent}% • {it.quoteSnapshot?.supports ? 'Supports' : 'No supports'} • Qty {it.quoteSnapshot?.quantity}</div>
            </div>
            <div className="text-right">
              <div className="text-lg">£{((Number(it.quoteSnapshot?.finalPrice || 0))/100).toFixed(2)}</div>
              <div className="text-sm">{it.quoteSnapshot?.grams} g</div>
            </div>
          </div>
        </div>
      ))}

      <div className="p-4 border rounded bg-white">
        <div className="flex justify-between">
          <div className="font-medium">Total</div>
          <div className="font-medium">£{(subtotal/100).toFixed(2)}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handlePay} className="px-4 py-2 bg-indigo-600 text-white rounded">Pay</button>
        <Link href="/quotes/new" className="px-4 py-2 border rounded">Back to quotes</Link>
      </div>
    </div>
  );
}
