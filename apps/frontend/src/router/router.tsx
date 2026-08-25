import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { SchedulesPage } from '../pages/SchedulesPage';
import { SettingsPage } from '../pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/schedules" replace /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'change-password',
        element: (
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'schedules',
        element: (
          <ProtectedRoute>
            <SchedulesPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
