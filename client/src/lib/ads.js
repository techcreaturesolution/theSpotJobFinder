import { api } from './api.js';

export async function openAd(ad) {
  const win = window.open('about:blank', '_blank');
  if (win) win.opener = null;
  try {
    const { data } = await api.post(`/ads/${ad._id}/click`);
    if (win) win.location.href = data.url;
    else window.open(data.url, '_blank', 'noopener,noreferrer');
  } catch {
    win?.close();
  }
}
