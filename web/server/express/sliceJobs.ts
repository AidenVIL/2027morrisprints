import { Router, Request, Response } from 'express';
import { ensureSupabaseAdmin } from '../../lib/supabaseClient';

const router = Router();

// GET /api/slice-jobs/next
// Requires header `x-api-key: <key>` matching SLICE_WORKER_API_KEY
router.get('/api/slice-jobs/next', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-api-key'] || req.headers['api-key'] || req.headers['authorization'];
    const expected = process.env.SLICE_WORKER_API_KEY || '';
    if (!key || String(key) !== expected) {
      return res.status(401).json({ error: 'invalid api key' });
    }

    const supabase = ensureSupabaseAdmin();

    // Atomically select the oldest pending job and update to 'processing'
    // Use a transaction-like approach with RETURNING via RPC or CTE
    const sql = `
      WITH next_job AS (
        SELECT id FROM public.slice_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE public.slice_jobs s
      SET status = 'processing'
      FROM next_job
      WHERE s.id = next_job.id
      RETURNING s.*;
    `;

    const { data, error } = await supabase.rpc('sql', { q: sql } as any).catch(() => ({ data: null, error: new Error('rpc-failed') }));

    // Note: Supabase JS client doesn't expose a general SQL exec RPC by default; if the above RPC is not available,
    // fall back to selecting then updating with optimistic lock.
    if (error || !data) {
      // Fallback: select oldest pending, then attempt to update where status = 'pending'
      const { data: sel, error: selErr } = await supabase.from('slice_jobs').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (selErr) return res.status(500).json({ error: selErr.message || String(selErr) });
      if (!sel) return res.json({ ok: true, job: null });

      const { data: up, error: upErr } = await supabase.from('slice_jobs').update({ status: 'processing' }).eq('id', sel.id).eq('status', 'pending').select('*').maybeSingle();
      if (upErr) return res.status(500).json({ error: upErr.message || String(upErr) });
      if (!up) return res.json({ ok: true, job: null });
      return res.json({ ok: true, job: up });
    }

    // If RPC returned rows, return the first
    if (Array.isArray(data) && data.length > 0) {
      return res.json({ ok: true, job: data[0] });
    }

    return res.json({ ok: true, job: null });
  } catch (e: any) {
    console.error('slice-jobs/next error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /api/slice-jobs/:id/result
// Body: { estimated_time_seconds, estimated_weight_grams }
router.post('/api/slice-jobs/:id/result', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-api-key'] || req.headers['api-key'] || req.headers['authorization'];
    const expected = process.env.SLICE_WORKER_API_KEY || '';
    if (!key || String(key) !== expected) {
      return res.status(401).json({ error: 'invalid api key' });
    }

    const supabase = ensureSupabaseAdmin();
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'missing id' });

    const body: any = req.body || {};
    const estimated_time_seconds = body.estimated_time_seconds ?? null;
    const estimated_weight_grams = body.estimated_weight_grams ?? null;

    // Fetch the slice_job to get quote_id
    const { data: job, error: jobErr } = await supabase.from('slice_jobs').select('*').eq('id', id).maybeSingle();
    if (jobErr) return res.status(500).json({ error: jobErr.message || String(jobErr) });
    if (!job) return res.status(404).json({ error: 'slice_job not found' });

    // Update slice_jobs status to 'completed' and set completed_at
    const { data: updatedJob, error: updErr } = await supabase.from('slice_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
    if (updErr) return res.status(500).json({ error: updErr.message || String(updErr) });

    // Update related quote: estimated_time_seconds, estimated_weight_grams and status -> 'needs_review'
    const quoteId = job.quote_id;
    if (quoteId) {
      const quoteUpdate: any = { status: 'needs_review' };
      if (estimated_time_seconds !== null) quoteUpdate.estimated_time_seconds = estimated_time_seconds;
      if (estimated_weight_grams !== null) quoteUpdate.estimated_weight_grams = estimated_weight_grams;

      const { error: qErr } = await supabase.from('quotes').update(quoteUpdate).eq('id', quoteId);
      if (qErr) {
        console.error('failed updating quote after slice job result', qErr);
        // don't fail the request; return partial success
      }
    }

    return res.json({ ok: true, job: updatedJob });
  } catch (e: any) {
    console.error('slice-jobs/result error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
