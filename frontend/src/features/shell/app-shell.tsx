import { Outlet } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from './sidebar'

// Sidebar + page. Each page renders its own TopBar, so its actions sit next to the breadcrumb.
export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Outlet />
      </div>
      <Toaster />
    </div>
  )
}
