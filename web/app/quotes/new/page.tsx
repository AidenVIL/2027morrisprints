 'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../../lib/supabaseClient';

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

  async function onSubmit(values: any) {
    setLoading(true);
    // upload file to storage under user_id/quote_id if signed in, otherwise under 'guest'
    const quoteId = crypto.randomUUID();
    const file = values.file[0];
    const session = await sb?.auth.getSession();
    const user = session?.data?.session?.user || null;
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
      body: JSON.stringify({ quoteId, path, originalName: file.name, mime: file.type, size: file.size, settings: values })
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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">New Quote</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="file" {...register('file' as any)} accept=".stl,.3mf,.obj" />
        <select {...register('material' as any)} className="border p-2 rounded">
          <option value="PLA">PLA</option>
          <option value="PETG">PETG</option>
          <option value="ABS">ABS</option>
        </select>
        <input placeholder="Colour" {...register('colour' as any)} className="border p-2 rounded w-full" />
        <input type="number" placeholder="Infill %" {...register('infill' as any)} className="border p-2 rounded w-full" />
        <input type="number" placeholder="Quantity" {...register('quantity' as any)} className="border p-2 rounded w-full" defaultValue={1} />
        <select {...register('turnaround' as any)} className="border p-2 rounded">
          <option value="standard">Standard</option>
          <option value="fast">Fast</option>
        </select>
        <textarea placeholder="Notes" {...register('notes' as any)} className="border p-2 rounded w-full" />
        <button className="px-4 py-2 bg-green-600 text-white rounded" disabled={loading}>{loading? 'Submitting...' : 'Submit (authorise card)'}</button>
      </form>
    </div>
  );
}
