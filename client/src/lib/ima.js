const SDK_URL = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
let sdkPromise;

function loadSdk() {
  sdkPromise ||= new Promise((resolve, reject) => {
    if (window.google?.ima) return resolve(window.google.ima);
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => (window.google?.ima ? resolve(window.google.ima) : reject(new Error('IMA SDK unavailable')));
    s.onerror = () => reject(new Error('IMA SDK blocked'));
    document.head.appendChild(s);
  }).catch((e) => {
    sdkPromise = null;
    throw e;
  });
  return sdkPromise;
}

// Plays a Google Ad Manager VAST/VMAP tag with the IMA SDK. Resolves with a controller once the ad starts loading.
export async function playVastAd({ container, video, tagUrl, onPlaying, onDone }) {
  const ima = await loadSdk();
  const display = new ima.AdDisplayContainer(container, video);
  display.initialize();
  const loader = new ima.AdsLoader(display);
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 360;
  let manager = null;
  let finished = false;
  const finish = (err) => {
    if (finished) return;
    finished = true;
    onPlaying(false);
    onDone(err);
  };

  loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (e) => finish(e.getError?.() || new Error('Ad error')));
  loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e) => {
    manager = e.getAdsManager(video);
    const E = ima.AdEvent.Type;
    manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (ev) => finish(ev.getError?.() || new Error('Ad error')));
    manager.addEventListener(E.STARTED, () => onPlaying(true));
    manager.addEventListener(E.RESUMED, () => onPlaying(true));
    manager.addEventListener(E.PAUSED, () => onPlaying(false));
    manager.addEventListener(E.COMPLETE, () => onPlaying(false));
    manager.addEventListener(E.ALL_ADS_COMPLETED, () => finish());
    manager.addEventListener(E.CONTENT_RESUME_REQUESTED, () => finish());
    try {
      manager.init(width, height, ima.ViewMode.NORMAL);
      manager.start();
    } catch (err) {
      finish(err);
    }
  });

  const req = new ima.AdsRequest();
  req.adTagUrl = tagUrl;
  req.linearAdSlotWidth = width;
  req.linearAdSlotHeight = height;
  req.nonLinearAdSlotWidth = width;
  req.nonLinearAdSlotHeight = Math.round(height / 3);
  req.setAdWillAutoPlay(true);
  req.setAdWillPlayMuted(true);
  loader.requestAds(req);

  return {
    pause: () => manager?.pause(),
    resume: () => manager?.resume(),
    setMuted: (m) => manager?.setVolume(m ? 0 : 1),
    destroy: () => {
      finished = true;
      manager?.destroy();
      loader.destroy();
      display.destroy();
    },
  };
}
