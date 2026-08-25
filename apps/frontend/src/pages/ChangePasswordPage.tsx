import { useState } from 'react';
import { ApiError } from '../api/client';
import { authApi } from '../api/auth.api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ChangePasswordPage() {
  const { logout, setMustChangePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Заполните все поля');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);
      if (response.success) {
        setMustChangePassword(false);
        setMessage('Пароль успешно обновлен. Выполните повторный вход.');
        await logout();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось сменить пароль');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink">Смена пароля обязательна</h2>
        <p className="text-sm text-muted">
          Для защиты аккаунта необходимо заменить временный пароль перед работой в системе.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-card"
      >
        <Input
          label="Текущий пароль"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />

        <Input
          label="Новый пароль"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          hint="Минимум 10 символов, включая строчные/заглавные, цифры и спецсимволы"
        />

        <Input
          label="Подтверждение нового пароля"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
            {message}
          </p>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Сменить пароль
        </Button>
      </form>
    </section>
  );
}
