'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function QuoteDetail({ params }: { params: { id: string } }) {
  const [quote, setQuote] = useState<any>(null);
  const sb = supabase;

  useEffect(() => {
    async function load() {
      const { data } = await sb.from('quote_requests').select('*').eq('id', params.id).single();
      setQuote(data);
    }
    load();
  }, [params.id]);

  if (!quote) return <div className="p-6">Loading...</div>;
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-semibold">Quote {quote.id}</h2>
      <p>Status: {quote.status}</p>
      <p>File: {quote.file_original_name}</p>
      <p>Quantity: {quote.quantity}</p>
      <p>Notes: {quote.notes}</p>
    </div>
  );
}
