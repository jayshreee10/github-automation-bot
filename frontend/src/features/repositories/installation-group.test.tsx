import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InstallationGroupData } from './group-by-installation'
import { InstallationGroup } from './installation-group'

const group: InstallationGroupData = {
  installationId: '7',
  accountLogin: 'acme',
  repos: [
    { id: '1', fullName: 'acme/api', isPrivate: true, installationId: '7', accountLogin: 'acme' },
    { id: '2', fullName: 'acme/web', isPrivate: false, installationId: '7', accountLogin: 'acme' },
  ],
}

describe('InstallationGroup', () => {
  it('lists repositories with links and a Private badge', () => {
    render(<InstallationGroup group={group} syncing={false} onSync={() => {}} />)
    expect(screen.getByText('acme')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'acme/api' }).getAttribute('href')).toBe('https://github.com/acme/api')
    expect(screen.getAllByText('Private')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Manage on GitHub' }).getAttribute('href')).toBe(
      'https://github.com/settings/installations/7',
    )
  })

  it('explains an installation with no visible repositories', () => {
    render(<InstallationGroup group={{ ...group, repos: [] }} syncing={false} onSync={() => {}} />)
    expect(screen.getByText(/No repositories visible/)).toBeTruthy()
  })

  it('calls onSync with the installation id', () => {
    const onSync = vi.fn()
    render(<InstallationGroup group={group} syncing={false} onSync={onSync} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }))
    expect(onSync).toHaveBeenCalledWith('7')
  })

  it('disables Sync while syncing', () => {
    render(<InstallationGroup group={group} syncing onSync={() => {}} />)
    const button = screen.getByRole('button', { name: 'Syncing…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
