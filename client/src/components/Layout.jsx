import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import GoogleAd from './GoogleAd.jsx';

const linkCls = ({ isActive }) =>
  `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-[#F4DBD8] text-[#775144] font-semibold' : 'text-[#5C3830] hover:bg-[#F4DBD8]/60'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const showAds = !pathname.startsWith('/admin') && !pathname.startsWith('/master');
  return (
    <div className="flex min-h-screen bg-[#FAF5F4]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E5D3D1] bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#775144] font-bold text-white shadow-sm">J</div>
          <div>
            <div className="font-semibold text-[#2A0800]">TheSpot JobFinder</div>
            <div className="text-xs text-[#775144]">Verified jobs across India</div>
          </div>
        </div>
        <nav className="space-y-1">
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
        <header className="flex items-center justify-between border-b border-[#E5D3D1] bg-white px-4 py-3 md:hidden">
          <span className="font-semibold text-[#2A0800]">TheSpot JobFinder</span>
          <nav className="flex gap-3 text-sm">
            <NavLink to="/" end>
              New Jobs
            </NavLink>
            {['admin', 'master'].includes(user?.role) && <NavLink to="/admin">Admin</NavLink>}
            {user?.role === 'master' && <NavLink to="/master">Master</NavLink>}
            <button type="button" onClick={logout}>
              Logout
            </button>
          </nav>
        </header>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-8">
          <main className="min-w-0 flex-1 space-y-6">
            {showAds && <GoogleAd key={`top-${pathname}`} slot="banner" />}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
