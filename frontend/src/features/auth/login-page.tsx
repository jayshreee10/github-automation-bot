import { Bot, EyeOff, FolderGit2, UserRound } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "./redirect";

const STEPS = [
  { title: "Sign in with GitHub", detail: "your identity only" },
  { title: "Install the GitHub App", detail: "pick the repos it can see" },
  { title: "Add rules", detail: "match events, label, comment, notify Slack" },
];

const NOTES = [
  {
    icon: UserRound,
    text: "Your public GitHub profile and email, to sign you in.",
  },
  {
    icon: FolderGit2,
    text: "Repo access is granted later, per repository, through the GitHub App.",
  },
  {
    icon: EyeOff,
    text: "We never read your code. Only issue, PR and push metadata.",
  },
];

// lucide dropped brand icons, so the GitHub mark is inlined.
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function LoginPage() {
  const { data, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));

  if (isPending) return <p className="screen-message">Loading…</p>;
  if (data) return <Navigate to={next} replace />;

  // callbackURL must be absolute and listed in Neon Auth trusted domains.
  async function signIn() {
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "github",
      callbackURL: `${window.location.origin}${next}`,
    });
    if (error) setError("Sign-in failed. Please try again.");
  }

  return (
    <main className="login-screen">
      <section className="login-brand">
        <div className="login-logo">
          <span className="login-logo-mark">
            <Bot />
          </span>
          Automation Bot
        </div>
        <div className="login-pitch">
          <h1 className="login-headline">
            Your repo acts.{" "}
            <span className="login-headline-accent">The bot reacts.</span>
          </h1>
          <p className="login-lead">
            Label issues, comment on pull requests and ping Slack the moment
            something happens on GitHub. Every action is logged, retried and
            never doubled.
          </p>
        </div>
        <ol className="login-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="login-step">
              <span className="login-step-number">{i + 1}</span>
              <span>
                <strong className="login-step-title">{s.title}</strong>{" "}
                <span className="login-step-detail">· {s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="login-events">issues · pull_request · push</div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">
              Sign in to see what your bot has been up to.
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="login-button"
            onClick={signIn}
          >
            <GithubMark />
            Continue with GitHub
          </Button>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="login-divider">what we access</div>
          <ul className="login-notes">
            {NOTES.map((n) => (
              <li key={n.text} className="login-note">
                <n.icon aria-hidden />
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
