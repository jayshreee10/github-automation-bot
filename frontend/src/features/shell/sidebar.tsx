import {
  Bot,
  FolderGit2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/use-me";
import { useSignOut } from "@/features/auth/use-sign-out";
import { useStats } from "@/features/events/use-stats";
import { useRepositories } from "@/features/repositories/use-repositories";
import { initials } from "@/lib/initials";
import { useRepoFilter } from "./use-repo-filter";
import { webhookHealth } from "./webhook-health";

export function Sidebar() {
  const { search } = useRepoFilter();
  const { data: repos } = useRepositories();
  // Workspace-wide: the sidebar ignores the repo filter.
  const { data: stats } = useStats(null);
  const failures = stats ? stats.jobs.retrying + stats.jobs.dead : 0;
  const health = stats && webhookHealth(stats);

  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/events", label: "Event log", icon: ScrollText },
    {
      to: "/repositories",
      label: "Repositories",
      icon: FolderGit2,
      badge: repos?.repositories.length,
      tone: "muted",
    },
    { to: "/rules", label: "Rules", icon: ListChecks },
    {
      to: "/failures",
      label: "Failures",
      icon: TriangleAlert,
      badge: failures || undefined,
      tone: "destructive",
    },
  ] as const;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Bot />
        </span>
        <span className="brand-text">
          <span className="brand-name">Automation Bot</span>
          <span className="brand-tagline">Rule-based repo automation</span>
        </span>
      </div>

      <nav className="side-nav" aria-label="Main">
        <span className="side-nav-heading">Workspace</span>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search }}
            end={"end" in item}
            className="side-link"
          >
            <item.icon />
            {item.label}
            {"badge" in item && item.badge !== undefined && (
              <span className="side-badge" data-tone={item.tone}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {health && (
          <div className="webhook-box" data-health={health.health}>
            <span className="webhook-title">
              <span className="pulse-dot" />
              {health.title}
            </span>
            <span className="webhook-detail">{health.detail}</span>
          </div>
        )}
        <UserCard />
      </div>
    </aside>
  );
}

function UserCard() {
  const { me } = useMe();
  const signOut = useSignOut();
  const name = me?.name ?? me?.githubLogin ?? me?.email ?? "";

  return (
    <div className="user-card">
      {me?.image ? (
        <img className="avatar" src={me.image} alt="" />
      ) : (
        <span className="avatar">{name && initials(name)}</span>
      )}
      <span className="user-text">
        <span className="user-name">{name}</span>
        <span className="user-handle">
          {me?.githubLogin ? `@${me.githubLogin}` : me?.email}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut />
      </Button>
    </div>
  );
}
