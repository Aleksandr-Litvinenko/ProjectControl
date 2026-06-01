import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/labels';

interface NavItem { to: string; label: string; icon: string; roles?: string[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: '▦' },
  { to: '/projects', label: 'Проекты', icon: '▣' },
  { to: '/allocations', label: 'Загрузка', icon: '◷' },
  { to: '/admin/users', label: 'Пользователи', icon: '◉', roles: ['pmo_admin'] },
  { to: '/admin/types', label: 'Типы и шаблоны', icon: '☰', roles: ['pmo_admin'] },
  { to: '/audit', label: 'Аудит', icon: '◳', roles: ['pmo_admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          onClick={onClick}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
              isActive ? 'bg-primary/10 text-primary-600' : 'text-slate-600 hover:bg-surface hover:text-ink',
            )
          }
        >
          <span className="text-base opacity-70">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 px-3">{<NavLinks />}</nav>
        <UserFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-2xl text-ink" aria-label="Меню">☰</button>
        <span className="font-display text-lg">ProjectControl</span>
        <div className="h-8 w-8 rounded-full bg-primary/10 text-center text-sm leading-8 text-primary-600">
          {user.fullName.slice(0, 1)}
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-card" onClick={(e) => e.stopPropagation()}>
            <Brand onClose={() => setMobileOpen(false)} />
            <nav className="flex-1 space-y-1 px-3">{<NavLinks onClick={() => setMobileOpen(false)} />}</nav>
            <UserFooter user={user} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 bg-surface">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Brand({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <span className="font-display text-lg leading-none">P</span>
        </div>
        <div className="leading-tight">
          <div className="font-display text-base text-ink">ProjectControl</div>
          <div className="text-[11px] text-slate-400">Проектный офис</div>
        </div>
      </div>
      {onClose && <button onClick={onClose} className="text-slate-400 lg:hidden" aria-label="Закрыть">✕</button>}
    </div>
  );
}

function UserFooter({ user, onLogout }: { user: { fullName: string; role: string }; onLogout: () => void }) {
  return (
    <div className="border-t border-border p-3">
      <NavLink to="/profile" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary-600">
          {user.fullName.slice(0, 1)}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-ink">{user.fullName}</div>
          <div className="truncate text-[11px] text-slate-400">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</div>
        </div>
      </NavLink>
      <button onClick={onLogout} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-surface hover:text-risk min-h-[44px]">
        Выйти
      </button>
    </div>
  );
}
