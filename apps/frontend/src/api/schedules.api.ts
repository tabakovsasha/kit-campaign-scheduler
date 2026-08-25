import { api } from './client';
import type {
  Campaign,
  CreateSchedulePayload,
  Schedule,
  UpdateScheduleResponse,
} from '../types/api.types';

export const schedulesApi = {
  list: () => api.get<Schedule[]>('/schedules'),

  create: (payload: CreateSchedulePayload) =>
    api.post<Schedule>('/schedules', payload),

  update: (id: string, payload: CreateSchedulePayload) =>
    api.put<UpdateScheduleResponse>(`/schedules/${id}`, payload),

  toggle: (id: string, enabled?: boolean) =>
    api.patch<{ schedule: Schedule; transition: unknown }>(`/schedules/${id}/toggle`, {
      enabled,
    }),

  delete: (id: string) => api.delete<{ schedule: Schedule }>(`/schedules/${id}`),

  restore: (id: string) => api.patch<{ schedule: Schedule }>(`/schedules/${id}/restore`),

  searchCampaigns: (q?: string) =>
    api.get<Campaign[]>(`/schedules/campaigns/search${q ? `?q=${encodeURIComponent(q)}` : ''}`),
};
