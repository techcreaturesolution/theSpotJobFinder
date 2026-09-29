import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import GoogleAd from './GoogleAd.jsx';

const linkCls = ({ isActive }) =>
  `flex items-center rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const showAds = !pathname.startsWith('/admin');
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 font-bold text-white">J</div>
          <div>
            <div className="font-semibold text-slate-900">TheSpot JobFinder</div>
            <div className="text-xs text-slate-500">Verified jobs across India</div>
          </div>
        </div>
        <nav className="space-y-1">
          <NavLink to="/" end className={linkCls}>
            New Jobs
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={linkCls}>
              Admin · Jobs &amp; users
            </NavLink>
          )}
        </nav>
        {showAds && (
          <div key={pathname} className="mt-6 space-y-4">
            <GoogleAd slot="sidebar" />
          </div>
        )}
        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-4">
          {user?.picture ? (
            <img src={user.picture} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold">{user?.email?.[0]?.toUpperCase()}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-slate-500">{user?.email}</div>
          </div>
          <button type="button" onClick={logout} className="text-xs text-slate-500 hover:text-red-600">
            Logout
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-semibold">TheSpot JobFinder</span>
          <nav className="flex gap-3 text-sm">
            <NavLink to="/" end>
              New Jobs
            </NavLink>
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            <button type="button" onClick={logout}>
              Logout
            </button>
          </nav>
        </header>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-6 p-4 md:p-8">
          <main className="min-w-0 flex-1 space-y-6">
            {showAds && <GoogleAd key={`top-${pathname}`} slot="banner" />}
            <Outlet />
          </main>
          {showAds && (
            <aside key={`rail-${pathname}`} className="hidden w-[300px] shrink-0 xl:block">
              <div className="sticky top-8 space-y-6">
                <GoogleAd slot="inline" />
                <GoogleAd slot="rail" />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
