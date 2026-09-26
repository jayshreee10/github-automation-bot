import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { EventsPage } from '@/features/events/events-page'
import { FailuresPage } from '@/features/failures/failures-page'
import { ConnectGithubPage } from '@/features/repositories/connect-github-page'
import { GithubSetupPage } from '@/features/repositories/github-setup-page'
import { InstallationGate } from '@/features/repositories/installation-gate'
import { RepositoriesPage } from '@/features/repositories/repositories-page'
import { RuleFormPage } from '@/features/rules/rule-form-page'
import { RulesPage } from '@/features/rules/rules-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { AppShell } from '@/features/shell/app-shell'
import { ErrorScreen } from '@/features/shell/error-screen'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorScreen fullScreen /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorScreen fullScreen />,
    children: [
      { path: '/github/setup', element: <GithubSetupPage /> },
      { path: '/connect', element: <ConnectGithubPage /> },
      {
        // No dashboard or sidebar until the GitHub App is installed.
        element: <InstallationGate />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // Page crashes render here, so the sidebar stays usable.
                errorElement: <ErrorScreen />,
                children: [
                  { path: '/', element: <DashboardPage /> },
                  { path: '/events', element: <EventsPage /> },
                  { path: '/rules', element: <RulesPage /> },
                  { path: '/rules/new', element: <RuleFormPage /> },
                  { path: '/rules/:id', element: <RuleFormPage /> },
                  { path: '/failures', element: <FailuresPage /> },
                  { path: '/repositories', element: <RepositoriesPage /> },
                  { path: '/settings', element: <SettingsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
