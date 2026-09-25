import { createBrowserRouter, Navigate } from 'react-router'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardPage } from '@/pages/dashboard-page'
import { GithubSetupPage } from '@/pages/github-setup-page'
import { LoginPage } from '@/pages/login-page'

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
