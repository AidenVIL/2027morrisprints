import express from 'express';
import quotesRouter from './express/quotes';
import sliceJobsRouter from './express/sliceJobs';
import webhookRouter from './express/webhook';

const app = express();

// Mount webhook router before body parsers so raw body is available for signature verification
app.use(webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(quotesRouter);
app.use(sliceJobsRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = Number(process.env.SERVER_PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Express server listening on port ${port}`);
});

export default app;
