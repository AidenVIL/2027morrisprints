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
  const [step, setStep] = useState<number>(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 form state
  const [customer, setCustomer] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('checkout_customer') || 'null') || { email: '', firstName: '', lastName: '', phone: '' }; } catch(e){ return { email: '', firstName: '', lastName: '', phone: '' }; }
  });
  const [deliveryMethod, setDeliveryMethod] = useState<string>(() => localStorage.getItem('checkout_deliveryMethod') || 'collection');
  const [deliveryAddress, setDeliveryAddress] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('checkout_delivery') || 'null') || { address1:'', address2:'', city:'', county:'', postcode:'', country:'UK' }; } catch(e){ return { address1:'', address2:'', city:'', county:'', postcode:'', country:'UK' }; }
  });
  const [billingSame, setBillingSame] = useState<boolean>(() => (localStorage.getItem('checkout_billingSame') || 'true') === 'true');
  const [billingAddress, setBillingAddress] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('checkout_billing') || 'null') || { address1:'', address2:'', city:'', county:'', postcode:'', country:'UK' }; } catch(e){ return { address1:'', address2:'', city:'', county:'', postcode:'', country:'UK' }; }
  });

  useEffect(() => {
    // persist step1 state to localStorage
    try {
      localStorage.setItem('checkout_customer', JSON.stringify(customer));
      localStorage.setItem('checkout_deliveryMethod', deliveryMethod);
      localStorage.setItem('checkout_delivery', JSON.stringify(deliveryAddress));
      localStorage.setItem('checkout_billingSame', String(billingSame));
      localStorage.setItem('checkout_billing', JSON.stringify(billingAddress));
    } catch (e) {}
  }, [customer, deliveryMethod, deliveryAddress, billingSame, billingAddress]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm block">Email*</label>
              <input value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm block">Phone</label>
              <input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm block">First name*</label>
              <input value={customer.firstName} onChange={e => setCustomer({...customer, firstName: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm block">Last name*</label>
              <input value={customer.lastName} onChange={e => setCustomer({...customer, lastName: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm block">Delivery method</label>
            <div className="flex gap-3 mt-2">
              <label className="inline-flex items-center"><input type="radio" checked={deliveryMethod==='collection'} onChange={()=>setDeliveryMethod('collection')} /> <span className="ml-2">Collection</span></label>
              <label className="inline-flex items-center"><input type="radio" checked={deliveryMethod==='delivery'} onChange={()=>setDeliveryMethod('delivery')} /> <span className="ml-2">Delivery</span></label>
            </div>
          </div>

          {deliveryMethod === 'delivery' && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm block">Address 1*</label>
                <input value={deliveryAddress.address1} onChange={e => setDeliveryAddress({...deliveryAddress, address1: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Address 2</label>
                <input value={deliveryAddress.address2} onChange={e => setDeliveryAddress({...deliveryAddress, address2: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">City*</label>
                <input value={deliveryAddress.city} onChange={e => setDeliveryAddress({...deliveryAddress, city: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">County</label>
                <input value={deliveryAddress.county} onChange={e => setDeliveryAddress({...deliveryAddress, county: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Postcode*</label>
                <input value={deliveryAddress.postcode} onChange={e => setDeliveryAddress({...deliveryAddress, postcode: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Country</label>
                <input value={deliveryAddress.country} onChange={e => setDeliveryAddress({...deliveryAddress, country: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="inline-flex items-center"><input type="checkbox" checked={billingSame} onChange={e => setBillingSame(e.target.checked)} /> <span className="ml-2">Billing same as delivery</span></label>
          </div>

          {!billingSame && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm block">Billing address 1*</label>
                <input value={billingAddress.address1} onChange={e => setBillingAddress({...billingAddress, address1: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Billing address 2</label>
                <input value={billingAddress.address2} onChange={e => setBillingAddress({...billingAddress, address2: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Billing city*</label>
                <input value={billingAddress.city} onChange={e => setBillingAddress({...billingAddress, city: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Billing county</label>
                <input value={billingAddress.county} onChange={e => setBillingAddress({...billingAddress, county: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Billing postcode*</label>
                <input value={billingAddress.postcode} onChange={e => setBillingAddress({...billingAddress, postcode: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm block">Country</label>
                <input value={billingAddress.country} onChange={e => setBillingAddress({...billingAddress, country: e.target.value})} className="mt-1 w-full border rounded px-2 py-1" />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={async ()=>{
              // validation
              const validCustomer = customer?.email && customer?.firstName && customer?.lastName;
              if (!validCustomer) { alert('Please fill required customer fields'); return; }
              if (deliveryMethod === 'delivery') {
                if (!deliveryAddress.address1 || !deliveryAddress.city || !deliveryAddress.postcode) { alert('Please fill required delivery address fields'); return; }
              }
              if (!billingSame) {
                if (!billingAddress.address1 || !billingAddress.city || !billingAddress.postcode) { alert('Please fill required billing fields'); return; }
              }

              // Create intent on server
              setLoading(true);
              try {
                const sessionId = typeof window !== 'undefined' ? localStorage.getItem('morrisprints_session_id') : null;
                const headers: any = { 'Content-Type': 'application/json' };
                if (sessionId) headers['x-session-id'] = sessionId;
                const res = await fetch('/api/checkout/create-intent', { method: 'POST', headers, body: JSON.stringify({ cartId: null, customer, delivery: { method: deliveryMethod, address: deliveryAddress }, billing: billingSame ? { same: true } : { same: false, address: billingAddress } }) });
                const j = await res.json().catch(()=>null);
                if (res.ok && j?.clientSecret) {
                  setClientSecret(j.clientSecret);
                  setCartId(j.cartId || null);
                  setStep(2);
                } else {
                  console.error('create-intent failed', j);
                  alert('Failed to initialize payment');
                }
              } catch (e) { console.error('create-intent error', e); alert('Failed to initialize payment'); }
              finally { setLoading(false); }
            }} className="px-4 py-2 bg-indigo-600 text-white rounded">Continue to payment</button>
          </div>
        </div>

        {step === 2 && (
          <div className="p-4 border rounded bg-white mt-4">
            <h3 className="font-medium mb-2">Payment</h3>
            {loading && <div>Loading payment form…</div>}
            {!loading && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm clientSecret={clientSecret} cartId={cartId || ''} />
              </Elements>
            )}
            <div className="mt-3">
              <button onClick={()=>setStep(1)} className="px-3 py-1 border rounded">Back</button>
            </div>
          </div>
        )}
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
