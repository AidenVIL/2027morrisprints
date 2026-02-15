 'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AuthPage() {
  const sb = supabase;
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === 'signin') {
      await sb.auth.signInWithOtp({ email });
      alert('Check your email for a magic link.');
    } else {
      await sb.auth.signUp({ email });
      alert('Check your email to confirm signup.');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">{mode === 'signin' ? 'Sign in' : 'Sign up'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <div className="flex items-center gap-2">
          <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Please wait' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
          <button type="button" onClick={() => setMode(mode==='signin'?'signup':'signin')} className="text-sm text-gray-600">{mode==='signin'?'Create account':'Have an account?'}</button>
        </div>
      </form>
    </div>
  );
}
