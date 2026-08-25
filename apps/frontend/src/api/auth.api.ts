import { api } from './client';
import type {
  AuthUser,
  ChangePasswordResponse,
  LoginResponse,
} from '../types/api.types';

export const authApi = {
  login: (login: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { login, password }),

  me: () => api.get<AuthUser>('/auth/me'),

  logout: () => api.post<void>('/auth/logout', {}),

  refresh: (refreshToken: string) =>
    api.post<LoginResponse>('/auth/refresh', { refreshToken }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ChangePasswordResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
};
