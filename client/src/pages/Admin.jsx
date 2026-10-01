import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { getAdsenseConfig } from '../lib/adsense.js';
import JobForm from '../components/JobForm.jsx';
import { detailsMsg, EMPTY_JOB, jobBody } from '../lib/jobForm.js';

const METHOD_LABEL = {
  json_ld: 'Read from the job page’s structured data',
  ai_agent: 'Extracted by the AI agent (only facts written in the post)',
  ai_agent_empty: 'AI found no job in the text; filled with pattern matching',
  rules: 'Filled with pattern matching (set OPENAI_API_KEY for the AI agent)',
};

function AiImport({ onReview, onPosted }) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [posted, setPosted] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const extract = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    setPosted({});
    try {
      const { data } = await api.post('/admin/jobs/extract', { text, url });
      setResult(data);
    } catch (err) {
      setError(detailsMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const ready = (d) => !d.missing.length && !d.duplicate && !d.closed;
  const postReady = async () => {
    setBusy(true);
    setError('');
    const next = { ...posted };
    for (const [i, d] of result.drafts.entries()) {
      if (!ready(d) || next[i]) continue;
      try {
        await api.post('/admin/jobs', jobBody({ ...EMPTY_JOB, ...d }));
        next[i] = 'posted';
      } catch (err) {
        next[i] = detailsMsg(err);
      }
    }
    setPosted(next);
    setBusy(false);
    onPosted();
  };

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold">Post jobs with AI</h3>
        <p className="text-sm text-slate-500">
          Paste a job advert (WhatsApp, X, LinkedIn, Facebook, newspaper or email text) or a company job page link. The AI fills the job form using only facts written in
          the advert; check each job, then post it.
        </p>
      </div>
      <form onSubmit={extract} className="space-y-2">
        <textarea className="input" rows={5} placeholder="Paste the job post text here…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1" type="url" placeholder="or job page link: https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn-primary" disabled={busy || (text.trim().length < 30 && !url)}>
            {busy && !result ? 'Reading…' : 'Extract job details'}
          </button>
        </div>
      </form>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {result && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">
            {result.drafts.length} job{result.drafts.length === 1 ? '' : 's'} found · {METHOD_LABEL[result.method] || result.method}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Job</th>
                  <th className="th">Location</th>
                  <th className="th">Contact / apply</th>
                  <th className="th">Check</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.drafts.map((d, i) => (
                  <tr key={`${d.title}-${i}`}>
                    <td className="td">
                      <div className="font-medium">{d.title || '—'}</div>
                      <div className="text-xs text-slate-500">{d.companyName || 'Company not written in the post'}</div>
                    </td>
                    <td className="td text-xs">{[d.city, d.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="td text-xs">{[d.email, d.phone, d.applyUrl].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="td text-xs">
                      {posted[i] === 'posted' ? (
                        <span className="badge bg-green-100 text-green-700">posted</span>
                      ) : posted[i] ? (
                        <span className="text-red-600">{posted[i]}</span>
                      ) : d.duplicate ? (
                        <span className="badge bg-amber-100 text-amber-800">already posted</span>
                      ) : d.closed ? (
                        <span className="badge bg-amber-100 text-amber-800">closed / expired</span>
                      ) : d.missing.length ? (
                        <span className="badge bg-amber-100 text-amber-800">needs {d.missing.join(', ')}</span>
                      ) : (
                        <span className="badge bg-green-100 text-green-700">ready</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-right text-xs">
                      {posted[i] !== 'posted' && (
                        <button type="button" className="text-blue-700" onClick={() => onReview({ ...EMPTY_JOB, ...d, category: d.category || EMPTY_JOB.category })}>
                          Review &amp; post
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.drafts.some((d, i) => ready(d) && !posted[i]) && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={postReady}>
              {busy ? 'Posting…' : `Post all ready jobs (${result.drafts.filter((d, i) => ready(d) && !posted[i]).length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_RULE = { name: '', prompt: '', category: '', level: '', education: '', state: '', city: '', everyHours: 24, maxJobs: 10, active: true };

function AutoImport({ meta, onPosted }) {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(null);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const load = () =>
    api
      .get('/admin/auto-import')
      .then((r) => setRules(r.data.items))
      .catch((e) => setError(errMsg(e)));
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const body = Object.fromEntries(Object.keys(EMPTY_RULE).map((k) => [k, form[k] ?? EMPTY_RULE[k]]));
    try {
      if (form._id) await api.put(`/admin/auto-import/${form._id}`, body);
      else await api.post('/admin/auto-import', body);
      setForm(null);
      load();
    } catch (err) {
      setError(detailsMsg(err));
    }
  };

  const run = async (id) => {
    setRunning(id);
    setError('');
    try {
      await api.post(`/admin/auto-import/${id}/run`);
      onPosted();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setRunning('');
      load();
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this auto-import rule? Jobs it already posted stay.')) return;
    await api.delete(`/admin/auto-import/${id}`).catch((e) => setError(errMsg(e)));
    load();
  };

  const select = (k, label, options) => (
    <label className="text-sm">
      {label}
      <select className="input mt-1" value={form[k] || ''} onChange={set(k)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        The AI agent searches Google Jobs, company sites and job portals on a schedule and posts matching jobs here automatically. Only jobs confirmed on their source page,
        still open, with a company name and an apply link or HR email are posted. Jobs already on the portal (same title, company and city, or the same source page) are
        skipped, and every imported job’s source page is re-checked on each search.
      </p>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {form ? (
        <form onSubmit={save} className="card grid gap-3 md:grid-cols-3">
          <h3 className="font-semibold md:col-span-3">{form._id ? 'Edit auto-import rule' : 'New auto-import rule'}</h3>
          <label className="text-sm">
            Rule name
            <input className="input mt-1" required value={form.name} onChange={set('name')} placeholder="e.g. Ahmedabad accountants" />
          </label>
          <label className="text-sm">
            Job keywords
            <input className="input mt-1" value={form.prompt} onChange={set('prompt')} placeholder="e.g. accountant, telecaller" />
          </label>
          {select('category', 'Category', [['', 'Any'], ...(meta?.categories || []).map((c) => [c.key, c.label])])}
          {select('level', 'Fresher / experienced', [['', 'Both'], ['fresher', 'Fresher'], ['experienced', 'Experienced']])}
          {select('education', 'Education', [['', 'Any'], ...(meta?.education || []).map((c) => [c.key, c.label])])}
          {select('state', 'State', [['', 'All India'], ...(meta?.states || []).map((st) => [st, st])])}
          <label className="text-sm">
            City
            <input className="input mt-1" value={form.city} onChange={set('city')} />
          </label>
          {select('everyHours', 'Run every', [[1, 'Hour'], [6, '6 hours'], [12, '12 hours'], [24, 'Day'], [72, '3 days'], [168, 'Week']])}
          <label className="text-sm">
            Max new jobs per run
            <input className="input mt-1" type="number" min={1} max={30} value={form.maxJobs} onChange={set('maxJobs')} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
          </label>
          <div className="flex justify-end gap-2 md:col-span-3">
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn-primary">Save rule</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setForm(EMPTY_RULE)}>
          + New auto-import rule
        </button>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Rule</th>
              <th className="th">Search</th>
              <th className="th">Schedule</th>
              <th className="th">Last run</th>
              <th className="th">Posted</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => (
              <tr key={r._id}>
                <td className="td">
                  <div className="font-medium">{r.name}</div>
                  <span className={`badge ${r.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.active ? 'active' : 'paused'}</span>
                </td>
                <td className="td text-xs">
                  {[r.prompt, meta?.categories.find((c) => c.key === r.category)?.label, r.level, meta?.education.find((c) => c.key === r.education)?.label, r.city, r.state || 'All India']
                    .filter(Boolean)
                    .join(' · ')}
                </td>
                <td className="td text-xs">
                  every {r.everyHours}h · up to {r.maxJobs}
                </td>
                <td className="td text-xs">
                  {running === r._id || r.runningSince ? (
                    'Running…'
                  ) : r.lastRunAt ? (
                    <>
                      {new Date(r.lastRunAt).toLocaleString()}
                      <div className={r.lastRun?.status === 'failed' ? 'text-red-600' : 'text-slate-500'}>
                        {r.lastRun?.status === 'failed'
                          ? r.lastRun.error
                          : `${r.lastRun?.found ?? 0} found · ${r.lastRun?.posted ?? 0} posted · ${r.lastRun?.duplicates ?? 0} already posted · ${r.lastRun?.skipped ?? 0} not verified/incomplete`}
                      </div>
                    </>
                  ) : (
                    'Never'
                  )}
                </td>
                <td className="td">{r.totalPosted}</td>
                <td className="td whitespace-nowrap text-right text-xs">
                  <button type="button" className="mr-3 text-blue-700 disabled:text-slate-400" disabled={Boolean(running)} onClick={() => run(r._id)}>
                    Run now
                  </button>
                  <button type="button" className="mr-3 text-blue-700" onClick={() => setForm({ ...EMPTY_RULE, ...r })}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600" onClick={() => remove(r._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!rules.length && (
              <tr>
                <td className="td py-8 text-center text-slate-500" colSpan={6}>
                  No auto-import rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REVIEW_BADGE = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

function EmployerJobs({ onChanged }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api
      .get('/admin/employer-jobs', { params: { status } })
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, [status]);
  useEffect(load, [load]);

  const review = async (job, action) => {
    const note = action === 'reject' ? window.prompt('Why is this job rejected? The employer will see this note.') : '';
    if (note === null) return;
    try {
      await api.post(`/admin/jobs/${job._id}/review`, { action, note: note || '' });
      setError('');
      load();
      onChanged();
    } catch (e) {
      setError(detailsMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Review status">
          <option value="pending">Waiting for review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All employer jobs</option>
        </select>
        <span className="text-xs text-slate-500">Check each job against the employer’s company before approving. Only approved jobs appear in searches.</span>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Job</th>
              <th className="th">Employer</th>
              <th className="th">Location</th>
              <th className="th">How to apply</th>
              <th className="th">Status</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((j) => [
              <tr key={j._id}>
                <td className="td">
                  <button type="button" className="text-left font-medium text-blue-700" onClick={() => setOpen(open === j._id ? null : j._id)}>
                    {j.title}
                  </button>
                  <div className="text-xs text-slate-500">
                    {j.companyName} · {j.level || 'fresher & experienced'} · submitted {new Date(j.updatedAt).toLocaleString()}
                  </div>
                </td>
                <td className="td text-xs">
                  <div>{j.postedBy?.name}</div>
                  <div className="text-slate-500">{j.postedBy?.email}</div>
                  {j.postedBy?.phone && <div className="text-slate-500">+91 {j.postedBy.phone}</div>}
                  {j.postedBy?.company?.website && (
                    <a className="text-blue-700" href={j.postedBy.company.website} target="_blank" rel="noreferrer">
                      {j.postedBy.company.website}
                    </a>
                  )}
                </td>
                <td className="td text-xs">{[j.city, j.state].filter(Boolean).join(', ')}</td>
                <td className="td text-xs">
                  {j.applyUrl && (
                    <a className="block text-blue-700" href={j.applyUrl} target="_blank" rel="noreferrer">
                      Apply link
                    </a>
                  )}
                  {j.emails?.[0] && <div>{j.emails[0]}</div>}
                  {j.phones?.[0] && <div>{j.phones[0]}</div>}
                </td>
                <td className="td text-xs">
                  <span className={`badge ${REVIEW_BADGE[j.review?.status] || 'bg-slate-100 text-slate-500'}`}>{j.review?.status}</span>
                  {!j.active && j.review?.status === 'approved' && <div className="text-slate-400">closed by employer</div>}
                  {j.review?.note && <div className="text-slate-500">{j.review.note}</div>}
                </td>
                <td className="td whitespace-nowrap text-right text-xs">
                  {j.review?.status !== 'approved' && (
                    <button type="button" className="mr-3 text-green-700" onClick={() => review(j, 'approve')}>
                      Approve
                    </button>
                  )}
                  {j.review?.status !== 'rejected' && (
                    <button type="button" className="text-red-600" onClick={() => review(j, 'reject')}>
                      Reject
                    </button>
                  )}
                </td>
              </tr>,
              open === j._id && (
                <tr key={`${j._id}-d`}>
                  <td className="td bg-slate-50 text-sm whitespace-pre-line" colSpan={6}>
                    {j.description}
                    <div className="mt-2 text-xs text-slate-500">
                      {[j.experienceText, j.salary, j.employmentType, j.validThrough && `Apply by ${new Date(j.validThrough).toLocaleDateString()}`, j.address].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                </tr>
              ),
            ])}
            {!items.length && (
              <tr>
                <td className="td py-8 text-center text-slate-500" colSpan={6}>
                  No employer jobs here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdsenseStatus() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    getAdsenseConfig().then(setConfig);
  }, []);
  if (!config) return null;
  const slots = Object.entries(config.slots || {});
  return (
    <div className="card text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">Google AdSense</div>
        <span className={`badge ${config.client ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {config.client ? `Live · ${config.client}${config.testMode ? ' (test mode)' : ''}` : 'Not configured · demo ads shown'}
        </span>
      </div>
      <p className="mt-1 text-slate-500">
        AdSense runs on user pages (job search, login) and never on Admin. Set <code>ADSENSE_CLIENT_ID</code> and the{' '}
        <code>ADSENSE_SLOT_*</code> ad unit IDs in <code>server/.env</code>.
      </p>
      <p className="mt-1 text-slate-500">
        Mobile app (Google AdMob): banner {config.admob?.android?.banner || config.admob?.ios?.banner ? 'configured' : 'test unit'} · rewarded video{' '}
        {config.admob?.android?.rewarded || config.admob?.ios?.rewarded ? 'configured (unlocks via server-side verification)' : 'not set (app uses the timed video gate)'}.
      </p>
      <p className="mt-1 text-slate-500">
        Job-search video ad: {config.video?.required ? `${config.video.seconds}s, required before every search result` : 'off (VIDEO_AD_REQUIRED=false)'} ·{' '}
        {config.video?.vastTag ? 'Google video ad tag (IMA) configured' : `set VIDEO_AD_VAST_TAG to your Google AdSense/Ad Manager video ad tag${config.video?.demo ? '; the built-in demo video plays until then' : ''}`}.
        All ads come from Google; there is nothing to create or approve here.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slots.map(([name, id]) => (
          <span key={name} className="badge bg-slate-100 text-slate-700">
            {name}: {config.client && id ? id : 'demo'}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('jobs');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobMeta, setJobMeta] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch((e) => setError(errMsg(e)));
    api.get('/admin/users').then((r) => setUsers(r.data.items)).catch((e) => setError(errMsg(e)));
    api.get('/admin/jobs').then((r) => setJobs(r.data.items)).catch((e) => setError(errMsg(e)));
  };
  useEffect(load, []);
  useEffect(() => {
    api.get('/jobs/meta').then((r) => setJobMeta(r.data)).catch(() => {});
  }, []);

  const removeJob = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    await api.delete(`/admin/jobs/${id}`).catch((e) => setError(errMsg(e)));
    load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Admin</h1>
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            ['Users', stats.users],
            ['Video ads watched', stats.videoViews],
            ['Jobs in index', stats.jobs],
            ['Portal jobs', stats.portalJobs],
            ['Job searches', stats.jobSearches],
            ['Apply clicks', stats.applyClicks],
          ].map(([l, v]) => (
            <div key={l} className="card">
              <div className="text-xs text-slate-500">{l}</div>
              <div className="text-xl font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <AdsenseStatus />
      <div className="flex gap-2 border-b border-slate-200">
        {['jobs', 'employer', 'auto', 'users'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {{ jobs: 'Jobs', employer: `Employer jobs${stats?.pendingEmployerJobs ? ` (${stats.pendingEmployerJobs})` : ''}`, auto: 'AI auto-import', users: 'Users' }[t]}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Jobs posted here appear in every matching New Jobs search as verified portal listings, alongside aggregated jobs.</p>
          {editingJob ? (
            <JobForm
              key={editingJob._id || 'new'}
              initial={editingJob}
              meta={jobMeta}
              onCancel={() => setEditingJob(null)}
              onSaved={() => {
                setEditingJob(null);
                load();
              }}
            />
          ) : (
            <>
              <AiImport onReview={setEditingJob} onPosted={load} />
              <button type="button" className="btn-primary" onClick={() => setEditingJob(EMPTY_JOB)}>
                + Post a job manually
              </button>
            </>
          )}
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Job</th>
                  <th className="th">Location</th>
                  <th className="th">Level</th>
                  <th className="th">Apply clicks</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j._id}>
                    <td className="td">
                      <div className="font-medium">{j.title}</div>
                      <div className="text-xs text-slate-500">
                        {j.companyName}
                        {j.importMethod && <span className="badge ml-1 bg-blue-50 text-blue-700">{j.importMethod === 'ai_auto' ? 'AI auto-import' : 'AI import'}</span>}
                        {j.review?.status && <span className={`badge ml-1 ${REVIEW_BADGE[j.review.status]}`}>employer · {j.review.status}</span>}
                      </div>
                    </td>
                    <td className="td text-xs">{[j.city, j.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="td text-xs capitalize">{j.level || 'both'}</td>
                    <td className="td">{j.applyClicks}</td>
                    <td className="td">
                      <span className={`badge ${j.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{j.active ? 'active' : 'hidden'}</span>
                    </td>
                    <td className="td whitespace-nowrap text-right text-xs">
                      <button
                        type="button"
                        className="mr-3 text-blue-700"
                        onClick={() => setEditingJob({ ...EMPTY_JOB, ...j, email: j.emails?.[0] || '', phone: j.phones?.[0] || '', level: j.level || '' })}
                      >
                        Edit
                      </button>
                      <button type="button" className="text-red-600" onClick={() => removeJob(j._id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td className="td py-8 text-center text-slate-500" colSpan={6}>
                      No portal jobs yet. Post one, or run <code>npm --prefix server run seed:jobs</code> for sample data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'employer' && <EmployerJobs onChanged={load} />}
      {tab === 'auto' && <AutoImport meta={jobMeta} onPosted={load} />}

      {tab === 'users' && (
        <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Roles, blocking and daily search limits are managed by the master admin.
          {me?.role === 'master' && (
            <>
              {' '}
              <Link to="/master" className="text-blue-700">
                Open Master Admin →
              </Link>
            </>
          )}
        </p>
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Job searches</th>
                <th className="th">Status</th>
                <th className="th">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="td">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="td">{u.role}</td>
                  <td className="td">{u.jobSearches}</td>
                  <td className="td">
                    <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active ? 'active' : 'blocked'}</span>
                  </td>
                  <td className="td text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
