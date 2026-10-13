import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './lib/auth.jsx';
import Admin from './pages/Admin.jsx';
import Jobs from './pages/Jobs.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Master from './pages/Master.jsx';

function Protected({ children, admin = false, master = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (master && user.role !== 'master') return <Navigate to="/" replace />;
  if (admin && !['admin', 'master'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Root route: Landing for guests, Jobs for logged in users */}
      <Route
        path="/"
        element={
          loading ? (
            <div className="p-10 text-center text-slate-500">Loading…</div>
          ) : user ? (
            <Layout />
          ) : (
            <Landing />
          )
        }
      >
        {user && <Route index element={<Jobs />} />}
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="jobs" element={<Jobs />} />
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
      <Route path="*" element={<Navigate to={user ? "/" : "/landing"} replace />} />
    </Routes>
  );
}

