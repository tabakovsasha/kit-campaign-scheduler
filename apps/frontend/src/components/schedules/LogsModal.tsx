import { useEffect, useState } from 'react';
import type { LogEntry, Schedule } from '../../types/api.types';
import { logsApi } from '../../api/logs.api';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { formatDateTimeRu24 } from '../../utils/date-time';

interface Props {
  schedule: Schedule | null;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  resume: 'Запуск',
  pause: 'Пауза',
  verify_integration: 'Проверка токена',
  edit_schedule: 'Редактирование расписания',
  activate_schedule: 'Активация расписания',
  deactivate_schedule: 'Деактивация расписания',
  delete_schedule: 'Удаление расписания',
  restore_schedule: 'Восстановление расписания',
  auto_delete_schedule: 'Автоудаление расписания',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Вручную',
  scheduler: 'Планировщик',
  system: 'Система',
};

export function LogsModal({ schedule, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const scheduleTimezone = schedule?.campaignTimezone || 'UTC';

  const formatDetails = (log: LogEntry) => {
    if (log.errorMessage) {
      return <span className="text-xs text-danger">{log.errorMessage}</span>;
    }

    if (
      log.responsePayload &&
      typeof log.responsePayload === 'object' &&
      'message' in log.responsePayload
    ) {
      return (
        <span className="text-xs text-muted">
          {String((log.responsePayload as Record<string, unknown>).message)}
        </span>
      );
    }

    if (log.httpStatus) {
      return <span className="text-xs text-muted">HTTP {log.httpStatus}</span>;
    }

    return <span className="text-xs text-muted/60">—</span>;
  };

  useEffect(() => {
    if (!schedule) return;
    setLoading(true);
    logsApi
      .bySchedule(schedule.id)
      .then((data) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [schedule]);

  if (!schedule) return null;

  return (
    <Modal
      open={Boolean(schedule)}
      onClose={onClose}
      title={`Логи: ${schedule.name}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Кампания: <strong className="text-ink">{schedule.campaignTitle}</strong>
        </p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && logs.length === 0 && (
          <p className="rounded-lg border border-dashed border-line bg-canvas/40 py-8 text-center text-sm text-muted">
            Действий пока нет
          </p>
        )}

        {!loading && logs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Время
                    <span className="ml-1 text-xs font-normal normal-case text-gray-400">
                      ({scheduleTimezone})
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Действие</th>
                  <th className="px-4 py-3 text-left">Источник</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-left">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70 bg-surface">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-canvas/35">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDateTimeRu24(log.createdAt, scheduleTimezone)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        color={
                          log.action === 'resume'
                            ? 'green'
                            : log.action === 'pause'
                              ? 'yellow'
                              : log.action === 'delete_schedule'
                                ? 'gray'
                                : log.action === 'restore_schedule'
                                  ? 'green'
                                  : log.action === 'auto_delete_schedule'
                                    ? 'gray'
                              : log.action === 'activate_schedule'
                                ? 'green'
                                : log.action === 'deactivate_schedule'
                                  ? 'gray'
                              : log.action === 'edit_schedule'
                                ? 'blue'
                                : 'gray'
                        }
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {SOURCE_LABELS[log.source] ?? log.source}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === 'success' ? (
                        <Badge color="green">Успешно</Badge>
                      ) : (
                        <Badge color="red">Ошибка</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDetails(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
