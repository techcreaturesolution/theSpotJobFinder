import { useCallback, useEffect, useMemo, useState } from 'react';
import GoogleAd from '../components/GoogleAd.jsx';
import JobsTable from '../components/JobsTable.jsx';
import VideoAdGate from '../components/VideoAdGate.jsx';
import { api, errMsg } from '../lib/api.js';
import { ALL_CITIES, CITIES_BY_STATE, stateOfCity } from '../lib/india.js';

const EXAMPLES = {
  fresher: ['React developer', '12th pass data entry operator', 'B.Com accounts assistant with Tally', 'Telecaller Hindi / Gujarati', 'Graduate trainee engineer'],
  experienced: ['Senior Java developer 5 years', 'Sales manager FMCG', 'Staff nurse ICU', 'HR recruiter 3 years', 'Site engineer civil'],
};

const POSTED_LABEL = { 1: 'Last 24 hours', 3: 'Last 3 days', 7: 'Last 7 days', 30: 'Last 30 days', 0: 'Any time' };

const PROVIDER_LABEL = {
  portal: 'Jobs posted on this portal',
  google_jobs: 'Google Jobs (SerpAPI)',
  'web:serpapi': 'Web & social search (SerpAPI)',
  'web:google_cse': 'Web & social search (Google CSE)',
  'web:bing_html': 'Web search (Bing)',
};

const EMPTY_FORM = { level: 'fresher', prompt: '', category: '', education: '', state: '', city: '', postedWithin: 30, verifiedOnly: true };

export default function Jobs() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState({ text: '', platform: '', contact: false });

  const loadHistory = () =>
    api
      .get('/jobs/searches')
      .then((r) => setHistory(r.data.items))
      .catch(() => {});

  useEffect(() => {
    api
      .get('/jobs/meta')
      .then((r) => setMeta(r.data))
      .catch((e) => setError(errMsg(e)));
    loadHistory();
  }, []);

  useEffect(() => {
    if (!activeId) return undefined;
    let alive = true;
    let timer;
    const poll = async () => {
      try {
        const { data } = await api.get(`/jobs/searches/${activeId}`);
        if (!alive) return;
        setCurrent(data);
        if (data.search.status === 'running') timer = setTimeout(poll, 2500);
        else loadHistory();
      } catch (e) {
        if (alive) setError(errMsg(e));
      }
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [activeId, refreshTick]);

  const onUnlocked = useCallback(() => setRefreshTick((n) => n + 1), []);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: k === 'postedWithin' ? Number(v) : v };
      if (k === 'state' && f.city && stateOfCity(f.city) && stateOfCity(f.city) !== v) next.city = '';
      if (k === 'city' && v && !f.state) next.state = stateOfCity(v);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.prompt.trim().length < 2 && !form.category) {
      setError('Write what job you want, or pick a category');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/jobs/search', form);
      setFilter({ text: '', platform: '', contact: false });
      setCurrent({ search: data.search, items: [] });
      setActiveId(data.search._id);
      api.get('/jobs/meta').then((r) => setMeta(r.data)).catch(() => {});
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openSearch = (s) => {
    setFilter({ text: '', platform: '', contact: false });
    setCurrent(null);
    setActiveId(s._id);
    if (s._id === activeId) setRefreshTick((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const status = current?.search.status;
  const locked = Boolean(current?.search.locked);
  const searching = status === 'running';
  const result = status === 'completed' && !locked ? current : null;

  const rerun = (s) => {
    setForm({ ...EMPTY_FORM, level: s.level, prompt: s.prompt || '', category: s.category || '', education: s.education || '', state: s.state || '', city: s.city || '', postedWithin: s.postedWithin ?? 30, verifiedOnly: s.verifiedOnly ?? true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cities = form.state ? CITIES_BY_STATE[form.state] || [] : ALL_CITIES;
  const labelOf = (list, key) => list?.find((x) => x.key === key)?.label || '';

  const items = useMemo(() => {
    if (!result) return [];
    const t = filter.text.trim().toLowerCase();
    return result.items.filter(
      (j) =>
        (!filter.platform || j.platform === filter.platform) &&
        (!filter.contact || j.emails?.length || j.phones?.length) &&
        (!t || `${j.title} ${j.companyName} ${j.location} ${j.description}`.toLowerCase().includes(t)),
    );
  }, [result, filter]);
  const platforms = useMemo(() => [...new Set((result?.items || []).map((j) => j.platform).filter(Boolean))].sort(), [result]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Jobs</h1>
        <p className="text-sm text-slate-500">
          Fresh jobs from Google Jobs, company career pages, Naukri, Indeed, LinkedIn, Apna, WorkIndia, Internshala, X and other public sources across India, each checked against the original posting.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            ['fresher', 'I am a Fresher'],
            ['experienced', 'I am Experienced'],
          ].map(([k, l]) => (
            <label key={k} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium ${form.level === k ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <input type="radio" name="level" value={k} checked={form.level === k} onChange={set('level')} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="job-prompt" className="text-sm font-medium text-slate-700">
            What job are you looking for?
          </label>
          <textarea
            id="job-prompt"
            className="input mt-1 text-base"
            rows={2}
            maxLength={200}
            placeholder={`e.g. ${EXAMPLES[form.level][0]}`}
            value={form.prompt}
            onChange={set('prompt')}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {EXAMPLES[form.level].map((x) => (
              <button key={x} type="button" className="badge bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => setForm((f) => ({ ...f, prompt: x }))}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            Category
            <select className="input mt-1" value={form.category} onChange={set('category')}>
              <option value="">All categories</option>
              {meta?.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Education qualification
            <select className="input mt-1" value={form.education} onChange={set('education')}>
              <option value="">Any education</option>
              {meta?.education.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            State
            <select className="input mt-1" value={form.state} onChange={set('state')}>
              <option value="">All India</option>
              {meta?.states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            City
            <input className="input mt-1" list="job-cities" placeholder={form.state ? `Any city in ${form.state}` : 'Any city'} value={form.city} onChange={set('city')} maxLength={60} />
            <datalist id="job-cities">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            Posted
            <select className="input mt-1" value={form.postedWithin} onChange={set('postedWithin')}>
              {(meta?.postedWithin || [1, 3, 7, 30, 0]).map((d) => (
                <option key={d} value={d}>
                  {POSTED_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.verifiedOnly} onChange={set('verifiedOnly')} />
            Show only verified jobs (confirmed on the original posting)
          </label>
          <button className="btn-primary px-6" disabled={submitting || searching || !meta}>
            {submitting || searching ? 'Searching…' : 'Find jobs'}
          </button>
        </div>
        {meta && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Sources:</span>
            {['portal', ...(meta.providers.googleJobs ? ['google_jobs'] : []), ...(meta.providers.webSearch ? [`web:${meta.providers.webSearch}`] : [])].map((p) => (
              <span key={p} className="badge bg-green-50 text-green-700">
                {PROVIDER_LABEL[p] || p}
              </span>
            ))}
            {!meta.providers.googleJobs && <span className="badge bg-amber-50 text-amber-700">Add SERPAPI_KEY to include Google Jobs</span>}
            <span className="badge bg-slate-100 text-slate-600">AI verification agent: {meta.ai === 'openai' ? 'OpenAI' : 'rules (add OPENAI_API_KEY)'}</span>
            <span>
              · {meta.dailyLimit == null ? 'No daily search limit for your account' : `${meta.searchesToday} of ${meta.dailyLimit} searches used today`} · A 1-minute video ad plays with every search
            </span>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </form>


      {status === 'failed' && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{current.search.error || 'The job search failed. Please try again.'}</div>}
      {searching && !locked && (
        <div className="card flex items-center gap-3 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          Searching Google Jobs, company career pages and job portals, and verifying every listing against its source…
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {result.items.length} jobs for “{result.search.query}”
              </h2>
              <div className="text-xs text-slate-500">
                {[result.search.level === 'fresher' ? 'Fresher' : 'Experienced', labelOf(meta?.categories, result.search.category), labelOf(meta?.education, result.search.education), [result.search.city, result.search.state].filter(Boolean).join(', ') || 'All India', POSTED_LABEL[result.search.postedWithin]]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                {result.search.cached ? ` · saved results from ${new Date(result.search.cachedAt).toLocaleString()}` : ` · searched in ${(result.search.durationMs / 1000).toFixed(1)}s`}
                {result.search.hiddenUnverified > 0 && ` · ${result.search.hiddenUnverified} unverified listings hidden`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input w-48" placeholder="Filter results…" value={filter.text} onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))} />
              <select className="input w-44" value={filter.platform} onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value }))}>
                <option value="">All sources</option>
                {platforms.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm text-slate-600">
                <input type="checkbox" checked={filter.contact} onChange={(e) => setFilter((f) => ({ ...f, contact: e.target.checked }))} /> Has email / phone
              </label>
            </div>
          </div>
          {items.length ? (
            <JobsTable items={items} educationLabels={meta?.education} />
          ) : (
            <div className="card text-center text-sm text-slate-500">
              No jobs matched. Try a broader prompt, another city, “Any time”
              {result.search.verifiedOnly ? ', or untick “Show only verified jobs”' : ''}.
            </div>
          )}
          <p className="text-xs text-slate-400">
            Listings, emails and phone numbers come from public job postings and company websites. Always apply through the original link and never pay any fee to get a job.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Your recent job searches</h2>
          <ul className="divide-y divide-slate-100">
            {history.map((s) => (
              <li key={s._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-slate-800">{s.query}</div>
                  <div className="text-xs text-slate-500">
                    {s.status === 'completed' ? `${s.resultCount} jobs` : s.status === 'failed' ? 'Failed' : 'Searching…'} · {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  {s.status === 'completed' && (
                    <button type="button" className="text-xs font-medium text-blue-700" onClick={() => openSearch(s)}>
                      View results
                    </button>
                  )}
                  <button type="button" className="text-xs font-medium text-blue-700" onClick={() => rerun(s)}>
                    Search again
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {locked && status !== 'failed' && <VideoAdGate key={current.search._id} endpoint={`/jobs/searches/${current.search._id}/ad`} onUnlocked={onUnlocked} />}
    </div>
  );
}
