import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { GithubSetupPage } from '@/features/repositories/github-setup-page'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/github/setup', element: <GithubSetupPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
