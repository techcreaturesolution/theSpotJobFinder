import { useEffect, useState } from 'react';
import { openAd } from '../lib/ads.js';
import { api } from '../lib/api.js';

function BannerAd({ ad }) {
  return (
    <button
      type="button"
      onClick={() => openAd(ad)}
      className="group flex w-full items-stretch overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white text-left shadow-sm hover:shadow"
    >
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className="hidden h-auto w-40 object-cover sm:block" />}
      <div className="flex flex-1 items-center justify-between gap-4 p-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Sponsored · {ad.advertiser}</div>
          <div className="text-base font-semibold text-slate-900">{ad.title}</div>
          {ad.description && <div className="text-sm text-slate-600">{ad.description}</div>}
        </div>
        <span className="btn-primary shrink-0 group-hover:bg-blue-800">{ad.ctaText || 'Learn more'}</span>
      </div>
    </button>
  );
}

function CardAd({ ad }) {
  return (
    <button type="button" onClick={() => openAd(ad)} className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:shadow">
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className="h-24 w-full object-cover" />}
      <div className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Sponsored</div>
        <div className="text-sm font-semibold text-slate-900">{ad.title}</div>
        {ad.description && <div className="mt-0.5 text-xs text-slate-600">{ad.description}</div>}
        <div className="mt-2 text-xs font-medium text-blue-700">
          {ad.ctaText || 'Learn more'} → <span className="text-slate-400">{ad.advertiser}</span>
        </div>
      </div>
    </button>
  );
}

export default function AdSlot({ placement, limit = 1, className = '' }) {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    let alive = true;
    api
      .get('/ads', { params: { placement, limit } })
      .then((r) => alive && setAds(r.data.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [placement, limit]);
  if (!ads.length) return null;
  return (
    <div className={`space-y-3 ${className}`}>
      {ads.map((ad) => (placement === 'dashboard_banner' ? <BannerAd key={ad._id} ad={ad} /> : <CardAd key={ad._id} ad={ad} />))}
    </div>
  );
}
