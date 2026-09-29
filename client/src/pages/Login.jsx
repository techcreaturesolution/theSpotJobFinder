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
  const [devEmail, setDevEmail] = useState('');

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

  const onDev = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/dev', { email: devEmail });
      finish(data);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-lg font-bold text-white">J</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">TheSpot JobFinder</h1>
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

        {config?.devLoginEnabled && (
          <form onSubmit={onDev} className="mt-6 space-y-2 border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Developer login (local only)</div>
            <input className="input" type="email" placeholder="you@gmail.com" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} required />
            <button className="btn-secondary w-full">Continue with email</button>
          </form>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
      <GoogleAd slot="banner" className="w-full max-w-3xl rounded-xl bg-white/95 p-2" />
    </div>
  );
}
