import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/auth/config')
      .then((r) => setConfig(r.data))
      .catch((e) => setError(errMsg(e)));
  }, []);

  if (user) return <Navigate to="/" replace />;

  const finish = (data) => {
    login(data.token, data.user);
    navigate('/', { replace: true });
  };

  const onGoogle = async ({ credential }) => {
    setError('');
    try {
      const { data } = await api.post('/auth/google', { credential });
      finish(data);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/email', { email: email.trim() });
      finish(data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#faf8ff] p-4 text-[#1e1b4b] overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-5 sm:p-8 md:p-10 shadow-2xl shadow-purple-500/10 border border-purple-100">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/landing" className="inline-block transition hover:opacity-90">
            <img
              src="/final_logo_updated.png"
              alt="TheSpot JobFinder"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </Link>
          <p className="text-xs text-slate-500 mt-1">Verified jobs across India, in one search</p>
        </div>

        <div className="mb-6 rounded-2xl bg-[#f8f5ff] p-4 border border-purple-100/80">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#6355d8] mb-2">Platform Guarantees</div>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Fresher &amp; experienced: verified roles by qualification</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Direct HR email, phone and walk-in venues</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Verified Google Jobs, LinkedIn &amp; career portals</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> 100% Free with zero consultancy commission</li>
          </ul>
        </div>

        {!config && !error && <div className="text-center text-sm text-slate-500 py-2">Loading…</div>}

        <form onSubmit={onEmailSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email Address</label>
            <input
              className="w-full rounded-2xl border border-purple-200 py-3 px-4 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#6355d8] focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-[#6355d8] py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-[#5243d2] transition disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Continue with email →'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-purple-100" />
          <span className="text-xs uppercase text-slate-400 font-medium">or continue with</span>
          <div className="h-px flex-1 bg-purple-100" />
        </div>

        {config?.googleClientId ? (
          <GoogleOAuthProvider clientId={config.googleClientId}>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={onGoogle} onError={() => setError('Google sign-in was cancelled or failed')} text="continue_with" shape="pill" size="large" />
            </div>
          </GoogleOAuthProvider>
        ) : (
          config && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200/60">
              Google sign-in is not configured. Set <code>GOOGLE_CLIENT_ID</code> in <code>server/.env</code>.
            </div>
          )
        )}
        {config?.allowedEmailDomains?.length > 0 && (
          <p className="mt-3 text-center text-xs text-slate-500">Only {config.allowedEmailDomains.join(', ')} accounts can sign in.</p>
        )}

        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200/60">{error}</div>}
      </div>
    </div>
  );
}
