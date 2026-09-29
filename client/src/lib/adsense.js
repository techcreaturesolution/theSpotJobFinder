import axios from 'axios';

const SCRIPT_ID = 'adsbygoogle-js';
let configPromise;

export function getAdsenseConfig() {
  if (!configPromise) {
    const base = import.meta.env.VITE_API_URL || '';
    configPromise = axios
      .get(`${base}/api/adsense/config`)
      .then((r) => r.data)
      .catch(() => ({ client: null, slots: {}, testMode: false, demo: true }));
  }
  return configPromise;
}

export function loadAdsenseScript(client) {
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}
