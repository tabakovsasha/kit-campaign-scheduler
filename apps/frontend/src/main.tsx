import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import './styles.css';

// AuthProvider is embedded inside AppLayout via router context.
// The RouterProvider must be the outermost component so useNavigate works inside AuthProvider.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
