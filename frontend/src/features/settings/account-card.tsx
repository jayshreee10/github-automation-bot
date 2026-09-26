import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/use-me'
import { useSignOut } from '@/features/auth/use-sign-out'
import { initials } from '@/lib/initials'

export function AccountCard() {
  const { me } = useMe()
  const signOut = useSignOut()
  const name = me?.name ?? me?.githubLogin ?? me?.email ?? ''

  return (
    <section id="account" className="panel settings-account" aria-label="Account">
      {me?.image ? <img className="avatar settings-avatar" src={me.image} alt="" /> : <span className="avatar settings-avatar">{name && initials(name)}</span>}
      <div className="panel-head-text">
        <span className="settings-account-name">
          {name}
          {me?.githubLogin && ` · @${me.githubLogin}`}
        </span>
        <span className="settings-note">Signed in with GitHub</span>
      </div>
      <Button variant="outline" className="settings-head-badge" onClick={signOut}>
        Sign out
      </Button>
    </section>
  )
}
