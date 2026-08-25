import { useEffect, useRef, useState } from 'react';
import { schedulesApi } from '../../api/schedules.api';
import { ApiError } from '../../api/client';
import type { Campaign } from '../../types/api.types';
import { Spinner } from '../ui/Spinner';
import { Link } from 'react-router-dom';

interface Props {
  value: Campaign | null;
  onChange: (campaign: Campaign) => void;
}

export function CampaignSearch({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Campaign[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [integrationError, setIntegrationError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = (q: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await schedulesApi.searchCampaigns(q || undefined);
        setResults(data);
        setErrorMessage(null);
        setIntegrationError(false);
      } catch (error) {
        setResults([]);
        if (error instanceof ApiError) {
          const body =
            error.body && typeof error.body === 'object'
              ? (error.body as Record<string, unknown>)
              : null;
          const code = typeof body?.code === 'string' ? body.code : null;

          if (code === 'INTEGRATION_AUTH_FAILED' || code === 'INTEGRATION_NOT_CONFIGURED') {
            setIntegrationError(true);
            setErrorMessage(
              typeof body?.message === 'string'
                ? body.message
                : 'Интеграция Voximplant не авторизована или токен истек.',
            );
          } else {
            setIntegrationError(false);
            setErrorMessage(error.message);
          }
        } else {
          setIntegrationError(false);
          setErrorMessage('Не удалось загрузить кампании');
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleFocus = () => {
    setOpen(true);
    if (results.length === 0) {
      search(query);
    }
  };

  const handleInputChange = (q: string) => {
    setQuery(q);
    setOpen(true);
    search(q);
  };

  const handleSelect = (c: Campaign) => {
    onChange(c);
    setQuery(c.title);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync input when value changes externally
  useEffect(() => {
    if (value) setQuery(value.title);
  }, [value]);

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-sm font-medium text-ink">
        Кампания
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={handleFocus}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Начните вводить название кампании..."
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 pr-8 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
        {loading && (
          <span className="absolute right-2.5 top-2.5">
            <Spinner size="sm" />
          </span>
        )}
      </div>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface shadow-card">
          {errorMessage && (
            <li className="px-3 py-2 text-sm text-danger">
              {errorMessage}
              {integrationError && (
                <span className="ml-1 text-xs">
                  <Link to="/settings" className="font-semibold underline underline-offset-2">
                    Перейти в Авторизацию
                  </Link>
                </span>
              )}
            </li>
          )}
          {results.length === 0 && !loading && !errorMessage && (
            <li className="px-3 py-2 text-sm text-muted">Ничего не найдено</li>
          )}
          {results.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => handleSelect(c)}
              className={[
                'flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-primary-soft',
                value?.id === c.id ? 'bg-primary-soft font-medium text-primary' : 'text-ink',
              ].join(' ')}
            >
              <span>{c.title}</span>
              <span className="ml-2 text-xs text-muted">#{c.id}</span>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <p className="mt-1 text-xs text-muted">
          Выбрано: <strong>{value.title}</strong> (ID: {value.id})
        </p>
      )}
    </div>
  );
}
