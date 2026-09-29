import { api, errMsg } from './api.js';

export async function applyToJob(job, link) {
  const win = window.open('about:blank', '_blank');
  if (win) win.opener = null;
  try {
    const { data } = await api.post(`/jobs/${job._id}/apply`, link ? { link } : {});
    if (data.url.startsWith('mailto:')) {
      win?.close();
      window.location.href = data.url;
    } else if (win) win.location.href = data.url;
    else window.open(data.url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    win?.close();
    window.alert(errMsg(err));
  }
}
