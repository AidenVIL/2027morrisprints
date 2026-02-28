import express, { Request, Response } from 'express';
import { stripe } from '../../lib/stripe';
import { ensureSupabaseAdmin } from '../../lib/supabaseClient';

const router = express.Router();

// Stripe webhook - raw body required for signature verification
router.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = (req.headers['stripe-signature'] || '') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('webhook not configured');
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: any) {
    console.error('stripe webhook signature verification failed', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || err}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const quoteId = metadata.quote_id || metadata.quoteId || null;

      if (quoteId) {
        try {
          const supabase = ensureSupabaseAdmin();
          await supabase.from('quotes').update({ status: 'paid' }).eq('id', quoteId);
          console.info('Quote marked paid:', quoteId);
        } catch (e) {
          console.error('failed updating quote to paid', e);
        }
      }
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (e) {
    console.error('webhook processing error', e);
    res.status(500).send('server error');
  }
});

export default router;
