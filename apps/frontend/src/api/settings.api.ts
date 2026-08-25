import { api } from './client';
import type { SettingsData, VerifyResult } from '../types/api.types';

export const settingsApi = {
  get: () => api.get<SettingsData | null>('/settings'),

  saveAndVerify: (domain: string, host: string, access_token: string) =>
    api.post<VerifyResult>('/settings/verify', { domain, host, access_token }),

  verifyCurrent: () => api.post<VerifyResult>('/settings/verify/current', {}),
};
