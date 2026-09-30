import 'dotenv/config';

const list = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const bool = (v, def = false) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thespotjobfinder',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: list(process.env.CLIENT_ORIGIN || 'http://localhost:5173'),

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleMobileClientIds: (process.env.GOOGLE_MOBILE_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  adminEmails: list(process.env.ADMIN_EMAILS),
  masterAdminEmails: list(process.env.MASTER_ADMIN_EMAILS),
  devLoginEnabled: bool(process.env.DEV_LOGIN_ENABLED) && process.env.NODE_ENV !== 'production',

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  serpApiKey: process.env.SERPAPI_KEY || '',
  googleCseKey: process.env.GOOGLE_CSE_KEY || '',
  googleCseCx: process.env.GOOGLE_CSE_CX || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  overpassUrls: list(
    process.env.OVERPASS_URLS ||
      'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter',
  ),
  enableFreeSearchFallback: bool(process.env.ENABLE_FREE_SEARCH_FALLBACK, false),

  adsense: {
    client: /^ca-pub-\d{10,20}$/.test(process.env.ADSENSE_CLIENT_ID || '') ? process.env.ADSENSE_CLIENT_ID : '',
    slots: {
      banner: process.env.ADSENSE_SLOT_BANNER || '',
      sidebar: process.env.ADSENSE_SLOT_SIDEBAR || '',
      inline: process.env.ADSENSE_SLOT_INLINE || '',
      rail: process.env.ADSENSE_SLOT_RAIL || '',
    },
    testMode: bool(process.env.ADSENSE_TEST_MODE, false),
    demo: bool(process.env.ADSENSE_DEMO, true),
  },

  videoAd: {
    required: bool(process.env.VIDEO_AD_REQUIRED, true),
    seconds: Math.min(300, Math.max(5, Number(process.env.VIDEO_AD_SECONDS || 60))),
    exemptAdmins: bool(process.env.VIDEO_AD_EXEMPT_ADMINS, true),
    vastTag: /^https:\/\//.test(process.env.VIDEO_AD_VAST_TAG || '') ? process.env.VIDEO_AD_VAST_TAG : '',
    demo: bool(process.env.VIDEO_AD_DEMO, true),
  },

  admob: {
    android: { banner: process.env.ADMOB_ANDROID_BANNER_ID || '', rewarded: process.env.ADMOB_ANDROID_REWARDED_ID || '' },
    ios: { banner: process.env.ADMOB_IOS_BANNER_ID || '', rewarded: process.env.ADMOB_IOS_REWARDED_ID || '' },
  },

  autoImport: {
    enabled: bool(process.env.AUTO_IMPORT_ENABLED, true),
    tickMs: Math.max(60_000, Number(process.env.AUTO_IMPORT_TICK_MS || 600_000)),
  },

  crawlTimeoutMs: Number(process.env.CRAWL_TIMEOUT_MS || 10000),
  dailyJobSearchLimit: Number(process.env.DAILY_JOB_SEARCH_LIMIT || 50),
  jobEnrichLimit: Number(process.env.JOB_ENRICH_LIMIT || 12),
  jobSearchBudgetMs: Number(process.env.JOB_SEARCH_BUDGET_MS || 40000),
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'change-me-in-production') {
  throw new Error('JWT_SECRET must be set in production');
}
