import { Fragment, useState } from 'react';
import { applyToJob } from '../lib/jobs.js';

function postedLabel(job) {
  if (job.postedAt) {
    const d = new Date(job.postedAt);
    if (!Number.isNaN(d.getTime())) {
      const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
      if (days <= 0) return 'Today';
      if (days === 1) return 'Yesterday';
      return `${days} days ago`;
    }
  }
  return job.postedText || '—';
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

function cleanDescription(desc) {
  if (!desc) return '';
  if (!/<[a-z][\s\S]*>/i.test(desc)) return desc;
  try {
    const doc = new DOMParser().parseFromString(desc, 'text/html');
    doc.querySelectorAll('.ql-ui, script, style').forEach((el) => el.remove());
    doc.querySelectorAll('li').forEach((li) => {
      li.textContent = `• ${li.textContent.trim()}\n`;
    });
    doc.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6').forEach((el) => {
      el.after('\n');
    });
    return (doc.body.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
  } catch {
    return desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function Details({ job, eduLabel }) {
  const formattedDesc = cleanDescription(job.description);
  return (
    <div className="grid gap-4 border-t border-[#e0e7ff] bg-[#f8f9ff] p-4 text-sm md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="mb-1 font-semibold text-[#0b1c30]">Job description</div>
        <div className="max-h-72 overflow-y-auto whitespace-pre-line text-slate-700">{formattedDesc || 'No description was published with this listing. Open the apply link for full details.'}</div>
        {job.highlights?.map((h) => (
          <div key={h.title} className="mt-3">
            <div className="font-semibold text-[#0b1c30]">{h.title}</div>
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
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{k}</div>
              <div className="font-medium text-[#0b1c30]">{v}</div>
            </div>
          ))}
        {job.companyWebsite && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Website</div>
            <a href={job.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-[#3730a3] hover:text-[#1e1b4b] hover:underline">
              {hostOf(job.companyWebsite)} ↗
            </a>
          </div>
        )}
        {job.companyLinkedinUrl && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Company Profile (LinkedIn)</div>
            <a href={job.companyLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] hover:underline">
              View on LinkedIn ↗
            </a>
          </div>
        )}
        {job.applyOptions?.length > 1 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Apply on</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {job.applyOptions.map((o) => (
                <button key={o.link} type="button" onClick={() => applyToJob(job, o.link)} className="badge bg-white text-[#0b1c30] ring-1 ring-[#e0e7ff] hover:bg-[#eef2ff]">
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

function isLinkedInJob(job) {
  return Boolean(
    job.platform === 'LinkedIn' ||
    String(job.via || '').toLowerCase().includes('linkedin') ||
    job.provider === 'apify_linkedin' ||
    /linkedin\.com/i.test(job.applyUrl || '') ||
    /linkedin\.com/i.test(job.sourceUrl || '') ||
    job.applyOptions?.some((o) => /linkedin\.com/i.test(o.link))
  );
}

function getApplyTarget(job) {
  const isLinkedIn = isLinkedInJob(job);
  if (isLinkedIn) {
    const lOpt = job.applyOptions?.find((o) => /linkedin\.com/i.test(o.link));
    if (lOpt?.link) return { url: lOpt.link, label: 'Apply on LinkedIn ↗', isLinkedIn: true };
    if (job.applyUrl && /linkedin\.com/i.test(job.applyUrl)) return { url: job.applyUrl, label: 'Apply on LinkedIn ↗', isLinkedIn: true };
    if (job.sourceUrl && /linkedin\.com/i.test(job.sourceUrl)) return { url: job.sourceUrl, label: 'Apply on LinkedIn ↗', isLinkedIn: true };
  }

  const compOpt = job.applyOptions?.find((o) => /company|career|official/i.test(o.title) && !/linkedin|naukri|indeed|shine/i.test(o.title));
  if (compOpt?.link) return { url: compOpt.link, label: 'Apply on Company Site ↗', isLinkedIn: false };

  if (job.applyUrl) {
    const isComp = /careers?|jobs?|apply/i.test(job.applyUrl) || (job.companyWebsite && hostOf(job.applyUrl) === hostOf(job.companyWebsite));
    return { url: job.applyUrl, label: isComp ? 'Apply on Company Site ↗' : 'Apply ↗', isLinkedIn: false };
  }

  if (job.applyOptions?.[0]?.link) {
    return { url: job.applyOptions[0].link, label: 'Apply ↗', isLinkedIn: false };
  }

  if (job.sourceUrl) {
    return { url: job.sourceUrl, label: 'Apply ↗', isLinkedIn: false };
  }

  if (job.companyWebsite) {
    return { url: job.companyWebsite, label: 'Apply on Company Site ↗', isLinkedIn: false };
  }

  if (job.emails?.length) {
    return { url: `mailto:${job.emails[0]}`, label: 'Email HR ↗', isLinkedIn: false };
  }

  return null;
}

export default function JobsTable({ items, educationLabels = [] }) {
  const [open, setOpen] = useState(null);
  const eduLabel = (k) => educationLabels.find((e) => e.key === k)?.label || k;
  if (!items.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e0e7ff] bg-white p-0 shadow-sm">
      <table className="min-w-full divide-y divide-[#e0e7ff]">
        <thead className="bg-[#f1f3f9]">
          <tr>
            <th className="th">#</th>
            <th className="th">Job</th>
            <th className="th">Company Name</th>
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
        <tbody className="divide-y divide-[#e0e7ff] bg-white">
          {items.map((j, i) => {
            const isLinkedIn = isLinkedInJob(j);
            const target = getApplyTarget(j);
            return (
              <Fragment key={j._id}>
                <tr className={open === j._id ? 'bg-[#eef2ff]/60' : 'hover:bg-[#f8f9ff]'}>
                  <td className="td text-xs font-medium text-slate-500">{i + 1}</td>
                  <td className="td min-w-[220px]">
                    <button type="button" onClick={() => setOpen(open === j._id ? null : j._id)} className="text-left font-semibold text-[#0b1c30] hover:text-[#3730a3]">
                      {j.title}
                    </button>
                    {j.verification?.status === 'verified' ? (
                      <span className="badge ml-1 bg-green-50 text-green-700 border border-green-200" title={VERIFY_LABEL[j.verification.method] || 'Verified'}>
                        Verified
                      </span>
                    ) : (
                      <span className="badge ml-1 bg-stone-100 text-stone-600 border border-stone-200" title="Could not be confirmed on the original page">
                        Unverified
                      </span>
                    )}
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">{cleanDescription(j.description)}</div>
                    <button type="button" onClick={() => setOpen(open === j._id ? null : j._id)} className="mt-1 text-xs font-semibold text-[#3730a3] hover:underline">
                      {open === j._id ? 'Hide details ▲' : 'View full description ▼'}
                    </button>
                  </td>
                  <td className="td min-w-[180px]">
                    <div className="flex items-start gap-2">
                      {j.logo && <img src={j.logo} alt="" className="h-8 w-8 shrink-0 rounded object-contain bg-stone-50 border border-[#e0e7ff] p-0.5" referrerPolicy="no-referrer" />}
                      <div>
                        <div className="font-semibold text-[#0b1c30]">{j.companyName || '—'}</div>
                        {j.address && <div className="text-xs text-slate-500">{j.address}</div>}
                        {j.companyWebsite && (
                          <a href={j.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-[#3730a3] hover:text-[#1e1b4b] hover:underline block">
                            {hostOf(j.companyWebsite)} ↗
                          </a>
                        )}
                        {j.companyLinkedinUrl && (
                          <a href={j.companyLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-[#0A66C2] hover:underline flex items-center gap-1 mt-0.5">
                            <span>LinkedIn Profile ↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs text-slate-700">
                    {[j.city, j.state].filter(Boolean).join(', ') || j.location || j.address || '—'}
                    {j.workFromHome && <div className="badge mt-1 bg-teal-50 text-teal-800 border border-teal-200">WFH</div>}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-700">
                    {j.level && <span className={`badge ${LEVEL_BADGE[j.level]}`}>{j.level === 'fresher' ? 'Fresher' : 'Experienced'}</span>}
                    {j.experienceText && <div className="mt-1 text-slate-500">{j.experienceText}</div>}
                    {!j.level && !j.experienceText && '—'}
                  </td>
                  <td className="td text-xs text-slate-700">{j.education?.length ? j.education.map(eduLabel).join(', ') : j.educationText || '—'}</td>
                  <td className="td text-xs text-slate-700">
                    {j.salary || '—'}
                    {j.employmentType && <div className="text-slate-500">{j.employmentType}</div>}
                  </td>
                  <td className="td text-xs">
                    {j.emails?.length
                      ? j.emails.map((e) => (
                          <a key={e} href={`mailto:${e}`} className="block text-[#3730a3] hover:text-[#1e1b4b] hover:underline">
                            {e}
                          </a>
                        ))
                      : '—'}
                  </td>
                  <td className="td whitespace-nowrap text-xs">
                    {j.phones?.length
                      ? j.phones.map((p) => (
                          <a key={p} href={`tel:${p.replace(/\s/g, '')}`} className="block text-[#3730a3] hover:text-[#1e1b4b] hover:underline">
                            {p}
                          </a>
                        ))
                      : '—'}
                  </td>
                  <td className="td text-xs">
                    {isLinkedIn ? (
                      <span className="badge bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30 font-medium">LinkedIn</span>
                    ) : (
                      <span className="badge bg-[#f8f9ff] text-[#3730a3] border border-[#e0e7ff]">{j.platform || 'Web'}</span>
                    )}
                    {j.via && j.via !== j.platform && !isLinkedIn && <div className="mt-1 text-slate-500">{j.via}</div>}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">{postedLabel(j)}</td>
                  <td className="td text-right">
                    {target ? (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-full shadow-sm transition inline-flex items-center gap-1.5 ${
                            target.isLinkedIn
                              ? 'bg-[#0A66C2] hover:bg-[#004182] text-white'
                              : 'btn-primary'
                          }`}
                          onClick={() => applyToJob(j, target.url)}
                        >
                          {target.isLinkedIn && (
                            <svg className="h-3.5 w-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28Z" />
                            </svg>
                          )}
                          {target.label}
                        </button>
                        {j.companyWebsite && hostOf(j.companyWebsite) !== hostOf(target.url) && (
                          <a
                            href={j.companyWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-[#3730a3] hover:text-[#1e1b4b] hover:underline whitespace-nowrap"
                          >
                            Company Site ↗
                          </a>
                        )}
                        {!j.companyWebsite && j.companyLinkedinUrl && hostOf(j.companyLinkedinUrl) !== hostOf(target.url) && (
                          <a
                            href={j.companyLinkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-[#0A66C2] hover:underline whitespace-nowrap"
                          >
                            LinkedIn Profile ↗
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">No link</span>
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
