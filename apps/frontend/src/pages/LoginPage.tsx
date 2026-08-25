import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginVal.trim() || !password) return;

    setError('');
    setLoading(true);
    try {
      await login(loginVal.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверный логин или пароль');
      } else {
        setError('Ошибка подключения к серверу');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Voximplant Kit
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Вход в систему</h1>
          <p className="mt-2 text-sm text-muted">Авторизуйтесь для управления расписаниями</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-line bg-surface p-6 shadow-card"
        >
          <Input
            label="Логин"
            value={loginVal}
            onChange={(e) => setLoginVal(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Войти
          </Button>
        </form>
      </div>
    </div>
  );
}
