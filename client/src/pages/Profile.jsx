import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { CITIES_BY_STATE } from '../lib/india.js';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const first = !user.profileComplete;
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    state: user.state || '',
    city: user.city || '',
    level: user.level || '',
    education: user.education || '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/jobs/meta')
      .then((r) => setMeta(r.data))
      .catch((e) => setError(errMsg(e)));
  }, []);

  const cities = useMemo(() => CITIES_BY_STATE[form.state] || [], [form.state]);
  const set = (k) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'state' && f.state !== e.target.value ? { city: '' } : {}) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      updateUser(data.user);
      if (first) navigate('/', { replace: true });
      else setSaved(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{first ? 'Complete your profile' : 'My profile'}</h1>
        <p className="text-sm text-slate-500">
          {first ? 'Tell us a little about yourself to start searching for jobs.' : 'Keep your details up to date.'} Your details are only visible to the TheSpot JobFinder team.
        </p>
      </div>
      <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Email (from Google)
          <input className="input mt-1 bg-slate-50" value={user.email} readOnly />
        </label>
        <label className="text-sm">
          Full name
          <input className="input mt-1" value={form.name} onChange={set('name')} maxLength={80} required autoComplete="name" />
        </label>
        <label className="text-sm">
          Mobile number
          <div className="mt-1 flex">
            <span className="rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">+91</span>
            <input className="input rounded-l-none" type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="98765 43210" maxLength={16} required autoComplete="tel-national" />
          </div>
        </label>
        <label className="text-sm">
          State
          <select className="input mt-1" value={form.state} onChange={set('state')} required>
            <option value="">Select state</option>
            {meta?.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          City
          <input className="input mt-1" list="profile-cities" value={form.city} onChange={set('city')} maxLength={60} required placeholder={form.state ? `City in ${form.state}` : 'Your city'} />
          <datalist id="profile-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <fieldset className="text-sm">
          <legend>I am a</legend>
          <div className="mt-2 flex gap-4">
            {[
              ['fresher', 'Fresher'],
              ['experienced', 'Experienced'],
            ].map(([v, label]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="level" value={v} checked={form.level === v} onChange={set('level')} required />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm">
          Highest education
          <select className="input mt-1" value={form.education} onChange={set('education')} required>
            <option value="">Select education</option>
            {meta?.education
              .filter((e) => e.key !== 'any')
              .map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
          </select>
        </label>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</div>}
        {saved && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 sm:col-span-2">Profile saved.</div>}
        <div className="sm:col-span-2">
          <button className="btn-primary px-6" disabled={saving || !meta}>
            {saving ? 'Saving…' : first ? 'Save and start searching' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
