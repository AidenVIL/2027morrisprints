"use client";
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../../lib/supabaseBrowser';
import AuthCard from '../../../components/AuthCard';

const schema = z.object({
  file: z.instanceof(File),
  material: z.string(),
  colour: z.string().optional(),
  layer_height: z.string(),
  infill: z.number().min(0).max(100),
  walls: z.number().min(0),
  supports: z.boolean(),
  scale: z.number().min(1),
  quantity: z.number().min(1),
  turnaround: z.enum(['standard', 'fast']),
  postcode: z.string().optional(),
  notes: z.string().optional()
});

// Keep form values untyped here to avoid type mismatches with installed libs
// (we use runtime Zod validation via the resolver)

export default function NewQuote() {
  const sb = supabase;
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema as any) });
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [materials, setMaterials] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<{grams:number,timeSeconds:number,price:number}|null>(null)

  useEffect(() => {
    // restore draft if present (optional for UX)
    const draft = localStorage.getItem('quote_draft')
    if (draft) {
      // we could parse and prefill fields; skipping for brevity
    }
    // load active inventory items
    ;(async function(){
      try{
        const { data } = await sb.from('inventory_items').select('*').eq('is_active', true)
        setMaterials(data || [])
      }catch(e){ console.error('load materials', e) }
    })()
  }, [])

  async function onSubmit(values: any) {
    setLoading(true);
    // check session
    const session = await sb?.auth.getSession();
    const user = session?.data?.session?.user || null;
    if (!user) {
      // Not logged in: save draft and show auth panel
      try {
        localStorage.setItem('quote_draft', JSON.stringify(values));
      } catch (e) { console.error('draft save failed', e) }
      setLoading(false);
      setShowAuth(true);
      return;
    }
    // upload file to storage under user_id/quote_id
    const quoteId = crypto.randomUUID();
    const file = values.file[0];
    const owner = user?.id || 'guest';
    const path = `${owner}/${quoteId}/${file.name}`;
    if (!sb) {
      alert('Storage client not configured');
      setLoading(false);
      return;
    }
    const { data, error } = await sb.storage.from('models').upload(path, file as File);
    if (error) {
      alert('upload failed');
      setLoading(false);
      return;
    }

    // create payment intent via server API
    const token = session?.data?.session?.access_token;
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/quotes/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ quoteId, path, originalName: file.name, mime: file.type, size: file.size, settings: values, inventory_item_id: selectedItem })
    });
    const j = await res.json();
    if (!res.ok) {
      alert('Quote creation failed');
      setLoading(false);
      return;
    }

    // redirect to quote detail
    window.location.href = `/quotes/${quoteId}`;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if (!f) return
    if (!selectedItem) return alert('Select a material first to estimate')
    const tempId = crypto.randomUUID()
    const tempPath = `temp/${tempId}/${f.name}`
    try{
      const up = await sb.storage.from('models').upload(tempPath, f as File)
      if (up.error) throw up.error
      const res = await fetch('/api/estimates', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: tempPath, inventory_item_id: selectedItem }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'estimate failed')
      setEstimate({ grams: j.grams, timeSeconds: j.timeSeconds, price: j.price })
    }catch(err){ console.error('estimate', err); alert('Estimate failed: '+String(err)) }
  }

  // Called after successful auth to continue submission
  async function continueAfterAuth() {
    const draft = localStorage.getItem('quote_draft');
    if (!draft) {
      setShowAuth(false);
      return;
    }
    try {
      const values = JSON.parse(draft);
      setShowAuth(false);
      // small delay to allow modal to close
      setTimeout(() => handleSubmit(onSubmit)(values), 200);
    } catch (e) {
      console.error('failed restoring draft', e);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">New Quote</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input onChange={handleFileChange} type="file" {...register('file' as any)} accept=".stl,.3mf,.obj" />
        <select value={selectedItem || ''} onChange={(e)=>{ setSelectedItem(e.target.value); }} className="border p-2 rounded">
          <option value="">Select material</option>
          {materials.map(m=> (
            <option key={m.id} value={m.id}>{m.material} — {m.colour} (In stock: {m.grams_available - m.grams_reserved} g)</option>
          ))}
        </select>
        <input placeholder="Colour" {...register('colour' as any)} className="border p-2 rounded w-full" />
        <input type="number" placeholder="Infill %" {...register('infill' as any)} className="border p-2 rounded w-full" />
        <input type="number" placeholder="Quantity" {...register('quantity' as any)} className="border p-2 rounded w-full" defaultValue={1} />
        <select {...register('turnaround' as any)} className="border p-2 rounded">
          <option value="standard">Standard</option>
          <option value="fast">Fast</option>
        </select>
        <textarea placeholder="Notes" {...register('notes' as any)} className="border p-2 rounded w-full" />
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded" disabled={loading}>{loading? 'Submitting...' : 'Submit (authorise card)'}</button>
        {estimate && (
          <div className="mt-3 p-3 border rounded bg-gray-50">
            <div>Estimated filament: <strong>{estimate.grams} g</strong></div>
            <div>Estimated print time: <strong>{Math.round(estimate.timeSeconds/60)} min</strong></div>
            <div>Estimated price: <strong>£{(estimate.price/100).toFixed(2)}</strong></div>
          </div>
        )}
      </form>
      {showAuth && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Please sign in to continue</h3>
            <AuthCard onSuccess={continueAfterAuth} />
            <div className="mt-3 text-sm text-gray-500">Or continue as guest by logging in later.</div>
            <button type="button" className="mt-4 text-sm text-gray-600" onClick={() => setShowAuth(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
