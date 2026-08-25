import { Link, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname } = useLocation();

  const navLink = (to: string, label: string) => (
    <Link
      key={to}
      to={to}
      className={[
        'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
        pathname.startsWith(to)
          ? 'bg-primary text-white shadow-sm'
          : 'text-muted hover:bg-primary-soft hover:text-primary',
      ].join(' ')}
    >
      {label}
    </Link>
  );

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
      >
        Войти
      </Link>
    );
  }

  if (user?.mustChangePassword) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/70 p-1">
        <span className="px-2 text-xs font-medium text-muted">{user.login}</span>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          Выйти
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/70 p-1">
      {navLink('/settings', 'Авторизация')}
      {navLink('/schedules', 'Расписания')}
      <span className="hidden px-2 text-xs font-medium text-muted sm:block">{user?.login}</span>
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        Выйти
      </Button>
    </div>
  );
}

export function AppLayout() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-app-gradient">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-10">
          <header className="animate-fade-up mb-6 rounded-xl border border-line bg-surface/95 p-4 shadow-card backdrop-blur md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-wide text-white">
                  VK
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                    Voximplant Kit
                  </p>
                  <h1 className="text-lg font-semibold text-ink md:text-xl">
                    Campaign Scheduler
                  </h1>
                </div>
              </div>
              <Nav />
            </div>
          </header>

          <main className="animate-fade-up-delayed flex-1 rounded-xl border border-line bg-surface p-4 shadow-card md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
