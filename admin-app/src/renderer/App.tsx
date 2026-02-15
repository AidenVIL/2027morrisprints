import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(r => setUser(r.data.session?.user ?? null));
  }, []);

  async function signIn(email: string) {
    await supabase.auth.signInWithOtp({ email });
    alert('Check email for magic link');
  }

  async function loadQuotes() {
    if (!user) return alert('Sign in first');
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/admin/quotes`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    setQuotes(j);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Admin App</h1>
      {!user ? (
        <div className="mt-4">
          <input id="email" className="border p-2" placeholder="admin@example.com" />
          <button onClick={() => signIn((document.getElementById('email') as HTMLInputElement).value)} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">Send Magic Link</button>
        </div>
      ) : (
        <div className="mt-4">
          <p>Signed in as {user.email}</p>
          <button onClick={loadQuotes} className="mt-2 px-3 py-1 bg-green-600 text-white rounded">Load Quotes</button>
        </div>
      )}

      <div className="mt-6">
        {quotes.map(q => (
          <div key={q.id} className="p-3 border rounded mb-2">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{q.file_original_name}</div>
                <div className="text-sm">Status: {q.status}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
