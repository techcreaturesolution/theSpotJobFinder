import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './lib/auth.jsx';
import { needsProfile } from './lib/profile.js';
import Admin from './pages/Admin.jsx';
import Jobs from './pages/Jobs.jsx';
import Login from './pages/Login.jsx';
import Master from './pages/Master.jsx';
import Profile from './pages/Profile.jsx';

function Protected({ children, admin = false, master = false }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (needsProfile(user) && pathname !== '/profile') return <Navigate to="/profile" replace />;
  if (admin && !['admin', 'master'].includes(user.role)) return <Navigate to="/" replace />;
  if (master && user.role !== 'master') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Jobs />} />
        <Route path="jobs" element={<Navigate to="/" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="admin"
          element={
            <Protected admin>
              <Admin />
            </Protected>
          }
        />
        <Route
          path="master"
          element={
            <Protected master>
              <Master />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
