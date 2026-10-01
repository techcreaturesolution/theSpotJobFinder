import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const TABS = { overview: 'Overview', clients: 'Clients', limits: 'Limits & AI agents', saved: 'Saved searches', runs: 'Agent runs' };
const API_LABEL = { jsearch: 'JSearch', adzuna: 'Adzuna', jooble: 'Jooble', careerjet: 'Careerjet' };
const AGENT_LABEL = { auto_import: 'AI auto-import', ai_extract: 'AI import (paste / link)', cleanup: 'Closed-job cleanup' };
const when = (d) => (d ? new Date(d).toLocaleString() : '—');

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Overview({ data }) {
  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;
  const { users, searches, agents, settings, system, lastAutoImport } = data;
  const ai = settings.ai;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Clients" value={users.total} hint={`${users.employers} employers · ${users.admins} admins · ${users.masters} master · ${users.blocked} blocked`} />
        <Stat label="New clients today" value={users.newToday} hint={`${users.searchingToday} searched today`} />
        <Stat label="Searches today" value={searches.today} hint={`${searches.total} in total · limit ${settings.dailySearchLimit}/user/day`} />
        <Stat label="Portal jobs" value={data.portalJobs} hint={`${data.activeRules} active auto-import rules`} />
        <Stat
          label="AI auto-import runs today"
          value={`${agents.auto_import.runs} / ${ai.autoImportDailyRuns}`}
          hint={`${agents.auto_import.posted} / ${ai.autoImportDailyPosts} jobs posted · ${agents.auto_import.failed} failed`}
        />
        <Stat label="AI import runs today" value={agents.ai_extract.runs} hint={`${agents.ai_extract.drafts} drafts · limit ${ai.extractDailyLimit}/admin/day`} />
        <Stat label="OpenAI" value={!system.openaiConfigured ? 'No API key' : ai.openaiEnabled ? 'On' : 'Off'} hint={system.openaiConfigured ? 'Off = pattern matching only' : 'Set OPENAI_API_KEY on the server'} />
        <Stat
          label="Scheduler"
          value={!system.schedulerEnabled ? 'Disabled on server' : ai.autoImportEnabled ? 'On' : 'Paused'}
          hint={`Checks rules every ${system.schedulerTickMinutes} min · last run ${when(lastAutoImport?.createdAt)}`}
        />
        <Stat
          label="Saved searches"
          value={settings.cache?.enabled ? data.savedSearches : 'Off'}
          hint={`${searches.savedHitsToday} of today's searches answered from saved results (no AI agent run)`}
        />
        <Stat label="Jobs stored" value={data.storedJobs} hint={`${data.closedJobs} closed or expired waiting for cleanup`} />
        <Stat label="Employer jobs waiting for review" value={data.pendingEmployerJobs} hint={settings.employer?.requireApproval === false ? 'Approval is off: employer jobs go live at once' : 'Approve or reject them in Admin → Employer jobs'} />
        <Stat
          label="Job listing APIs"
          value={`${Object.values(system.jobApis || {}).filter(Boolean).length} / ${Object.keys(API_LABEL).length} on`}
          hint={Object.entries(API_LABEL)
            .map(([k, v]) => `${v}: ${system.jobApis?.[k] ? 'on' : 'no key'}`)
            .join(' · ')}
        />
        <Stat label="Closed jobs removed today" value={agents.cleanup.removed} hint={settings.cleanup?.enabled === false ? 'Automatic cleanup is off' : 'Cleanup runs once a day'} />
      </div>
      <p className="text-xs text-slate-500">Days start at midnight India time (IST).</p>
    </div>
  );
}

function UserSearches({ user, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/master/users/${user._id}/searches`).then((r) => setItems(r.data.items)).catch(() => setItems([]));
  }, [user._id]);
  return (
    <tr>
      <td className="td bg-slate-50" colSpan={10}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Recent searches by {user.email}</span>
          <button type="button" className="text-xs text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {!items ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : !items.length ? (
          <div className="text-xs text-slate-500">No searches yet.</div>
        ) : (
          <table className="min-w-full text-xs">
            <tbody>
              {items.map((s) => (
                <tr key={s._id}>
                  <td className="py-1 pr-3 text-slate-500">{when(s.createdAt)}</td>
                  <td className="py-1 pr-3">{[s.prompt, s.category, s.level, s.education].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-1 pr-3">{[s.city, s.state].filter(Boolean).join(', ') || 'All India'}</td>
                  <td className="py-1 pr-3">
                    {s.status} · {s.resultCount} jobs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  );
}

function LimitEditor({ user, onSave }) {
  const [value, setValue] = useState(user.dailySearchLimit ?? '');
  const changed = String(value) !== String(user.dailySearchLimit ?? '');
  return (
    <div className="flex items-center gap-1">
      <input
        className="input w-20 px-2 py-1 text-xs"
        type="number"
        min={0}
        max={10000}
        placeholder="global"
        aria-label={`Daily search limit for ${user.email}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {changed && (
        <button type="button" className="text-xs text-blue-700" onClick={() => onSave(value === '' ? null : Number(value))}>
          Save
        </button>
      )}
    </div>
  );
}

function Clients({ setError }) {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ q: '', role: '', status: '', profile: '' });
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api
      .get('/master/users', { params: filters })
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, [filters, setError]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const update = async (u, body) => {
    try {
      await api.patch(`/master/users/${u._id}`, body);
      setError('');
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const download = async () => {
    try {
      const { data, headers } = await api.get('/master/users.csv', { params: filters, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(headers['content-disposition'] || '')?.[1] || 'clients.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search name, email, mobile or city" value={filters.q} onChange={set('q')} />
        <select className="input w-40" value={filters.role} onChange={set('role')} aria-label="Role">
          <option value="">All roles</option>
          <option value="user">Job seekers</option>
          <option value="employer">Employers</option>
          <option value="admin">Admins</option>
          <option value="master">Master admins</option>
        </select>
        <select className="input w-40" value={filters.status} onChange={set('status')} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <select className="input w-44" value={filters.profile} onChange={set('profile')} aria-label="Profile">
          <option value="">Any profile</option>
          <option value="complete">Profile complete</option>
          <option value="incomplete">Profile incomplete</option>
        </select>
        <button type="button" className="btn-secondary ml-auto" onClick={download}>
          Download CSV
        </button>
      </div>
      <p className="text-xs text-slate-500">Daily limit: leave empty to use the global limit; 0 pauses searching for that user.</p>
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Client</th>
              <th className="th">Mobile &amp; location</th>
              <th className="th">Profile</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Searches today</th>
              <th className="th">Daily limit</th>
              <th className="th">AI runs today</th>
              <th className="th">Last login / search</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((u) => {
              const master = u.role === 'master';
              const self = String(u._id) === String(me?.id);
              return [
                <tr key={u._id}>
                  <td className="td">
                    <div className="font-medium">{u.name || '—'}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    <div className="text-xs text-slate-400">Joined {when(u.createdAt)}</div>
                  </td>
                  <td className="td text-sm">
                    {u.phone ? <a href={`tel:+91${u.phone}`}>+91 {u.phone}</a> : <span className="text-slate-400">—</span>}
                    <div className="text-xs text-slate-500">{[u.city, u.state].filter(Boolean).join(', ') || '—'}</div>
                  </td>
                  <td className="td text-xs">
                    {u.profileComplete && u.role === 'employer' ? (
                      <>
                        <div className="font-medium">{u.companyName}</div>
                        {u.companyWebsite && <div className="text-slate-500">{u.companyWebsite}</div>}
                      </>
                    ) : u.profileComplete ? (
                      <>
                        <div className="capitalize">{u.level}</div>
                        <div className="text-slate-500">{u.educationLabel}</div>
                      </>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700">incomplete</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={`badge ${master ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : u.role === 'employer' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {master ? 'master admin' : u.role === 'user' ? 'job seeker' : u.role}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active ? 'active' : 'blocked'}</span>
                  </td>
                  <td className="td">
                    {u.searchesToday}
                    {u.effectiveLimit != null && <span className="text-slate-400"> / {u.effectiveLimit}</span>}
                    <div className="text-xs text-slate-400">{u.searchesTotal} total</div>
                  </td>
                  <td className="td">
                    <LimitEditor key={`${u._id}-${u.dailySearchLimit}`} user={u} onSave={(v) => update(u, { dailySearchLimit: v })} />
                    {u.effectiveLimit == null && <div className="mt-1 text-xs text-slate-400">no limit (staff)</div>}
                  </td>
                  <td className="td">{u.aiRunsToday}</td>
                  <td className="td text-xs">
                    <div>{when(u.lastLoginAt)}</div>
                    <div className="text-slate-400">{when(u.lastSearchAt)}</div>
                  </td>
                  <td className="td whitespace-nowrap text-right text-xs">
                    <button type="button" className="mr-3 text-slate-600" onClick={() => setOpen(open === u._id ? null : u._id)}>
                      Searches
                    </button>
                    {!master && !self && (
                      <>
                        <button type="button" className="mr-3 text-blue-700" onClick={() => update(u, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                          Make {u.role === 'admin' ? 'job seeker' : 'admin'}
                        </button>
                        <button type="button" className={u.active ? 'text-red-600' : 'text-green-700'} onClick={() => update(u, { active: !u.active })}>
                          {u.active ? 'Block' : 'Unblock'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>,
                open === u._id && <UserSearches key={`${u._id}-s`} user={u} onClose={() => setOpen(null)} />,
              ];
            })}
            {!items.length && (
              <tr>
                <td className="td py-8 text-center text-slate-500" colSpan={10}>
                  No clients match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function NumberField({ label, hint, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input className="input mt-1 w-40" type="number" min={0} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Limits({ overview, onSaved, setError }) {
  const [form, setForm] = useState(() => ({
    dailySearchLimit: overview.settings.dailySearchLimit,
    staffUnlimitedSearch: overview.settings.staffUnlimitedSearch,
    ai: { ...overview.settings.ai },
    cache: { enabled: true, ...overview.settings.cache },
    cleanup: { enabled: true, ...overview.settings.cleanup },
    employer: { requireApproval: true, dailyPosts: 10, ...overview.settings.employer },
  }));
  const [saved, setSaved] = useState('');
  const [running, setRunning] = useState(false);
  const setAi = (k) => (v) => setForm((f) => ({ ...f, ai: { ...f.ai, [k]: v } }));
  const setGroup = (g, k) => (v) => setForm((f) => ({ ...f, [g]: { ...f[g], [k]: v } }));
  const { ai, cache, cleanup, employer } = form;

  const save = async () => {
    try {
      await api.put('/master/settings', { dailySearchLimit: form.dailySearchLimit, staffUnlimitedSearch: form.staffUnlimitedSearch, ai, cache, cleanup, employer });
      setError('');
      setSaved('Saved. New limits apply within 30 seconds.');
      onSaved();
    } catch (e) {
      const d = e.response?.data?.details;
      setError(d ? d.map((x) => `${x.path?.join('.')}: ${x.message}`).join('; ') : errMsg(e));
    }
  };
  const runAll = async () => {
    setRunning(true);
    try {
      const { data } = await api.post('/master/agents/auto-import/run');
      setSaved(`Started ${data.started} active auto-import rule(s). Results appear in Agent runs.`);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRunning(false);
    }
  };

  const act = async (fn, message) => {
    try {
      const { data } = await fn();
      setSaved(message(data));
      setError('');
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const runCleanup = () => act(() => api.post('/master/agents/cleanup/run'), (d) => `Removed ${d.removed} closed or expired job(s).`);
  const clearSaved = () => act(() => api.delete('/master/saved-searches'), (d) => `Cleared ${d.removed} saved search(es). The next searches run the AI agent again.`);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-4">
        <h2 className="font-semibold">Job search limits</h2>
        <NumberField
          label="Daily searches per user"
          hint="Applies to every user without a personal limit. 0 pauses search for them."
          value={form.dailySearchLimit}
          onChange={(v) => setForm((f) => ({ ...f, dailySearchLimit: v }))}
        />
        <Toggle label="Admins and master admins search without a limit" checked={form.staffUnlimitedSearch} onChange={(v) => setForm((f) => ({ ...f, staffUnlimitedSearch: v }))} />
      </div>
      <div className="card space-y-4">
        <h2 className="font-semibold">AI agents</h2>
        <Toggle
          label="Use OpenAI"
          hint={overview.system.openaiConfigured ? 'Query planning, job verification and AI import. Off = pattern matching only.' : 'No OPENAI_API_KEY on the server, so pattern matching is used.'}
          checked={ai.openaiEnabled}
          onChange={setAi('openaiEnabled')}
        />
        <Toggle label="AI import (paste a post or link)" checked={ai.extractEnabled} onChange={setAi('extractEnabled')} />
        <NumberField label="AI imports per admin per day" hint="Master admins are not limited." value={ai.extractDailyLimit} onChange={setAi('extractDailyLimit')} />
        <Toggle label="AI auto-import (scheduled rules)" hint="Off stops the scheduler and every manual run." checked={ai.autoImportEnabled} onChange={setAi('autoImportEnabled')} />
        <div className="flex flex-wrap gap-4">
          <NumberField label="Auto-import runs per day" value={ai.autoImportDailyRuns} onChange={setAi('autoImportDailyRuns')} />
          <NumberField label="Auto-imported jobs per day" value={ai.autoImportDailyPosts} onChange={setAi('autoImportDailyPosts')} />
        </div>
        <p className="text-xs text-slate-500">When a daily limit is reached, the scheduler and admins wait until midnight IST. Your own manual runs are not counted against it.</p>
      </div>
      <div className="card space-y-4">
        <h2 className="font-semibold">Saved search results</h2>
        <Toggle
          label="Reuse saved results"
          hint="When someone repeats a search (e.g. new jobs in Ahmedabad), they get the saved jobs instead of a new AI agent run. Each saved job stays until its last apply date passes or it closes; new portal jobs are added. The AI agent runs again only when every saved job for that search has closed."
          checked={cache.enabled}
          onChange={setGroup('cache', 'enabled')}
        />
        <button type="button" className="btn-secondary" onClick={clearSaved}>
          Clear all saved results
        </button>
        <p className="text-xs text-slate-500">To clear one search at a time, open the Saved searches tab.</p>
      </div>
      <div className="card space-y-4">
        <h2 className="font-semibold">Closed jobs</h2>
        <Toggle
          label="Delete closed and expired jobs once a day"
          hint="Removes jobs whose source page closed, whose last date passed, or that no job site has listed for 21 days. Jobs you hid yourself in Admin are kept."
          checked={cleanup.enabled}
          onChange={setGroup('cleanup', 'enabled')}
        />
        <button type="button" className="btn-secondary" onClick={runCleanup}>
          Remove closed jobs now
        </button>
      </div>
      <div className="card space-y-4">
        <h2 className="font-semibold">Employer job posts</h2>
        <Toggle
          label="An admin approves every employer job before it goes live"
          hint="Edits by the employer go back for approval too. Off = employer jobs go live at once."
          checked={employer.requireApproval}
          onChange={setGroup('employer', 'requireApproval')}
        />
        <NumberField label="Jobs per employer per day" hint="0 pauses employer posting." value={employer.dailyPosts} onChange={setGroup('employer', 'dailyPosts')} />
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button type="button" className="btn-primary" onClick={save}>
          Save settings
        </button>
        <button type="button" className="btn-secondary" disabled={running || !overview.settings.ai.autoImportEnabled} onClick={runAll}>
          {running ? 'Starting…' : 'Run all auto-import rules now'}
        </button>
        {saved && <span className="text-sm text-green-700">{saved}</span>}
      </div>
    </div>
  );
}

function SavedSearches({ setError, onChanged }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => {
    api
      .get('/master/saved-searches')
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, [setError]);
  useEffect(load, [load]);

  const clear = async (s) => {
    if (!window.confirm(`Clear the saved results for "${s.label}"? The next search like it runs the AI agent again.`)) return;
    try {
      await api.delete(`/master/saved-searches/${s._id}`);
      setError('');
      load();
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const shown = (items || []).filter((s) => !q || `${s.label} ${s.city} ${s.state} ${s.role}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Filter by keyword, city or state" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs text-slate-500">
          {items ? `${shown.length} of ${items.length} saved search(es)` : 'Loading…'} · Each one is reused until all its jobs close; clearing it makes the next matching search run the AI agent again.
        </span>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Search</th>
              <th className="th">Location</th>
              <th className="th">Filters</th>
              <th className="th">Open jobs</th>
              <th className="th">Reused</th>
              <th className="th">Saved / last used</th>
              <th className="th">Sources</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((s) => (
              <tr key={s._id}>
                <td className="td">
                  <div className="font-medium">{s.role || s.category || '—'}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </td>
                <td className="td text-sm">{[s.city, s.state].filter(Boolean).join(', ') || 'All India'}</td>
                <td className="td text-xs">
                  <div className="capitalize">{s.level || 'any level'}</div>
                  <div className="text-slate-500">{[s.category, s.educationLabel].filter(Boolean).join(' · ') || '—'}</div>
                </td>
                <td className="td">{s.jobCount}</td>
                <td className="td">{s.hits}×</td>
                <td className="td text-xs">
                  <div>{when(s.refreshedAt)}</div>
                  <div className="text-slate-400">{when(s.lastHitAt)}</div>
                </td>
                <td className="td text-xs text-slate-500">{(s.providers || []).join(', ')}</td>
                <td className="td text-right text-xs">
                  <button type="button" className="text-red-600" onClick={() => clear(s)}>
                    Clear
                  </button>
                </td>
              </tr>
            ))}
            {items && !shown.length && (
              <tr>
                <td className="td py-8 text-center text-slate-500" colSpan={8}>
                  No saved searches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Runs({ setError }) {
  const [agent, setAgent] = useState('');
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    api
      .get('/master/agent-runs', { params: { agent, days } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)));
  }, [agent, days, setError]);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-56" value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent">
          <option value="">All agents</option>
          {Object.entries(AGENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="input w-40" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          {[1, 7, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? 'Today' : `Last ${d} days`}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>
      {data && (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Day (IST)</th>
                  <th className="th">Agent</th>
                  <th className="th">Runs</th>
                  <th className="th">Jobs posted</th>
                  <th className="th">Drafts</th>
                  <th className="th">Jobs removed</th>
                  <th className="th">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.daily.map((d) => (
                  <tr key={`${d.day}-${d.agent}`}>
                    <td className="td">{d.day}</td>
                    <td className="td">{AGENT_LABEL[d.agent]}</td>
                    <td className="td">{d.runs}</td>
                    <td className="td">{d.posted}</td>
                    <td className="td">{d.drafts}</td>
                    <td className="td">{d.removed}</td>
                    <td className="td">{d.failed}</td>
                  </tr>
                ))}
                {!data.daily.length && (
                  <tr>
                    <td className="td py-6 text-center text-slate-500" colSpan={7}>
                      No agent runs in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Agent</th>
                  <th className="th">Started by</th>
                  <th className="th">Status</th>
                  <th className="th">Result</th>
                  <th className="th">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r._id}>
                    <td className="td text-xs">{when(r.createdAt)}</td>
                    <td className="td">
                      {AGENT_LABEL[r.agent]}
                      {r.ruleName && <div className="text-xs text-slate-500">Rule: {r.ruleName}</div>}
                    </td>
                    <td className="td text-xs">{r.trigger === 'schedule' ? 'Scheduler' : r.user?.email || 'Admin'}</td>
                    <td className="td">
                      <span className={`badge ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                      {r.error && <div className="mt-1 max-w-xs text-xs text-red-600">{r.error}</div>}
                    </td>
                    <td className="td text-xs">
                      {r.agent === 'auto_import'
                        ? `${r.found} found · ${r.posted} posted · ${r.duplicates} duplicates · ${r.skipped} skipped`
                        : r.agent === 'cleanup'
                          ? `${r.removed} closed job(s) removed`
                          : `${r.drafts} draft(s)${r.method ? ` · ${r.method}` : ''}`}
                    </td>
                    <td className="td text-xs">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function Master() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const loadOverview = useCallback(() => {
    api
      .get('/master/overview')
      .then((r) => setOverview(r.data))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(loadOverview, [loadOverview]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Master Admin</h1>
        <p className="text-sm text-slate-500">All clients, daily search limits, admins and the AI agents. Jobs and auto-import rules are in Admin.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex gap-2 border-b border-slate-200">
        {Object.entries(TABS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              if (k === 'overview' || k === 'limits') loadOverview();
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview data={overview} />}
      {tab === 'clients' && <Clients setError={setError} />}
      {tab === 'limits' && (overview ? <Limits overview={overview} onSaved={loadOverview} setError={setError} /> : <div className="text-sm text-slate-500">Loading…</div>)}
      {tab === 'saved' && <SavedSearches setError={setError} onChanged={loadOverview} />}
      {tab === 'runs' && <Runs setError={setError} />}
    </div>
  );
}
