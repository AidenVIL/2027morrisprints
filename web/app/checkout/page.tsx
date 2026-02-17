"use client";
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseBrowser';

declare global { interface Window { Stripe: any } }

export default function CheckoutPage(){
  const [quote, setQuote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [stripeObj, setStripeObj] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);

  useEffect(()=>{
    // load quote from query string
    const params = new URLSearchParams(window.location.search);
    const qid = params.get('quoteId');
    (async function(){
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) { setMessage('Sign in required'); setLoading(false); return; }
      const res = await fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      const items = j.items || [];
      const item = items.find((i:any)=> i.id === (qid || items[0]?.id));
      if (!item) { setMessage('No UNCONFIRMED cart item found.'); setLoading(false); return; }
      setQuote(item);

      // load Stripe.js
      if (!window.Stripe) {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = initStripe;
        document.head.appendChild(s);
      } else initStripe();

      setLoading(false);
    })();

    function initStripe(){
      try{
        const key = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '') as string;
        const s = window.Stripe(key);
        setStripeObj(s);
        const el = s.elements();
        setElements(el);
        const card = el.create('card');
        setTimeout(()=>{
          if (cardRef.current) card.mount(cardRef.current);
        }, 100);
      }catch(e){ console.error('stripe init', e); setMessage('Stripe failed to load'); }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    if (!quote) return setMessage('No quote selected');
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return setMessage('Sign in required');

    // create payment intent
    setMessage('Creating payment intent...');
    const res = await fetch('/api/checkout/create-payment-intent', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quoteId: quote.id }) });
    const j = await res.json();
    if (!res.ok) { setMessage('Failed to create payment intent: '+(j?.error||j?.details||'unknown')); return; }

    const clientSecret = j.client_secret;
    setMessage('Authorising card...');
    if (!stripeObj || !elements) return setMessage('Stripe not initialised');
    const card = elements.getElement('card');
    const result = await stripeObj.confirmCardPayment(clientSecret, { payment_method: { card } });
    if (result.error) {
      setMessage('Payment error: '+result.error.message);
      return;
    }
    // success — update server state
    const confirmRes = await fetch('/api/checkout/confirm', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quoteId: quote.id, payment_intent_id: result.paymentIntent?.id }) });
    const confirmJson = await confirmRes.json();
    if (!confirmRes.ok) { setMessage('Confirmation failed: '+(confirmJson?.error||confirmJson?.details||'unknown')); return; }

    setMessage('Authorised — payment will be taken after approval');
    // route to dashboard
    setTimeout(()=>{ window.location.href = '/dashboard'; }, 1500);
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (message) return <div className="p-6">{message}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Checkout</h2>
      <div className="p-4 border rounded mb-4">
        <div className="font-medium">{quote.file_original_name}</div>
        <div className="text-sm text-gray-600">Material: {quote.inventory_item_id}</div>
        <div className="text-lg mt-2">£{((quote.estimated_price_pence||0)/100).toFixed(2)}</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Card details</label>
          <div className="p-3 border rounded" ref={cardRef as any} id="card-element"></div>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded">Authorise payment</button>
      </form>
    </div>
  );
}
