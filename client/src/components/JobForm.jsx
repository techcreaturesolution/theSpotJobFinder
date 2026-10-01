import { useState } from 'react';
import { api } from '../lib/api.js';
import { detailsMsg, jobBody, toDate } from '../lib/jobForm.js';

export default function JobForm({ initial, meta, onSaved, onCancel, endpoint = '/admin/jobs', employer = false }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleEdu = (k) => setForm((f) => ({ ...f, education: f.education.includes(k) ? f.education.filter((x) => x !== k) : [...f.education, k] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = jobBody(form);
    try {
      if (initial._id) await api.put(`${endpoint}/${initial._id}`, body);
      else await api.post(endpoint, body);
      onSaved();
    } catch (err) {
      setError(detailsMsg(err));
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
      <h3 className="font-semibold md:col-span-3">{initial._id ? 'Edit job' : initial.importMethod ? 'Review AI-extracted job' : 'Post a job'}</h3>
      {initial.importMethod && !initial._id && (
        <p className="text-sm text-slate-500 md:col-span-3">
          Every value below was copied from the advert. Empty fields were not written in it; fill them only with facts you have confirmed.
          {initial.duplicate && <span className="ml-1 font-medium text-amber-700">This job (same title, company and city) is already posted.</span>}
        </p>
      )}
      {field('title', 'Job title', { required: true })}
      {employer ? (
        <label className="text-sm">
          Company name
          <input className="input mt-1 bg-slate-50" value={form.companyName} readOnly title="From your company profile" />
        </label>
      ) : (
        field('companyName', 'Company name', { required: true })
      )}
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
        <textarea className="input mt-1" rows={5} value={form.description} onChange={set('description')} required={employer} minLength={employer ? 30 : undefined} />
      </label>
      <label className="text-sm">
        State
        <select className="input mt-1" value={form.state} onChange={set('state')} required={employer}>
          <option value="">—</option>
          {meta?.states.map((st) => (
            <option key={st}>{st}</option>
          ))}
        </select>
      </label>
      {field('city', 'City', { required: employer })}
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
      {employer ? (
        <p className="text-xs text-slate-500 md:col-span-3">Add at least one way to apply: an apply link, HR email or contact number. Only post real, open vacancies at your own company.</p>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
        </label>
      )}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-3">{error}</div>}
      <div className="flex justify-end gap-2 md:col-span-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : employer && !initial._id ? 'Submit for review' : 'Save job'}
        </button>
      </div>
    </form>
  );
}
