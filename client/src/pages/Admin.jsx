import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api.js';
import { getAdsenseConfig } from '../lib/adsense.js';

const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const EMPTY_JOB = {
  title: '',
  companyName: '',
  category: 'it_software',
  level: 'fresher',
  experienceText: '',
  education: [],
  educationText: '',
  description: '',
  city: '',
  state: '',
  address: '',
  email: '',
  phone: '',
  companyWebsite: '',
  applyUrl: '',
  salary: '',
  employmentType: 'Full-time',
  validThrough: '',
  active: true,
};

function JobForm({ initial, meta, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleEdu = (k) => setForm((f) => ({ ...f, education: f.education.includes(k) ? f.education.filter((x) => x !== k) : [...f.education, k] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(Object.keys(EMPTY_JOB).map((k) => [k, form[k] ?? EMPTY_JOB[k]]));
    try {
      if (initial._id) await api.put(`/admin/jobs/${initial._id}`, body);
      else await api.post('/admin/jobs', body);
      onSaved();
    } catch (err) {
      const d = err.response?.data?.details;
      setError(d ? d.map((x) => `${x.path?.join('.')}: ${x.message}`).join('; ') : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <label className="text-sm">
      {label}
      <input className="input mt-1" value={form[k] || ''} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <form onSubmit={submit} className="card grid gap-3 md:grid-cols-3">
      <h3 className="font-semibold md:col-span-3">{initial._id ? 'Edit job' : 'Post a job'}</h3>
      {field('title', 'Job title', { required: true })}
      {field('companyName', 'Company name', { required: true })}
      <label className="text-sm">
        Category
        <select className="input mt-1" value={form.category} onChange={set('category')}>
          {meta?.categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Fresher / experienced
        <select className="input mt-1" value={form.level || ''} onChange={set('level')}>
          <option value="fresher">Fresher</option>
          <option value="experienced">Experienced</option>
          <option value="">Both</option>
        </select>
      </label>
      {field('experienceText', 'Experience (e.g. 0-1 years)')}
      {field('salary', 'Salary (e.g. ₹15,000 - ₹25,000 / month)')}
      <div className="text-sm md:col-span-3">
        Education qualification
        <div className="mt-1 flex flex-wrap gap-1">
          {meta?.education.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleEdu(c.key)}
              className={`badge ${form.education.includes(c.key) ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <label className="text-sm md:col-span-3">
        Job description &amp; requirements
        <textarea className="input mt-1" rows={5} value={form.description} onChange={set('description')} />
      </label>
      <label className="text-sm">
        State
        <select className="input mt-1" value={form.state} onChange={set('state')}>
          <option value="">—</option>
          {meta?.states.map((st) => (
            <option key={st}>{st}</option>
          ))}
        </select>
      </label>
      {field('city', 'City')}
      {field('employmentType', 'Job type')}
      <label className="text-sm md:col-span-3">
        Address
        <input className="input mt-1" value={form.address} onChange={set('address')} />
      </label>
      {field('email', 'HR email', { type: 'email' })}
      {field('phone', 'Contact number')}
      {field('companyWebsite', 'Company website', { type: 'url', placeholder: 'https://' })}
      {field('applyUrl', 'Apply link', { type: 'url', placeholder: 'https://' })}
      <label className="text-sm">
        Last date to apply
        <input className="input mt-1" type="date" value={toDate(form.validThrough)} onChange={set('validThrough')} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
      </label>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-3">{error}</div>}
      <div className="flex justify-end gap-2 md:col-span-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save job'}
        </button>
      </div>
    </form>
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

  const updateUser = async (id, body) => {
    try {
      await api.patch(`/admin/users/${id}`, body);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
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
        {['jobs', 'users'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {{ jobs: 'Jobs', users: 'Users' }[t]}
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
            <button type="button" className="btn-primary" onClick={() => setEditingJob(EMPTY_JOB)}>
              + Post a job
            </button>
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
                      <div className="text-xs text-slate-500">{j.companyName}</div>
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

      {tab === 'users' && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Job searches</th>
                <th className="th">Last login</th>
                <th className="th" />
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
                  <td className="td text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                  <td className="td whitespace-nowrap text-right text-xs">
                    <button type="button" className="mr-3 text-blue-700" onClick={() => updateUser(u._id, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                      Make {u.role === 'admin' ? 'user' : 'admin'}
                    </button>
                    <button type="button" className={u.active ? 'text-red-600' : 'text-green-700'} onClick={() => updateUser(u._id, { active: !u.active })}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
