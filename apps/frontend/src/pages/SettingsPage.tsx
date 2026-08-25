import { useEffect, useState } from 'react';
import { settingsApi } from '../api/settings.api';
import { ApiError } from '../api/client';
import type { VerifyResult } from '../types/api.types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function SettingsPage() {
  const [domain, setDomain] = useState('');
  const [host, setHost] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [tokenPlaceholder, setTokenPlaceholder] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // Load existing settings
  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsApi.get();
        if (!data) {
          setIsEditing(true);
          return;
        }

        setDomain(data.domain);
        setHost(data.host);
        if (data.tokenLast4) {
          setTokenPlaceholder(`****${data.tokenLast4}`);
        }

        const hasSavedCredentials = Boolean(data.domain && data.host && data.tokenLast4);
        if (!hasSavedCredentials) {
          setIsEditing(true);
          return;
        }

        try {
          const runtimeResult = await settingsApi.verifyCurrent();
          setResult(runtimeResult);
          setIsEditing(!runtimeResult.verified);
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : 'Ошибка при проверке авторизации';
          setResult({ verified: false, message, code: 'INTEGRATION_AUTH_FAILED' });
          setIsEditing(true);
        }
      } catch {
        setIsEditing(true);
      } finally {
        setInitialLoading(false);
      }
    };

    void load();
  }, []);

  const handleSaveAndVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    if (!domain.trim() || !host.trim()) return;
    if (!accessToken && !tokenPlaceholder) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await settingsApi.saveAndVerify(
        domain.trim(),
        host.trim(),
        accessToken || '___KEEP___',
      );
      setResult(res);
      if (accessToken) {
        setTokenPlaceholder(`****${accessToken.slice(-4)}`);
        setAccessToken('');
      }
      if (res.verified) {
        setIsEditing(false);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Ошибка при проверке авторизации';
      setResult({ verified: false, message, code: 'INTEGRATION_AUTH_FAILED' });
    } finally {
      setLoading(false);
    }
  };

  const isVerified = result?.verified === true;
  const isFailed = result !== null && !result.verified;

  if (initialLoading) {
    return (
      <div className="flex justify-center py-10">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold text-ink">Авторизация</h2>
        <p className="text-sm text-muted">
        Введите данные вашего аккаунта Voximplant Kit и нажмите «Сохранить и проверить».
        Токен передаётся по HTTPS и хранится на сервере в зашифрованном виде (AES-256-GCM).
        </p>
      </div>

      <form
        onSubmit={handleSaveAndVerify}
        className={[
          'max-w-xl space-y-3 rounded-xl border p-4 shadow-card transition md:p-5',
          isVerified ? 'border-success/45 bg-success-soft/50' : 'border-line bg-surface',
          isFailed ? 'border-danger/35 bg-danger-soft/35' : '',
        ].join(' ')}
      >
        <Input
          label="Имя аккаунта (domain)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="domain"
          disabled={!isEditing}
          className={!isEditing ? 'bg-canvas/70 text-muted' : ''}
          required
        />
        <Input
          label="Имя хоста API (host)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="host"
          disabled={!isEditing}
          className={!isEditing ? 'bg-canvas/70 text-muted' : ''}
          required
        />
        <Input
          label="Токен доступа (access_token)"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={tokenPlaceholder || 'access_token'}
          disabled={!isEditing}
          className={!isEditing ? 'bg-canvas/70 text-muted' : ''}
          hint={
            tokenPlaceholder
              ? 'Токен уже сохранён. Введите новый, чтобы заменить.'
              : undefined
          }
        />

        {/* Verification status */}
        {isVerified && (
          <div className="rounded-lg border border-success/40 bg-success-soft p-3 text-sm">
            <p className="font-semibold text-success">✓ Успешная авторизация</p>
            {result?.account && (
              <div className="mt-2 space-y-1 text-ink">
                {result.account.id && (
                  <p>
                    ID: <strong>{result.account.id.toString()}</strong>
                  </p>
                )}
                {result.account.name && (
                  <p>
                    Name: <strong>{result.account.name}</strong>
                  </p>
                )}
                {result.account.mediaserverRegions &&
                  result.account.mediaserverRegions.length > 0 && (
                    <p>
                      Регионы медиасервера:{' '}
                      <strong>{result.account.mediaserverRegions.join(', ')}</strong>
                    </p>
                  )}
              </div>
            )}
          </div>
        )}

        {isFailed && (
          <div className="rounded-lg border border-danger/35 bg-danger-soft p-3 text-sm text-danger">
            ✗ {result?.message ?? 'Ошибка проверки'}
          </div>
        )}

        {isEditing ? (
          <Button type="submit" loading={loading} className="w-full">
            Сохранить и проверить
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            Редактировать
          </Button>
        )}
      </form>
    </section>
  );
}
