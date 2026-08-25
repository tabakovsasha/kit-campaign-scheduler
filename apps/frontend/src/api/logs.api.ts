import { api } from './client';
import type { LogEntry } from '../types/api.types';

export const logsApi = {
  bySchedule: (scheduleId: string) =>
    api.get<LogEntry[]>(`/logs/schedule/${scheduleId}`),
};
