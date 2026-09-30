import { Fragment, useState } from 'react';
import { applyToJob } from '../lib/jobs.js';

function postedLabel(job) {
  if (!job.postedAt) return job.postedText || '—';
  const days = Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const VERIFY_LABEL = {
  portal: 'Posted directly on this portal',
  ai_import: 'Imported by the AI agent from a verified source; the source page is re-checked on every search',
  google_jobs: 'Listed on Google Jobs',
  json_ld: 'Confirmed from the job page’s structured data',
  ai_agent: 'Confirmed by the AI agent from the job page',
  source_page: 'Confirmed on the job page',
};

const LEVEL_BADGE = { fresher: 'bg-green-100 text-green-800', experienced: 'bg-indigo-100 text-indigo-800' };
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

function Details({ job, eduLabel }) {
  return (
    <div className="grid gap-4 bg-slate-50 p-4 text-sm md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="mb-1 font-semibold text-slate-900">Job description</div>
        <div className="max-h-72 overflow-y-auto whitespace-pre-line text-slate-700">{job.description || 'No description was published with this listing. Open the apply link for full details.'}</div>
        {job.highlights?.map((h) => (
          <div key={h.title} className="mt-3">
            <div className="font-semibold text-slate-900">{h.title}</div>
            <ul className="ml-5 list-disc text-slate-700">
              {h.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[
          ['Company', job.companyName],
          ['Experience', job.experienceText || (job.level === 'fresher' ? 'Fresher' : job.level === 'experienced' ? 'Experienced' : '')],
          ['Education', [job.educationText, job.education?.map(eduLabel).join(', ')].filter(Boolean)[0]],
          ['Salary', job.salary],
          ['Job type', [job.employmentType, job.workFromHome ? 'Work from home' : ''].filter(Boolean).join(' · ')],
          ['Location', job.location],
          ['Address', job.address],
          ['Valid till', job.validThrough ? new Date(job.validThrough).toLocaleDateString() : ''],
          ['Posted on', job.platform],
          ['Verification', job.verification?.status === 'verified' ? VERIFY_LABEL[job.verification.method] || 'Verified' : 'Could not be confirmed on the original page'],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
              <div className="text-slate-800">{v}</div>
            </div>
          ))}
        {job.companyWebsite && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Website</div>
            <a href={job.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-700">
              {hostOf(job.companyWebsite)}
            </a>
          </div>
        )}
        {job.applyOptions?.length > 1 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Apply on</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {job.applyOptions.map((o) => (
                <button key={o.link} type="button" onClick={() => applyToJob(job, o.link)} className="badge bg-white text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50">
                  {o.title || hostOf(o.link)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobsTable({ items, educationLabels = [] }) {
  const [open, setOpen] = useState(null);
  const eduLabel = (k) => educationLabels.find((e) => e.key === k)?.label || k;
  if (!items.length) return null;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">#</th>
            <th className="th">Job</th>
            <th className="th">Company &amp; address</th>
            <th className="th">Location</th>
            <th className="th">Experience</th>
            <th className="th">Education</th>
            <th className="th">Salary</th>
            <th className="th">Email</th>
            <th className="th">Contact no.</th>
            <th className="th">Source</th>
            <th className="th">Posted</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((j, i) => {
            const canApply = j.applyUrl || j.applyOptions?.length || j.sourceUrl || j.emails?.length;
            return (
              <Fragment key={j._id}>
                <tr className={open === j._id ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                  <td className="td text-xs text-slate-400">{i + 1}</td>
                  <td className="td min-w-[220px]">
                    <button type="button" onClick={() => setOpen(open === j._id ? null : j._id)} className="text-left font-medium text-slate-900 hover:text-blue-700">
                      {j.title}
                    </button>
                    {j.verification?.status === 'verified' ? (
                      <span className="badge ml-1 bg-green-100 text-green-800" title={VERIFY_LABEL[j.verification.method] || 'Verified'}>
                        Verified
                      </span>
                    ) : (
                      <span className="badge ml-1 bg-slate-100 text-slate-500" title="Could not be confirmed on the original page">
                        Unverified
                      </span>
                    )}
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{j.description}</div>
                    <button type="button" onClick={() => setOpen(open === j._id ? null : j._id)} className="mt-1 text-xs font-medium text-blue-700">
                      {open === j._id ? 'Hide details ▲' : 'View full description ▼'}
                    </button>
                  </td>
                  <td className="td min-w-[180px]">
                    <div className="flex items-start gap-2">
                      {j.logo && <img src={j.logo} alt="" className="h-8 w-8 shrink-0 rounded object-contain" referrerPolicy="no-referrer" />}
                      <div>
                        <div className="font-medium text-slate-800">{j.companyName || '—'}</div>
                        {j.address && <div className="text-xs text-slate-500">{j.address}</div>}
                        {j.companyWebsite && (
                          <a href={j.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700">
                            {hostOf(j.companyWebsite)}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs">
                    {[j.city, j.state].filter(Boolean).join(', ') || j.location || '—'}
                    {j.workFromHome && <div className="badge mt-1 bg-teal-100 text-teal-800">WFH</div>}
                  </td>
                  <td className="td whitespace-nowrap text-xs">
                    {j.level && <span className={`badge ${LEVEL_BADGE[j.level]}`}>{j.level === 'fresher' ? 'Fresher' : 'Experienced'}</span>}
                    {j.experienceText && <div className="mt-1 text-slate-500">{j.experienceText}</div>}
                    {!j.level && !j.experienceText && '—'}
                  </td>
                  <td className="td text-xs">{j.education?.length ? j.education.map(eduLabel).join(', ') : j.educationText || '—'}</td>
                  <td className="td text-xs">
                    {j.salary || '—'}
                    {j.employmentType && <div className="text-slate-500">{j.employmentType}</div>}
                  </td>
                  <td className="td text-xs">
                    {j.emails?.length
                      ? j.emails.map((e) => (
                          <a key={e} href={`mailto:${e}`} className="block text-blue-700">
                            {e}
                          </a>
                        ))
                      : '—'}
                  </td>
                  <td className="td whitespace-nowrap text-xs">
                    {j.phones?.length
                      ? j.phones.map((p) => (
                          <a key={p} href={`tel:${p.replace(/\s/g, '')}`} className="block text-blue-700">
                            {p}
                          </a>
                        ))
                      : '—'}
                  </td>
                  <td className="td text-xs">
                    <span className="badge bg-slate-100 text-slate-700">{j.platform || 'Web'}</span>
                    {j.via && j.via !== j.platform && <div className="mt-1 text-slate-400">{j.via}</div>}
                  </td>
                  <td className="td whitespace-nowrap text-xs">{postedLabel(j)}</td>
                  <td className="td text-right">
                    {canApply ? (
                      <button type="button" className="btn-primary whitespace-nowrap px-3 py-1.5" onClick={() => applyToJob(j)}>
                        {j.applyUrl || j.applyOptions?.length || j.sourceUrl ? 'Apply ↗' : 'Email HR'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No link</span>
                    )}
                  </td>
                </tr>
                {open === j._id && (
                  <tr>
                    <td colSpan={12} className="p-0">
                      <Details job={j} eduLabel={eduLabel} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
