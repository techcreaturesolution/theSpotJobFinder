import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import GoogleAd from '../components/GoogleAd.jsx';
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0b1c30] via-[#1e1b4b] to-[#3730a3] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-[#e0e7ff]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#3730a3] to-[#2563eb] text-lg font-bold text-white shadow-md">J</div>
          <div>
            <h1 className="text-xl font-bold text-[#0b1c30]">TheSpot JobFinder</h1>
            <p className="text-sm text-slate-500">Verified jobs across India, in one search</p>
          </div>
        </div>
        <ul className="mb-6 space-y-1 text-sm text-slate-600">
          <li>• Fresher or experienced: just type the job you want, e.g. “B.Com accounts assistant”</li>
          <li>• Filter by category, education qualification, state and city</li>
          <li>• Jobs from Google Jobs, company websites, Naukri, Indeed, LinkedIn, Apna, WorkIndia, X and more</li>
          <li>• Company, contact, salary and a direct Apply link for every job</li>
        </ul>

        {!config && !error && <div className="text-center text-sm text-slate-500">Loading…</div>}

        <form onSubmit={onEmailSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
            <input
              className="input w-full"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Continue with email'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {config?.googleClientId ? (
          <GoogleOAuthProvider clientId={config.googleClientId}>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={onGoogle} onError={() => setError('Google sign-in was cancelled or failed')} text="continue_with" shape="pill" size="large" />
            </div>
          </GoogleOAuthProvider>
        ) : (
          config && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Google sign-in is not configured. Set <code>GOOGLE_CLIENT_ID</code> in <code>server/.env</code>.
            </div>
          )
        )}
        {config?.allowedEmailDomains?.length > 0 && (
          <p className="mt-3 text-center text-xs text-slate-500">Only {config.allowedEmailDomains.join(', ')} accounts can sign in.</p>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
      <GoogleAd slot="banner" className="w-full max-w-3xl rounded-xl bg-white/95 p-2" />
    </div>
  );
}
