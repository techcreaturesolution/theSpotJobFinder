import { Router } from 'express';
import mongoose from 'mongoose';
import { isAdLocked } from '../models/adGate.js';
import { JobSearch } from '../models/JobSearch.js';
import { verifierKeys, verifySsv } from '../services/admobSsv.js';

const router = Router();

// Callback URL for AdMob rewarded ads (AdMob → Ad unit → Server-side verification). custom_data = job search ID.
router.get('/ssv', async (req, res) => {
  const rawQuery = req.originalUrl.split('?')[1] || '';
  if (!rawQuery.includes('signature=')) return res.json({ ok: true });
  let params = verifySsv(rawQuery, await verifierKeys());
  if (!params) params = verifySsv(rawQuery, await verifierKeys({ refresh: true }));
  if (!params) return res.status(400).json({ error: 'Invalid signature' });

  const searchId = params.custom_data;
  if (!mongoose.isValidObjectId(searchId) || !mongoose.isValidObjectId(params.user_id)) return res.json({ ok: true, ignored: true });
  const search = await JobSearch.findOne({ _id: searchId, owner: params.user_id });
  if (!search || !isAdLocked(search)) return res.json({ ok: true });
  if (await JobSearch.exists({ 'adGate.transactionId': params.transaction_id })) return res.json({ ok: true, duplicate: true });
  search.adGate.completedAt = new Date();
  search.adGate.method = 'admob';
  search.adGate.transactionId = params.transaction_id;
  await search.save();
  res.json({ ok: true });
});

export default router;
