import { useCallback, useEffect, useMemo, useState } from 'react';
import GoogleAd from '../components/GoogleAd.jsx';
import JobsTable from '../components/JobsTable.jsx';
import VideoAdGate from '../components/VideoAdGate.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
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
  linkedin: 'LinkedIn Jobs (Apify)',
  'web:serpapi': 'Web & social search (SerpAPI)',
  'web:google_cse': 'Web & social search (Google CSE)',
  'web:bing_html': 'Web search (Bing)',
};

const EMPTY_FORM = { level: 'fresher', prompt: '', category: '', education: '', state: '', city: '', postedWithin: 30, verifiedOnly: false };

export default function Jobs() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState({ text: '', platform: '', contact: false, postedWithin: 0, sortBy: 'newest' });

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
    if (k === 'postedWithin') {
      setFilter((prev) => ({ ...prev, postedWithin: Number(v) }));
    }
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
      setFilter({ text: '', platform: '', contact: false, postedWithin: Number(form.postedWithin || 0), sortBy: 'newest' });
      setCurrent({ search: data.search, items: [] });
      setActiveId(data.search._id);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openSearch = (s) => {
    const postedVal = Number(s.postedWithin ?? 30);
    setFilter({ text: '', platform: '', contact: false, postedWithin: postedVal, sortBy: 'newest' });
    setCurrent(null);
    setActiveId(s._id);
    setForm({
      ...EMPTY_FORM,
      level: s.level || 'fresher',
      prompt: s.prompt || s.query || '',
      category: s.category || '',
      education: s.education || '',
      state: s.state || '',
      city: s.city || '',
      postedWithin: postedVal,
      verifiedOnly: Boolean(s.verifiedOnly),
    });
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
    const DAY = 86400_000;
    const now = Date.now();

    const filtered = result.items.filter((j) => {
      if (filter.platform && j.platform !== filter.platform) return false;
      if (filter.contact && !j.emails?.length && !j.phones?.length) return false;
      if (t && !`${j.title} ${j.companyName} ${j.location} ${j.description}`.toLowerCase().includes(t)) return false;

      // Date-wise filter
      if (filter.postedWithin > 0) {
        let postTime = null;
        if (j.postedAt) {
          const d = new Date(j.postedAt);
          if (!Number.isNaN(d.getTime())) postTime = d.getTime();
        }
        const text = String(j.postedText || '').toLowerCase().trim();
        if (!postTime && text) {
          const m = text.match(/(\d+|an?|one)\+?\s*(?:(d|days?)|(w|weeks?)|(mo|months?)|(h|hours?|hr)|(m|min|minutes?))\s*ago/);
          if (m) {
            const num = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
            const unit = m[2] ? DAY : m[3] ? 7 * DAY : m[4] ? 30 * DAY : m[5] ? 3600_000 : 60_000;
            postTime = now - num * unit;
          } else if (/today|just (?:now|posted)/.test(text)) {
            postTime = now;
          } else if (/yesterday/.test(text)) {
            postTime = now - DAY;
          }
        }

        if (postTime) {
          const bufferDays = filter.postedWithin === 1 ? 0.5 : filter.postedWithin <= 7 ? 0.5 : 2;
          const cutoff = now - (filter.postedWithin + bufferDays) * DAY;
          if (postTime < cutoff) return false;
        } else if (text) {
          if (/years?\s*ago|\b\d+\s*y\s*ago/i.test(text)) return false;
          const dMatch = text.match(/(\d+|an?|one)\+?\s*(?:days?|d)\s*ago/);
          const dVal = dMatch ? (/^\d+$/.test(dMatch[1]) ? Number(dMatch[1]) : 1) : null;
          if (dVal !== null && dVal > filter.postedWithin + (filter.postedWithin === 1 ? 0.5 : 0)) return false;

          const wMatch = text.match(/(\d+|an?|one)\+?\s*(?:weeks?|w)\s*ago/);
          const wVal = wMatch ? (/^\d+$/.test(wMatch[1]) ? Number(wMatch[1]) : 1) : null;
          if (wVal !== null && wVal * 7 > filter.postedWithin) return false;

          const mMatch = text.match(/(\d+|an?|one)\+?\s*(?:months?|mo)\s*ago/);
          const mVal = mMatch ? (/^\d+$/.test(mMatch[1]) ? Number(mMatch[1]) : 1) : null;
          if (mVal !== null && mVal * 30 > filter.postedWithin) return false;
        } else if (filter.postedWithin <= 3) {
          // Exclude undated jobs for tight date windows like 24h or 3 days
          return false;
        }
      }

      return true;
    });

    if (filter.sortBy === 'newest') {
      return [...filtered].sort((a, b) => {
        const timeA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const timeB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return filtered;
  }, [result, filter]);
  const platforms = useMemo(() => [...new Set((result?.items || []).map((j) => j.platform).filter(Boolean))].sort(), [result]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#1e1b4b]">New Jobs</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Fresh jobs from Google Jobs, company career pages, Naukri, Indeed, LinkedIn, Apna, WorkIndia, Internshala, X and other public sources across India, each checked against the original posting.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            ['fresher', 'I am a Fresher'],
            ['experienced', 'I am Experienced'],
          ].map(([k, l]) => (
            <label key={k} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${form.level === k ? 'border-transparent bg-[#6355d8] text-white shadow-md shadow-indigo-500/20 font-bold' : 'border-purple-200 bg-white text-slate-700 hover:bg-[#ede9fe] hover:text-[#6355d8]'}`}>
              <input type="radio" name="level" value={k} checked={form.level === k} onChange={set('level')} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="job-prompt" className="text-sm font-bold text-[#1e1b4b]">
            What job are you looking for?
          </label>
          <textarea
            id="job-prompt"
            className="input mt-1.5 text-base"
            rows={2}
            maxLength={200}
            placeholder={`e.g. ${EXAMPLES[form.level][0]}`}
            value={form.prompt}
            onChange={set('prompt')}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES[form.level].map((x) => (
              <button key={x} type="button" className="badge border border-purple-100 bg-[#f8f5ff] text-[#6355d8] transition hover:bg-[#ede9fe] hover:text-[#1e1b4b] font-medium" onClick={() => setForm((f) => ({ ...f, prompt: x }))}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            Category
            <CustomSelect className="input mt-1" value={form.category} onChange={set('category')}>
              <option value="">All categories</option>
              {meta?.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm">
            Education qualification
            <CustomSelect className="input mt-1" value={form.education} onChange={set('education')}>
              <option value="">Any education</option>
              {meta?.education.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="text-sm">
            State
            <CustomSelect className="input mt-1" value={form.state} onChange={set('state')}>
              <option value="">All India</option>
              {meta?.states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </CustomSelect>
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
            <CustomSelect className="input mt-1" value={form.postedWithin} onChange={set('postedWithin')}>
              {(meta?.postedWithin || [1, 3, 7, 30, 0]).map((d) => (
                <option key={d} value={d}>
                  {POSTED_LABEL[d]}
                </option>
              ))}
            </CustomSelect>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input type="checkbox" checked={form.verifiedOnly} onChange={set('verifiedOnly')} />
            Show only verified jobs (confirmed on the original posting)
          </label>
          <button
            type="submit"
            className="cursor-pointer rounded-full border border-transparent px-6 py-2 text-sm font-bold bg-[#6355d8] text-white shadow-md shadow-indigo-500/20 transition hover:bg-[#5243d2] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting || searching || !meta}
          >
            {submitting || searching ? 'Searching…' : 'Find jobs'}
          </button>
        </div>
        {meta && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Sources:</span>
            {['portal', ...(meta.providers.googleJobs ? ['google_jobs'] : []), ...(meta.providers.linkedin ? ['linkedin'] : []), ...(meta.providers.webSearch ? [`web:${meta.providers.webSearch}`] : [])].map((p) => (
              <span key={p} className="badge bg-green-50 text-green-700">
                {PROVIDER_LABEL[p] || p}
              </span>
            ))}
            {!meta.providers.googleJobs && <span className="badge bg-amber-50 text-amber-700">Add SERPAPI_KEY to include Google Jobs</span>}
            <span className="badge bg-slate-100 text-slate-600">AI verification agent: {meta.ai === 'openai' ? 'OpenAI' : 'rules (add OPENAI_API_KEY)'}</span>
            <span>· A {meta.dailyLimit}-search daily limit applies · A {meta.videoAdSeconds ? (meta.videoAdSeconds >= 60 ? `${Math.round(meta.videoAdSeconds / 60)}-minute` : `${meta.videoAdSeconds}-second`) : '30-second'} video ad plays with every search</span>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </form>


      {status === 'failed' && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{current.search.error || 'The job search failed. Please try again.'}</div>}
      {searching && !locked && (
        <div className="card flex items-center gap-3 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3730a3] border-t-transparent" />
          Searching Google Jobs, company career pages and job portals, and verifying every listing against its source…
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {items.length === result.items.length ? `${items.length} jobs` : `${items.length} of ${result.items.length} jobs`} for “{result.search.query}”
              </h2>
              <div className="text-xs text-slate-500">
                {[result.search.level === 'fresher' ? 'Fresher' : 'Experienced', labelOf(meta?.categories, result.search.category), labelOf(meta?.education, result.search.education), [result.search.city, result.search.state].filter(Boolean).join(', ') || 'All India', POSTED_LABEL[result.search.postedWithin]]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                · searched in {(result.search.durationMs / 1000).toFixed(1)}s
                {result.search.hiddenUnverified > 0 && ` · ${result.search.hiddenUnverified} unverified listings hidden`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input className="input flex-1 min-w-[140px] sm:w-40" placeholder="Filter results…" value={filter.text} onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))} />
              <CustomSelect className="input flex-1 min-w-[130px] sm:w-36" value={filter.platform} onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value }))}>
                <option value="">All sources</option>
                {platforms.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </CustomSelect>
              <CustomSelect className="input flex-1 min-w-[130px] sm:w-36" value={filter.postedWithin} onChange={(e) => setFilter((f) => ({ ...f, postedWithin: Number(e.target.value) }))} title="Filter loaded jobs by posting date">
                <option value={0}>All dates</option>
                <option value={1}>Last 24 hours</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
              </CustomSelect>
              <CustomSelect className="input flex-1 min-w-[130px] sm:w-32" value={filter.sortBy} onChange={(e) => setFilter((f) => ({ ...f, sortBy: e.target.value }))} title="Sort order">
                <option value="newest">Newest first</option>
                <option value="relevance">Best match</option>
              </CustomSelect>
              <label className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap py-1">
                <input type="checkbox" checked={filter.contact} onChange={(e) => setFilter((f) => ({ ...f, contact: e.target.checked }))} /> Has contact
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
          <h2 className="mb-2 font-semibold text-[#0b1c30]">Your recent job searches</h2>
          <ul className="divide-y divide-[#e0e7ff]">
            {history.map((s) => (
              <li key={s._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-[#0b1c30]">{s.query}</div>
                  <div className="text-xs text-slate-500">
                    {s.status === 'completed' ? `${s.resultCount} jobs` : s.status === 'failed' ? 'Failed' : 'Searching…'} · {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  {s.status === 'completed' && (
                    <button type="button" className="text-xs font-medium text-[#3730a3] hover:text-[#1e1b4b] hover:underline" onClick={() => openSearch(s)}>
                      View results
                    </button>
                  )}
                  <button type="button" className="text-xs font-medium text-[#3730a3] hover:text-[#1e1b4b] hover:underline" onClick={() => rerun(s)}>
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
