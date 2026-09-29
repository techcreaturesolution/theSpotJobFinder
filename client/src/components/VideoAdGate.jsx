import { useCallback, useEffect, useRef, useState } from 'react';
import { openAd } from '../lib/ads.js';
import { api, errMsg } from '../lib/api.js';
import { playVastAd } from '../lib/ima.js';

const FRAME_MS = 250;
const TICK_MS = 2000;

export default function VideoAdGate({ endpoint, onUnlocked, message = 'Your job search is running. Watch the full ad to unlock the results.' }) {
  const videoRef = useRef(null);
  const imaBoxRef = useRef(null);
  const imaRef = useRef(null);
  const playingRef = useRef(false);
  const watchedRef = useRef(0);
  const finishingRef = useRef(false);
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState('loading');
  const [watched, setWatched] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [muted, setMuted] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  const send = useCallback((event) => api.post(endpoint, { event }).then((r) => r.data.adGate), [endpoint]);

  const setPlayingState = useCallback(
    (on) => {
      if (on === playingRef.current) return;
      playingRef.current = on;
      setPlaying(on);
      send(on ? 'play' : 'pause').catch(() => {});
    },
    [send],
  );

  useEffect(() => {
    let alive = true;
    api
      .get(endpoint)
      .then(({ data }) => {
        if (!alive) return;
        if (data.adGate.completed) return onUnlocked();
        setInfo({ ad: data.ad, seconds: data.adGate.seconds, vastTag: data.vastTag });
        watchedRef.current = data.adGate.watchedSeconds;
        setWatched(data.adGate.watchedSeconds);
        setMode(data.vastTag ? 'vast' : 'house');
      })
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [endpoint, onUnlocked]);

  useEffect(() => {
    if (mode !== 'vast' || !info?.vastTag) return;
    let cancelled = false;
    playVastAd({
      container: imaBoxRef.current,
      video: videoRef.current,
      tagUrl: info.vastTag,
      onPlaying: setPlayingState,
      onDone: () => !cancelled && setMode('house'),
    })
      .then((ctrl) => {
        if (cancelled) ctrl.destroy();
        else imaRef.current = ctrl;
      })
      .catch(() => !cancelled && setMode('house'));
    return () => {
      cancelled = true;
      imaRef.current?.destroy();
      imaRef.current = null;
    };
  }, [mode, info, setPlayingState]);

  useEffect(() => {
    if (mode !== 'house') return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.play().catch(() => setNeedsTap(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        if (mode === 'house') videoRef.current?.play().catch(() => setNeedsTap(true));
        else imaRef.current?.resume();
        return;
      }
      if (mode === 'house') videoRef.current?.pause();
      else imaRef.current?.pause();
      setPlayingState(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [mode, setPlayingState]);

  const complete = useCallback(async () => {
    finishingRef.current = true;
    setFinishing(true);
    try {
      await send('complete');
      imaRef.current?.destroy();
      videoRef.current?.pause();
      playingRef.current = false;
      onUnlocked();
      return;
    } catch {
      try {
        const { data } = await api.get(endpoint);
        if (data.adGate.completed) return onUnlocked();
        watchedRef.current = data.adGate.watchedSeconds;
        setWatched(data.adGate.watchedSeconds);
      } catch (e) {
        setError(errMsg(e));
      }
    }
    finishingRef.current = false;
    setFinishing(false);
  }, [send, endpoint, onUnlocked]);

  const seconds = info?.seconds || 60;

  useEffect(() => {
    if (!playing) return;
    const frame = setInterval(() => {
      if (finishingRef.current) return;
      watchedRef.current += FRAME_MS / 1000;
      setWatched(watchedRef.current);
      if (watchedRef.current >= seconds) complete();
    }, FRAME_MS);
    const beat = setInterval(() => send('tick').catch(() => {}), TICK_MS);
    return () => {
      clearInterval(frame);
      clearInterval(beat);
    };
  }, [playing, send, seconds, complete]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    if (videoRef.current) videoRef.current.muted = m;
    imaRef.current?.setMuted(m);
  };

  const tapToPlay = () => {
    setNeedsTap(false);
    videoRef.current?.play().catch(() => setNeedsTap(true));
  };

  const left = Math.max(0, Math.ceil(seconds - watched));
  const pct = Math.min(100, (watched / seconds) * 100);
  const ad = info?.ad;
  const houseSrc = mode === 'house' ? ad?.videoUrl : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-label="Sponsored video">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Sponsored video{ad?.advertiser && mode === 'house' ? ` · ${ad.advertiser}` : ''}
            </div>
            <div className="truncate text-sm font-semibold text-slate-900">{mode === 'house' ? ad?.title : mode === 'vast' ? 'Google video ad' : 'Loading ad…'}</div>
          </div>
          <div className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white" data-testid="ad-countdown">
            {finishing ? 'Unlocking…' : `Results in ${left}s`}
          </div>
        </div>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={houseSrc}
            className={`h-full w-full ${mode === 'house' ? '' : 'invisible'}`}
            playsInline
            loop
            muted={muted}
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            onContextMenu={(e) => e.preventDefault()}
            onPlaying={() => mode === 'house' && setPlayingState(true)}
            onPause={() => mode === 'house' && setPlayingState(false)}
            onWaiting={() => mode === 'house' && setPlayingState(false)}
            onError={() => mode === 'house' && setError('The video ad could not be loaded. Please refresh the page.')}
          />
          <div ref={imaBoxRef} className={`absolute inset-0 ${mode === 'vast' ? '' : 'pointer-events-none hidden'}`} />
          {needsTap && (
            <button type="button" onClick={tapToPlay} className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
              ▶ Tap to play the ad
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
            <div className="h-full bg-amber-400 transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <p className="text-slate-600">
            {!playing && !finishing && info
              ? 'Paused. The timer only runs while the ad is playing on screen.'
              : message}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5" onClick={toggleMute}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            {mode === 'house' && ad?._id && ad.targetUrl && (
              <button type="button" className="btn-primary px-3 py-1.5" onClick={() => openAd(ad)}>
                {ad.ctaText || 'Learn more'}
              </button>
            )}
          </div>
        </div>
        {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </div>
  );
}
