import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import GoogleAd from './GoogleAd.jsx';

const linkCls = ({ isActive }) =>
  `flex items-center rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-[#ede9fe] text-[#6355d8] shadow-xs'
      : 'text-slate-600 hover:bg-[#faf8ff] hover:text-[#6355d8]'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const showAds = !pathname.startsWith('/admin') && !pathname.startsWith('/master');
  return (
    <div className="flex min-h-screen bg-[#faf8ff] text-[#1e1b4b]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#f0eaff] bg-white p-5 md:flex">
        <div className="mb-6 flex items-center px-1">
          <Link to="/landing" className="flex items-center transition hover:opacity-90">
            <img
              src="/final_logo_updated.png"
              alt="TheSpot JobFinder"
              className="h-14 sm:h-16 w-auto max-w-full object-contain"
            />
          </Link>
        </div>
        <nav className="space-y-1.5">
          <NavLink to="/" end className={linkCls}>
            New Jobs
          </NavLink>
          {['admin', 'master'].includes(user?.role) && (
            <NavLink to="/admin" className={linkCls}>
              Admin · Jobs &amp; users
            </NavLink>
          )}
          {user?.role === 'master' && (
            <NavLink to="/master" className={linkCls}>
              Master Admin
            </NavLink>
          )}
        </nav>
        {showAds && (
          <div className="mt-5">
            <GoogleAd key={`sidebar-${pathname}`} slot="sidebar" />
          </div>
        )}
        <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-[#faf8ff] p-3 border border-[#f0eaff]">
          {user?.picture ? (
            <img src={user.picture} alt="" className="h-9 w-9 shrink-0 rounded-full ring-2 ring-purple-200/60 object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ede9fe] text-xs font-bold text-[#6355d8]">
              {user?.email?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-[#1e1b4b]" title={user?.name || user?.email}>{user?.name || 'Admin'}</div>
            <div className="truncate text-[10px] text-slate-400" title={user?.email}>{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#f0eaff] bg-white/95 px-3.5 py-2.5 backdrop-blur-md md:hidden">
          <Link to="/landing" className="flex items-center shrink-0">
            <img
              src="/final_logo_updated.png"
              alt="TheSpot JobFinder"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 transition ${
                  isActive
                    ? 'bg-[#ede9fe] text-[#6355d8]'
                    : 'text-slate-600 hover:text-[#6355d8]'
                }`
              }
            >
              New Jobs
            </NavLink>
            {['admin', 'master'].includes(user?.role) && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 transition ${
                    isActive
                      ? 'bg-[#ede9fe] text-[#6355d8]'
                      : 'text-slate-600 hover:text-[#6355d8]'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
            {user?.role === 'master' && (
              <NavLink
                to="/master"
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 transition ${
                    isActive
                      ? 'bg-[#ede9fe] text-[#6355d8]'
                      : 'text-slate-600 hover:text-[#6355d8]'
                  }`
                }
              >
                Master
              </NavLink>
            )}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              title="Logout"
            >
              Logout
            </button>
          </nav>
        </header>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-3.5 sm:p-6 md:p-8">
          <main className="min-w-0 flex-1 space-y-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
