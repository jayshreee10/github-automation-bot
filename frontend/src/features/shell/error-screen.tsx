import { RotateCw, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

// Short, user-facing summary; raw details only in dev so users never see stack noise.
function describe(error: unknown) {
  if (isRouteErrorResponse(error)) return { title: `${error.status} ${error.statusText}`, detail: null }
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : null
  return { title: 'Something went wrong', detail }
}

// Route errorElement. `fullScreen` for routes outside the shell (no sidebar to sit beside).
export function ErrorScreen({ fullScreen = false }: { fullScreen?: boolean }) {
  const { title, detail } = describe(useRouteError())

  return (
    <main className={fullScreen ? 'auth-screen' : 'error-screen'} role="alert">
      <Empty className="empty-card error-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>This page hit an unexpected error. Reload to try again, or head back to the dashboard.</EmptyDescription>
        </EmptyHeader>
        {detail && <pre className="error-detail">{detail}</pre>}
        <EmptyContent className="error-actions">
          <Button onClick={() => window.location.reload()}>
            <RotateCw data-icon="inline-start" />
            Reload page
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
