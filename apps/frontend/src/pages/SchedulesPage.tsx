import { useEffect, useState } from 'react';
import { schedulesApi } from '../api/schedules.api';
import type { Schedule } from '../types/api.types';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { ScheduleModal } from '../components/schedules/ScheduleModal';
import { ScheduleCard } from '../components/schedules/ScheduleCard';
import { LogsModal } from '../components/schedules/LogsModal';

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(Date.now());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [logsTarget, setLogsTarget] = useState<Schedule | null>(null);

  const loadSchedules = () => {
    setLoading(true);
    schedulesApi
      .list()
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadSchedules, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncTimer = setInterval(() => {
      loadSchedules();
    }, 60_000);

    return () => clearInterval(syncTimer);
  }, []);

  const handleCreated = (created: Schedule) => {
    setSchedules((prev) => [created, ...prev]);
  };

  const handleToggled = (updated: Schedule) => {
    setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleUpdated = (updated: Schedule) => {
    setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditTarget(null);
  };

  const activeSchedules = schedules.filter((schedule) => !schedule.isDeleted);
  const deletedSchedules = schedules.filter((schedule) => schedule.isDeleted);

  return (
    <section className="flex flex-col gap-5">
      <Button className="self-end" onClick={() => setCreateModalOpen(true)}>
        Задать расписание
      </Button>

      <p className="text-sm text-muted">
        Создавайте гибкие расписания для исходящих кампаний: рабочие дни, перерывы,
        праздники. Планировщик автоматически запустит или поставит кампанию на паузу.
      </p>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/70 py-16 text-center text-muted">
          <p className="text-base font-semibold text-ink">Расписаний пока нет</p>
          <p className="mt-1 text-sm">Нажмите «Задать расписание», чтобы создать первое</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSchedules.length > 0 && (
            <div className="stagger-list space-y-3">
              {activeSchedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  nowTs={nowTs}
                  onToggled={handleToggled}
                  onDeleted={handleUpdated}
                  onRestored={handleUpdated}
                  onLogsClick={setLogsTarget}
                  onEditClick={setEditTarget}
                />
              ))}
            </div>
          )}

          {deletedSchedules.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Удаленные расписания
              </p>
              <div className="stagger-list space-y-3">
                {deletedSchedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    nowTs={nowTs}
                    onToggled={handleToggled}
                    onDeleted={handleUpdated}
                    onRestored={handleUpdated}
                    onLogsClick={setLogsTarget}
                    onEditClick={setEditTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <ScheduleModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      {/* Edit modal */}
      <ScheduleModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        mode="edit"
        initialValues={editTarget}
        onUpdated={handleUpdated}
      />

      {/* Logs modal */}
      <LogsModal schedule={logsTarget} onClose={() => setLogsTarget(null)} />
    </section>
  );
}
