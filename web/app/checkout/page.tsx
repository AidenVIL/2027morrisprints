"use client";
import React, { useEffect, useState } from 'react';
import { useCartStore } from '../../lib/cart/store';
import Link from 'next/link';
import { parsePriceToPence } from '../../lib/formatPrice';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ clientSecret, cartId }: { clientSecret: string; cartId: string }){
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: 'if_required'
      });

      if (res.error) {
        setMessage(res.error.message || 'Payment failed');
      } else if (res.paymentIntent) {
        setMessage('Authorised (not charged yet)');
      }
    } catch (err: any) {
      setMessage(String(err?.message || err));
    } finally { setProcessing(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <PaymentElement />
      </div>
      <div className="flex gap-2">
        <button disabled={processing} type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">{processing ? 'Processing…' : 'Pay'}</button>
        <Link href="/quotes/new" className="px-4 py-2 border rounded">Back to quotes</Link>
      </div>
      {message && <div className="text-sm text-gray-700">{message}</div>}
    </form>
  );
}

export default function CheckoutPage(){
  const localItems = useCartStore(s => s.items);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init(){
      setLoading(true);
      try {
        // get session id from local storage and call server to create intent
        const sessionId = typeof window !== 'undefined' ? localStorage.getItem('morrisprints_session_id') : null;
        const headers: any = { 'Content-Type': 'application/json' };
        if (sessionId) headers['x-session-id'] = sessionId;

        const res = await fetch('/api/checkout/create-intent', { method: 'POST', headers, body: JSON.stringify({ cartId: null }) });
        const j = await res.json().catch(()=>null);
        if (res.ok && j?.clientSecret) {
          setClientSecret(j.clientSecret);
          setCartId(j.payment_intent_id ? j.payment_intent_id : null);
        } else {
          console.error('create-intent failed', j);
        }
      } catch (e) { console.error('init checkout error', e); }
      finally { setLoading(false); }
    }
    void init();
  }, []);

  const items = localItems || [];
  const subtotal = (items || []).reduce((s: number, it: any) => s + parsePriceToPence(it.quoteSnapshot?.finalPrice || 0), 0);

  if (!items || items.length === 0) return (
    <div className="p-6">
      <div className="text-lg font-semibold mb-3">Your cart is empty</div>
      <div className="text-sm text-gray-600">Get a quote first.</div>
      <div className="mt-4"><Link href="/quotes/new" className="px-3 py-2 bg-indigo-600 text-white rounded">Get a quote</Link></div>
    </div>
  );

  return (
    <div className="lg:flex gap-6 max-w-5xl mx-auto p-6">
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-semibold">Checkout</h2>
        <div className="p-4 border rounded bg-white">
          <h3 className="font-medium mb-2">Customer & Delivery</h3>
          {/* Minimal UI: strong validation and full forms could be added; for now stripe element is primary */}
          <p className="text-sm text-gray-600">Enter payment details below.</p>
        </div>

        <div className="p-4 border rounded bg-white">
          <h3 className="font-medium mb-2">Payment</h3>
          {loading && <div>Loading payment form…</div>}
          {!loading && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm clientSecret={clientSecret} cartId={cartId || ''} />
            </Elements>
          )}
          {!loading && !clientSecret && <div className="text-sm text-red-600">Failed to initialize payment.</div>}
        </div>
      </div>

      <aside className="w-full lg:w-96">
        <div className="p-4 border rounded bg-white mb-4">
          <h3 className="font-medium">Order summary</h3>
          <div className="mt-3 space-y-2">
            {items.map((it:any) => (
              <div key={it.id} className="flex justify-between text-sm">
                <div>{it.quoteSnapshot?.original_name || it.quoteSnapshot?.originalName || `Item ${it.id}`}</div>
                <div>£{(parsePriceToPence(it.quoteSnapshot?.finalPrice || 0)/100).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between font-medium"> <div>Total</div> <div>£{(subtotal/100).toFixed(2)}</div></div>
        </div>
      </aside>
    </div>
  );
}
