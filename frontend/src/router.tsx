import { createBrowserRouter, Navigate } from 'react-router'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardPage } from '@/pages/dashboard-page'
import { LoginPage } from '@/pages/login-page'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <DashboardPage /> }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
