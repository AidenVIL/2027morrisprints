import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ensureSupabaseAdmin } from '../../lib/supabaseClient';
import jwt from 'jsonwebtoken';
import { stripe } from '../../lib/stripe';
import crypto from 'crypto';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/api/quotes', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const supabase = ensureSupabaseAdmin();

    const authHeader = (req.headers.authorization || '') as string;
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
    const token = authHeader.replace('Bearer ', '');

    const { data: userData } = await supabase.auth.getUser(token as string);
    const user = userData?.user;
    if (!user) return res.status(401).json({ error: 'invalid token' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'missing file' });

    const originalName = file.originalname || `upload-${crypto.randomUUID()}`;
    const quoteId = crypto.randomUUID();
    const storagePath = `models/quotes/${quoteId}/${originalName}`;

    // Attempt upload, create bucket if missing and retry
    let uploadResult = await supabase.storage.from('models').upload(storagePath, file.buffer, { upsert: true, contentType: file.mimetype });
    if (uploadResult.error) {
      const em = String(uploadResult.error.message || uploadResult.error).toLowerCase();
      if (em.includes('bucket') || em.includes('bucket not found')) {
        const create = await supabase.storage.createBucket('models', { public: false });
        if (create.error) return res.status(500).json({ error: create.error.message || String(create.error) });
        uploadResult = await supabase.storage.from('models').upload(storagePath, file.buffer, { upsert: true, contentType: file.mimetype });
        if (uploadResult.error) return res.status(500).json({ error: uploadResult.error.message || String(uploadResult.error) });
      } else {
        return res.status(500).json({ error: uploadResult.error.message || String(uploadResult.error) });
      }
    }

    // parse fields from body
    const body: any = req.body || {};
    const material = body.material || 'unknown';
    const layer_height = body.layer_height ? Number(body.layer_height) : null;
    const infill_percent = body.infill_percent ? parseInt(body.infill_percent, 10) : null;
    const supports_enabled = body.supports_enabled === 'true' || body.supports_enabled === true;

    // insert quote row
    const quoteRow: any = {
      id: quoteId,
      user_id: user.id,
      file_url: storagePath,
      original_filename: originalName,
      material,
      layer_height,
      infill_percent,
      supports_enabled,
      status: 'estimated'
    };

    const { error: insertErr } = await supabase.from('quotes').insert(quoteRow);
    if (insertErr) {
      console.error('failed inserting quote', insertErr);
      return res.status(500).json({ error: insertErr.message || String(insertErr) });
    }

    // create slice_jobs entry
    const settings = body.settings ? (typeof body.settings === 'string' ? JSON.parse(body.settings) : body.settings) : {};
    const { error: sjErr } = await supabase.from('slice_jobs').insert({ quote_id: quoteId, status: 'pending', settings_json: settings });
    if (sjErr) {
      console.error('failed inserting slice_job', sjErr);
      // not fatal for the quote; still return quote id but log the error
    }

    return res.json({ quote_id: quoteId });
  } catch (e: any) {
    console.error('express /api/quotes error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /api/quotes/:id/create-checkout
router.post('/api/quotes/:id/create-checkout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'missing id' });

    const supabase = ensureSupabaseAdmin();
    const { data: quote, error: qErr } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
    if (qErr) return res.status(500).json({ error: qErr.message || String(qErr) });
    if (!quote) return res.status(404).json({ error: 'quote not found' });

    // determine amount from quote.total_price or fallbacks
    let amountPence = 0;
    if (quote.total_price) amountPence = Math.round(Number(quote.total_price) * 100);
    else if (quote.price_total_pence) amountPence = Number(quote.price_total_pence);
    else if (quote.price_pence) amountPence = Number(quote.price_pence);
    else if (quote.price_total) amountPence = Math.round(Number(quote.price_total) * 100);

    if (!amountPence || amountPence <= 0) return res.status(400).json({ error: 'invalid quote amount' });

    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || '';
    const successUrl = site ? `${site.replace(/\/$/,'')}/quote/success?session_id={CHECKOUT_SESSION_ID}` : '{CHECKOUT_SESSION_ID}';
    const cancelUrl = site ? `${site.replace(/\/$/,'')}/quote/cancel` : '/';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: `Quote ${id}` },
            unit_amount: amountPence
          },
          quantity: 1
        }
      ],
      metadata: { quote_id: String(id), quote_version: String(quote.quote_version || 1) },
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return res.json({ ok: true, session });
  } catch (e: any) {
    console.error('create-checkout error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

    // POST /api/quotes/:id/approve
    // Body: { changes_requested?: boolean, changes?: object }
    router.post('/api/quotes/:id/approve', async (req: Request, res: Response) => {
      try {
        const apiKey = (req.headers['x-api-key'] || req.headers['api-key'] || '') as string;
        const expected = process.env.ADMIN_API_KEY || '';
        if (!apiKey || apiKey !== expected) return res.status(401).json({ error: 'invalid api key' });

        const supabase = ensureSupabaseAdmin();
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'missing id' });

        const body: any = req.body || {};
        const changesRequested = Boolean(body.changes_requested || body.changes);

        // fetch quote
        const { data: quote, error: qErr } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
        if (qErr) return res.status(500).json({ error: qErr.message || String(qErr) });
        if (!quote) return res.status(404).json({ error: 'quote not found' });

        if (!changesRequested) {
          // set status = 'final_quote_ready'
          const { error: updErr } = await supabase.from('quotes').update({ status: 'final_quote_ready' }).eq('id', id);
          if (updErr) console.error('failed updating quote status to final_quote_ready', updErr);

          // create signed JWT approval token
          const jwtSecret = process.env.JWT_SECRET || process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
          const tokenPayload = { quote_id: id, quote_version: quote.quote_version || 1 } as any;
          const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });

          // build approval link
          const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const approvalUrl = site ? `${site.replace(/\/$/,'')}/quote/review?token=${encodeURIComponent(token)}` : `/?quote=${id}&token=${encodeURIComponent(token)}`;

          // determine recipient email
          let toEmail: string | null = null;
          if (quote.customer_email) toEmail = quote.customer_email;
          else if (quote.user_id) {
            try {
              const { data: udata } = await supabase.from('auth.users').select('email').eq('id', quote.user_id).maybeSingle();
              if (udata && (udata as any).email) toEmail = (udata as any).email;
            } catch (e) {
              console.error('failed fetching user email', e);
            }
          }

          // send email via Resend if configured
          try {
            const RESEND_API_KEY = process.env.RESEND_API_KEY;
            const RESEND_FROM = process.env.RESEND_FROM || `no-reply@${(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/^https?:\/\//,'')}`;
            if (RESEND_API_KEY && toEmail) {
              const bodyText = `Your quote ${id} is ready. Review and pay here: ${approvalUrl}`;
              const payload = {
                from: RESEND_FROM,
                to: [toEmail],
                subject: `Quote ${id} ready for approval`,
                text: bodyText
              };
              const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
                body: JSON.stringify(payload)
              });
              if (!resp.ok) console.warn('resend email failed', await resp.text());
            } else {
              console.info('Resend or recipient not configured; skipping approval email');
            }
          } catch (e) {
            console.error('failed sending approval email', e);
          }

          return res.json({ ok: true, status: 'final_quote_ready', approvalUrl });
        }

        // changes requested: increment quote_version, create new slice_job, set status = 'reslicing'
        try {
          const { data: updated, error: verErr } = await supabase.from('quotes').update({ quote_version: (quote.quote_version || 1) + 1, status: 'reslicing' }).eq('id', id).select('*').maybeSingle();
          if (verErr) console.error('failed incrementing quote_version', verErr);

          const settings = body.changes?.settings || quote.settings_json || {};
          const { error: sj } = await supabase.from('slice_jobs').insert({ quote_id: id, status: 'pending', settings_json: settings });
          if (sj) console.error('failed creating new slice_job for reslice', sj);

          return res.json({ ok: true, status: 'reslicing' });
        } catch (e: any) {
          console.error('approve (changes) error', e);
          return res.status(500).json({ error: e?.message || String(e) });
        }
      } catch (e: any) {
        console.error('approve route error', e);
        return res.status(500).json({ error: e?.message || String(e) });
      }
    });

    // GET /quote/review?token=JWT
    router.get('/quote/review', async (req: Request, res: Response) => {
      try {
        const token = (req.query.token as string) || '';
        if (!token) return res.status(400).send('missing token');

        const jwtSecret = process.env.JWT_SECRET || process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        let payload: any;
        try {
          payload = jwt.verify(token, jwtSecret) as any;
        } catch (e) {
          return res.status(400).send('invalid or expired token');
        }

        const { quote_id, quote_version } = payload || {};
        if (!quote_id) return res.status(400).send('invalid token payload');

        const supabase = ensureSupabaseAdmin();
        const { data: quote, error: qErr } = await supabase.from('quotes').select('*').eq('id', quote_id).maybeSingle();
        if (qErr) return res.status(500).send('db error');
        if (!quote) return res.status(404).send('quote not found');

        // confirm version matches
        const currentVersion = quote.quote_version || quote.quoteVersion || 1;
        if (Number(currentVersion) !== Number(quote_version)) {
          return res.status(400).send('quote version mismatch');
        }

        // determine price in pence (integer)
        let amountPence = 0;
        if (quote.price_total_pence) amountPence = Number(quote.price_total_pence);
        else if (quote.price_pence) amountPence = Number(quote.price_pence);
        else if (quote.total_price) amountPence = Math.round(Number(quote.total_price) * 100);
        else if (quote.price_total) amountPence = Math.round(Number(quote.price_total) * 100);
        else if (quote.price_total_gbp) amountPence = Math.round(Number(quote.price_total_gbp) * 100);

        if (!amountPence || amountPence <= 0) return res.status(400).send('invalid quote amount');

        // create Stripe Checkout Session
        const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || '';
        const successUrl = site ? `${site.replace(/\/$/,'')}/quote/success?session_id={CHECKOUT_SESSION_ID}` : '{CHECKOUT_SESSION_ID}';
        const cancelUrl = site ? `${site.replace(/\/$/,'')}/quote/cancel` : '/';

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                product_data: { name: `Quote ${quote_id}` },
                unit_amount: amountPence
              },
              quantity: 1
            }
          ],
          metadata: { quote_id: String(quote_id), quote_version: String(quote_version) },
          success_url: successUrl,
          cancel_url: cancelUrl
        });

        if (session.url) return res.redirect(303, session.url);
        return res.status(500).send('failed creating stripe session');
      } catch (e: any) {
        console.error('quote review error', e);
        return res.status(500).send('server error');
      }
    });

export default router;
