import { useEffect, useRef, useState } from 'react';
import { getAdsenseConfig, loadAdsenseScript } from '../lib/adsense.js';

const FORMATS = {
  banner: { size: '728 × 90', box: 'min-h-[90px]', format: 'horizontal' },
  sidebar: { size: '200 × 200', box: 'min-h-[200px]', format: 'rectangle' },
  inline: { size: '300 × 250', box: 'min-h-[250px]', format: 'rectangle' },
  rail: { size: '300 × 600', box: 'min-h-[600px]', format: 'vertical' },
};

const DEMO_CREATIVES = [
  { brand: 'HireNest HRMS', headline: 'Hire faster with AI screening', body: 'Payroll, attendance & recruitment in one place. 14-day free trial.', cta: 'Start free', color: 'from-emerald-500 to-teal-600' },
  { brand: 'MailPilot', headline: 'Cold email that lands in the inbox', body: 'Warm-up, sequences and reply tracking for B2B outreach.', cta: 'Try MailPilot', color: 'from-violet-500 to-indigo-600' },
  { brand: 'SkillUp Academy', headline: 'Job-ready courses for freshers', body: 'Learn Excel, Tally, coding & spoken English with placement support.', cta: 'Explore courses', color: 'from-sky-500 to-blue-700' },
  { brand: 'TallyBooks Cloud', headline: 'GST billing from any device', body: 'Invoices, e-way bills and reports synced in real time.', cta: 'Get started', color: 'from-lime-500 to-green-700' },
  { brand: 'SkillForge Academy', headline: 'Upskill your IT team', body: 'Live cloud, DevOps & AI courses with certification.', cta: 'View courses', color: 'from-fuchsia-500 to-pink-600' },
  { brand: 'OfficeHub Coworking', headline: 'Desks from ₹4,999 / month', body: 'Plug-and-play offices in Ahmedabad, Pune & Bengaluru.', cta: 'Visit now', color: 'from-orange-500 to-rose-600' },
];

let demoCounter = 0;

function AdLabel({ demo }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
      <span>Advertisement</span>
      {demo && <span className="rounded bg-slate-100 px-1 font-semibold text-slate-500">AdSense demo</span>}
    </div>
  );
}

function DemoAd({ slot }) {
  const [creative] = useState(() => DEMO_CREATIVES[demoCounter++ % DEMO_CREATIVES.length]);
  const f = FORMATS[slot];
  const horizontal = slot === 'banner';
  return (
    <div className={`relative flex overflow-hidden rounded-lg border border-slate-200 bg-white ${f.box} ${horizontal ? 'flex-row items-center' : 'flex-col'}`}>
      <div className={`bg-gradient-to-br ${creative.color} ${horizontal ? 'hidden w-28 shrink-0 self-stretch sm:block' : slot === 'rail' ? 'h-64' : 'h-20'}`} />
      <div className={`flex flex-1 gap-2 p-3 ${horizontal ? 'items-center justify-between' : 'flex-col'}`}>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-500">
            <span className="mr-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-white">Ad</span>
            {creative.brand}
          </div>
          <div className="text-sm font-semibold text-slate-900">{creative.headline}</div>
          {slot !== 'sidebar' && <div className="text-xs text-slate-600">{creative.body}</div>}
        </div>
        <span className={`shrink-0 rounded-full bg-blue-600 px-3 py-1 text-center text-xs font-semibold text-white ${horizontal ? '' : 'mt-auto'}`}>{creative.cta}</span>
      </div>
      <span className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[9px] text-slate-400" title="Placeholder shown until an AdSense ad unit is configured">
        {f.size}
      </span>
    </div>
  );
}

const pushedUnits = new WeakSet();

function AdsenseUnit({ client, slotId, slot, testMode }) {
  const ref = useRef(null);
  useEffect(() => {
    loadAdsenseScript(client);
    const el = ref.current;
    if (!el) return undefined;
    const push = () => {
      if (pushedUnits.has(el) || el.dataset.adsbygoogleStatus || el.offsetWidth === 0) return false;
      pushedUnits.add(el);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense throws if the unit was already filled
      }
      return true;
    };
    if (push() || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => push() && observer.disconnect());
    observer.observe(el);
    return () => observer.disconnect();
  }, [client, slotId]);
  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${FORMATS[slot].box}`}
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slotId}
      data-ad-format={FORMATS[slot].format}
      data-full-width-responsive="true"
      {...(testMode ? { 'data-adtest': 'on' } : {})}
    />
  );
}

export default function GoogleAd({ slot = 'banner', className = '' }) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let alive = true;
    getAdsenseConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);
  if (!config) return null;
  const slotId = config.client && config.slots?.[slot];
  if (!slotId && !config.demo) return null;
  return (
    <div className={className}>
      <AdLabel demo={!slotId} />
      {slotId ? <AdsenseUnit client={config.client} slotId={slotId} slot={slot} testMode={config.testMode} /> : <DemoAd slot={slot} />}
    </div>
  );
}
