# TheSpot JobFinder (MERN)

Job search portal for India. Job seekers sign in with Google, choose **Fresher** or **Experienced**, describe the job they want in plain words, pick a **category**, **education qualification**, **state** and **city**, and get a table of current jobs gathered from:

- Google Jobs
- company career pages
- Naukri, Indeed, LinkedIn, Apna, WorkIndia, foundit, Shine and Internshala
- public hiring posts on X and other social media

Each row lists the job description, company, address, public email and phone, salary, experience, education, source, posted date and an **Apply** button. Apply opens the employer's original apply page, or an email to the employer when that is the only published way to apply.

Other features:

- **Google (Gmail) sign-in.** The server verifies the Google ID token and issues an app JWT. Sign-in can be restricted to certain email domains, and admins are set by email.
- **Client profile.** After the first Google sign-in, each job seeker must fill in their full name, a 10-digit Indian mobile number, state, city, fresher/experienced and highest education before they can search (the server enforces this). Email comes from Google. One mobile number can belong to only one account. Seekers can edit it later under My profile.
- **AI job agent (optional, OpenAI).** Turns the prompt into a search query and checks each listing against the text of its source page. It only keeps facts that appear word for word on that page.
- **No duplicates, re-verified on every search.** Listings are merged when they share a title + company + city or a posting URL, and emails, phone numbers and apply links are de-duplicated after normalisation. Every search re-checks each listing against its source page; stored listings that were not re-checked in that search are not shown as verified.
- **Google ads only.** Google AdSense display ads and Google video ads (IMA) on the web, Google AdMob banner and rewarded video ads in the mobile app. There is no admin form for creating or approving ads.
- **Mandatory 30-second video ad before every search result.** Watch time is tracked on the server, so results stay locked until the ad has actually played. In the app, an AdMob rewarded ad unlocks results once Google confirms the reward to the server.
- **Flutter mobile app** (`mobile/`) for Android and iOS, using the same API.
- **AI job posting.** In Admin → Jobs, paste a job advert (WhatsApp, X, LinkedIn, Facebook, newspaper or email text) or a job page link. The AI agent fills the job form using only facts written in the advert (several jobs in one post become several drafts). You review each draft and post it, or post all ready drafts at once. Without `OPENAI_API_KEY`, the job page's `JobPosting` data or pattern matching is used instead.
- **AI auto-import (scheduled).** In Admin → AI auto-import, add rules (keywords, category, fresher/experienced, education, state, city, how often, max jobs per run). On schedule, the agent runs a verified search and posts the matching jobs to the portal automatically. It only posts jobs that were confirmed on their source page, are still open, and have a company name and an apply link or HR email. Jobs already on the portal (same title + company + city, or the same source page, including hidden ones) are skipped. On every search, each imported job's source page is checked again, and jobs that have closed are hidden, then deleted by the daily cleanup.
- **Job listing APIs.** JSearch (RapidAPI), Adzuna (India), Jooble and Careerjet (India) each run when their key is set. They run in parallel with Google Jobs and web search, and one failing API never stops the others. Their jobs are merged with every other source, de-duplicated (same job, email, phone or apply link is shown once) and re-checked on the source page like any other listing. API data alone does not mark a job as verified.
- **Employer job posting.** On first sign-in, a user can choose "Hire / post jobs" and fill in a company profile (name, mobile, state, city, company name, optional website and address). Employers post jobs from **My job posts**: the company name comes from the profile, and each job needs a description, city, state and an apply link, HR email or contact number. New and edited jobs wait in **Admin → Employer jobs** until an admin approves them (approval can be turned off in Master Admin), and rejected jobs show the admin's note. Only approved, open jobs appear in searches. Employers can edit, close or delete only their own jobs, and duplicate jobs are rejected.
- **Admin panel** for portal jobs, employer job approval, AI import, AI auto-import rules, a read-only user list, stats and the Google ads status.
- **Master Admin** (emails in `MASTER_ADMIN_EMAILS`) sees everything an admin sees, plus a Master Admin page:
  - **Overview:** users, blocked users, searches today, AI agent runs and jobs posted today, OpenAI and scheduler status.
  - **Clients:** every user with their name, email, mobile, city and state, fresher/experienced and education, searches today / total, AI runs today, last login and last search. Search by name, email, mobile or city, filter by role, status or profile completeness, download everyone as a CSV (Excel) file, see a user's recent searches, block or unblock them, make them admin or user, and set a personal daily search limit (empty = use the global limit, 0 = searching paused).
  - **Limits & AI agents:** the global daily search limit (5 per client per day by default), whether admins search without a limit, the OpenAI on/off switch, AI import on/off and daily limit per admin, AI auto-import on/off, daily run limit and daily job limit. "Run all rules now" starts every active auto-import rule.
  - **Saved searches:** a table of every saved search (keywords, city/state, level, category, education, open jobs, times reused, saved / last used, sources) with a **Clear** button for each one.
  - **Saved search results:** every completed search is saved. When anyone repeats it (same keywords in any order and wording, level, category, education, state/city, posted-within), they get the saved jobs without a new AI agent run. Saved results have no time limit: each job stays until its last apply date passes, its source page is found closed, or (for jobs with no last date) no job site has listed it for 21 days. Portal jobs posted after the save are added. The AI agent runs again for that search only when all its saved jobs have closed. "Clear saved results" forces fresh runs.
  - **Closed jobs:** once a day (the first check after midnight IST, and at server start if it has not run that day) the server deletes jobs whose source page closed, whose last date passed, or that no provider has listed for 21 days, removes them from saved results and search history, and drops saved searches with no jobs left. Portal jobs an admin hid by hand are kept. "Remove closed jobs now" runs it at once; each run is logged under Agent runs.
  - **Agent runs:** a log of every AI import and auto-import run (who or which rule, status, found / posted / duplicates / skipped, errors, time) with daily totals.

  Days are counted from midnight India time (IST). Only the master admin can change roles, block users or change limits; admins cannot. Master admins cannot be demoted or blocked from the app, only by removing them from `MASTER_ADMIN_EMAILS`. The scheduler stops for the day once the daily run or job limit is reached; a master admin's manual runs are not counted against those limits, but the on/off switches still apply.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19, Vite, React Router, Tailwind CSS, `@react-oauth/google`, Google IMA SDK (video ads) |
| Backend  | Node.js, Express 5, Mongoose, `google-auth-library`, Cheerio, Zod, OpenAI SDK |
| Database | MongoDB |

```
server/   Express API  (src/routes, src/models, src/services/{jobs,sources,agent}, test/)
client/   React app    (src/pages, src/components, src/lib)
mobile/   Flutter app  (lib/screens, lib/widgets, test/) — see mobile/README.md
```

## Quick start

Requirements: Node 20+ and MongoDB 6+ (running locally, or a MongoDB Atlas URI).

```bash
npm run install:all
cp server/.env.example server/.env    # then edit values (see below)
npm --prefix server run seed:jobs     # optional: 10 sample portal jobs
npm run dev:server                    # http://localhost:5000
npm run dev:client                    # http://localhost:5173  (proxies /api to :5000)
```

The app runs without any API keys. In that case search uses portal jobs, the rule-based agent and the demo video ad. For local testing, `DEV_LOGIN_ENABLED=true` adds an email-only developer login. Add `SERPAPI_KEY` (or Google CSE keys) to get live jobs from Google Jobs, job boards and social posts.

## Configuration (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string (**required** in production) |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma separated |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 **Web** client ID for Google sign-in |
| `ALLOWED_EMAIL_DOMAINS` | Optional, e.g. `gmail.com` |
| `MASTER_ADMIN_EMAILS` | Emails that become master admins |
| `ADMIN_EMAILS` | Emails that become admins on first sign-in (the master admin can change roles later) |
| `DEV_LOGIN_ENABLED` | `true` for local email-only login (ignored in production) |
| `SERPAPI_KEY` | Google Jobs (`engine=google_jobs`, India) and Google web search of job boards, social posts and career pages |
| `JSEARCH_API_KEY` (or `RAPIDAPI_KEY`) | JSearch job listings via RapidAPI |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna India job listings |
| `JOOBLE_API_KEY` | Jooble job listings |
| `CAREERJET_API_KEY`, `CAREERJET_REFERER` | Careerjet India job listings (live searches only; sends the searcher's IP and browser as Careerjet requires) |
| `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` | Alternative web search (Google Programmable Search) |
| `GOOGLE_MAPS_API_KEY` | Optional: company address / phone / website lookup |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Enables the AI job agent |
| `ADSENSE_CLIENT_ID`, `ADSENSE_SLOT_{BANNER,SIDEBAR,INLINE,RAIL}` | AdSense publisher ID and display ad unit IDs |
| `ADSENSE_TEST_MODE`, `ADSENSE_DEMO` | `data-adtest="on"`; show demo creatives in unconfigured slots (default `true`) |
| `VIDEO_AD_REQUIRED`, `VIDEO_AD_SECONDS`, `VIDEO_AD_EXEMPT_ADMINS` | Video ad before every search result (default on, 30 s, admins exempt) |
| `VIDEO_AD_VAST_TAG`, `VIDEO_AD_DEMO` | Google video ad tag (AdSense for video / Ad Manager) played via the Google IMA SDK; demo video when unset (default `true`) |
| `GOOGLE_MOBILE_CLIENT_IDS` | Extra Google OAuth client IDs accepted from the Flutter app |
| `ADMOB_{ANDROID,IOS}_{BANNER,REWARDED}_ID` | AdMob ad units for the Flutter app |
| `DAILY_JOB_SEARCH_LIMIT`, `JOB_ENRICH_LIMIT`, `JOB_SEARCH_BUDGET_MS`, `CRAWL_TIMEOUT_MS` | Limits / tuning |

### Google sign-in setup

1. In Google Cloud Console, go to **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. Under Authorised JavaScript origins, add `http://localhost:5173` and your production URL.
3. Put the client ID into `GOOGLE_CLIENT_ID`. The login page reads it from `/api/auth/config`.

### Google AdSense

Display ads appear on the login page and the job search page, never on Admin. There are four slots:

| Slot | Where |
|------|-------|
| `banner` | Top of the page, and below the search form |
| `sidebar` | Left navigation |
| `inline` | Right rail on wide screens |
| `rail` | Sticky right rail on `xl` screens |

To turn on real ads:

1. Get your domain approved in AdSense.
2. Create one Display ad unit per slot.
3. Set `ADSENSE_CLIENT_ID=ca-pub-…` and the `ADSENSE_SLOT_*` IDs.

`/ads.txt` is served automatically.

## How a job search works

1. `POST /api/jobs/search` saves the search and starts it in the background. The response already includes the search's **video ad gate**.
2. The client plays the video ad and reports `play` / `tick` / `pause` / `complete` events to `/api/jobs/searches/:id/ad`. The server only counts time between heartbeats (at most 3 s per beat), so hiding the tab or pausing stops the timer. `complete` is rejected until `VIDEO_AD_SECONDS` have been watched. Ad source order:
   1. `VIDEO_AD_VAST_TAG` (Google ads are requested back to back until the time is reached)
   2. the bundled demo video (`VIDEO_AD_DEMO`)

   The Flutter app shows an AdMob rewarded ad instead when `ADMOB_*_REWARDED_ID` is set. AdMob calls `GET /api/admob/ssv` (server-side verification, signature checked against Google's keys, one use per transaction) and that unlocks the search. AdMob rewarded ads are usually 15–30 s.
3. Meanwhile the **job agent**:
   - builds the query from the prompt, category, education and location;
   - searches the portal's own jobs, Google Jobs, the job listing APIs and `site:` web searches of the job boards, social sites and career pages, all at the same time. SerpAPI runs several requests in parallel: three Google Jobs query variants (the main one fetches up to 3 pages) and five web searches (three job-board groups, social posts, company career pages). That is up to 10 SerpAPI searches per new search; repeated searches reuse saved results;
   - normalises each result: experience level, education (10th, 12th, ITI, Diploma, graduate, B.E./B.Tech, B.Com, MBA, …), city/state and posted date;
   - removes duplicates (same title + company + city, or the same posting URL) and merges their apply links, emails and phones without repeats.
4. **Verification.** A job counts as verified if it is one of these:
   - a portal job;
   - a Google Jobs listing;
   - a page with matching `JobPosting` structured data;
   - a page the AI agent confirms is an open posting.

   Expired, closed, filled and 404 postings are dropped. **Show only verified jobs** is on by default.
5. **Contact details.** Jobs get the public emails and phone numbers found on the posting, the company's map listing or its website contact pages.
6. `GET /api/jobs/searches/:id` returns results only once the search has finished **and** the ad has been watched.

**Education matching.** Higher qualifications meet generic lower requirements, but specific degrees stay specific. For example, a B.Tech seeker sees "any graduate" and "12th pass" jobs but not B.Com-only jobs. Jobs that don't state a qualification are always shown.

## API overview

| Method & path | Description |
|---------------|-------------|
| `GET /api/auth/config` · `POST /api/auth/google` · `GET /api/auth/me` · `PUT /api/auth/profile` `{ name, phone, state, city, level, education }` (employers: `{ name, phone, state, city, company: { name, website?, address? } }`) · `PUT /api/auth/account-type` `{ type: user\|employer }` | Auth · client profile |
| `GET/POST /api/employer/jobs` · `PUT/DELETE /api/employer/jobs/:id` · `POST /api/employer/jobs/:id/close` | Employer: own jobs |
| `GET /api/admin/employer-jobs?status=` · `POST /api/admin/jobs/:id/review` `{ action: approve\|reject, note }` | Admin: employer job approval |
| `GET /api/jobs/meta` | Categories, education levels, states, providers |
| `POST /api/jobs/search` `{ level, prompt, category, education, state, city, postedWithin, verifiedOnly }` | Start a job search |
| `GET /api/jobs/searches` · `GET /api/jobs/searches/:id` | Search history · status and results (after the ad) |
| `GET /api/jobs/searches/:id/ad` · `POST /api/jobs/searches/:id/ad` `{ event }` | Video ad for the search · watch-time events |
| `GET /api/jobs/:id` · `POST /api/jobs/:id/apply` `{ link? }` | Job details · apply redirect URL (only stored links; click tracked) |
| `GET /api/adsense/config` · `GET /ads.txt` | AdSense / video ad / AdMob config, ads.txt |
| `GET /api/admob/ssv` | AdMob rewarded-ad server-side verification callback |
| `/api/admin/{stats,jobs,users}` | Admin |
| `GET /api/master/overview` · `GET/PUT /api/master/settings` | Master admin: dashboard · daily limits and AI switches |
| `GET /api/master/users?q=&role=&status=&profile=` · `GET /api/master/users.csv` (same filters) · `PATCH /api/master/users/:id` `{ role?, active?, dailySearchLimit? }` · `GET /api/master/users/:id/searches` | Master admin: clients |
| `GET /api/master/agent-runs?agent=&days=` · `POST /api/master/agents/auto-import/run` | Master admin: AI agent run log · run all active rules now |
| `GET/DELETE /api/master/saved-searches` · `DELETE /api/master/saved-searches/:id` · `POST /api/master/agents/cleanup/run` | Master admin: saved search results · remove closed jobs now |
| `POST /api/admin/jobs/extract` `{ text?, url? }` | AI job posting: returns reviewable drafts (each has `missing`, `duplicate`, `closed`) |
| `GET/POST /api/admin/auto-import` · `PUT/DELETE /api/admin/auto-import/:id` · `POST /api/admin/auto-import/:id/run` | AI auto-import rules · run a rule now |

## Scripts

```bash
npm run lint     # server + client ESLint
npm test         # server unit tests (job parsing, education matching, verification, ad gate)
npm run build    # client production build
npm start        # production: Express serves client/dist and the API on one port
```

## Production

1. Build the client with `npm run build`.
2. Set `NODE_ENV=production`, a strong `JWT_SECRET`, `MONGO_URI`, `GOOGLE_CLIENT_ID` and `CLIENT_ORIGIN`.
3. Run `npm start`.

## Data sources

The app only uses public job listings, search-engine results and companies' own public websites. It never logs into LinkedIn, X, Facebook or Instagram. Always apply through the original link, and never pay a fee to get a job.
