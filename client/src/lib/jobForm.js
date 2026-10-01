import { errMsg } from './api.js';

export const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const EMPTY_JOB = {
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
  sourceUrl: '',
  importMethod: '',
  active: true,
};

export const jobBody = (form) => Object.fromEntries(Object.keys(EMPTY_JOB).map((k) => [k, form[k] ?? EMPTY_JOB[k]]));
export const detailsMsg = (err) => {
  const d = err.response?.data?.details;
  return d ? d.map((x) => `${x.path?.join('.')}: ${x.message}`).join('; ') : errMsg(err);
};
